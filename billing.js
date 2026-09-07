import { Router } from "express";
import Stripe from "stripe";
import { requireAuth, supabaseAdmin } from "./auth.js";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
};

const PLAN_LIMITS = {
  starter: 60,
  pro: 200,
};

// Create a Stripe Checkout session for the chosen plan.
router.post("/checkout", requireAuth, async (req, res) => {
  const { plan } = req.body; // 'starter' | 'pro'
  const priceId = PRICE_IDS[plan];
  if (!priceId) return res.status(400).json({ error: "Unknown plan" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", req.user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      metadata: { supabase_user_id: req.user.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", req.user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.CLIENT_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.CLIENT_URL}/pricing?checkout=canceled`,
    metadata: { supabase_user_id: req.user.id, plan },
  });

  res.json({ url: session.url });
});

// Stripe webhook — this endpoint must receive the RAW request body (see server.js),
// not the JSON-parsed body, or signature verification will fail.
export async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const plan = session.metadata.plan;
      const userId = session.metadata.supabase_user_id;

      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_tier: plan,
          subscription_status: "active",
          applications_limit: PLAN_LIMITS[plan],
          applications_used_this_period: 0,
        })
        .eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await supabaseAdmin
        .from("profiles")
        .update({ subscription_tier: "free", subscription_status: "canceled", applications_limit: 5 })
        .eq("stripe_customer_id", subscription.customer);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      await supabaseAdmin
        .from("profiles")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", invoice.customer);
      break;
    }
  }

  res.json({ received: true });
}

export default router;
