# Moonshift backend — launch checklist

This is a real Express API: auth-protected resume storage, an AI tailoring
endpoint, and Stripe subscription billing. It's not connected to the
`moonshift.html` landing page yet — that's the next step after this is live.

## 1. Create your accounts (15 min)
- **Supabase** (supabase.com) → New project → note your Project URL and
  `service_role` key (Settings → API).
- **Anthropic** (console.anthropic.com) → API Keys → create one.
- **Stripe** (dashboard.stripe.com) → Developers → API keys → copy your
  secret key. Then Products → create two recurring products: "Starter"
  ($19/mo) and "Pro" ($39/mo) → copy each Price ID.

## 2. Set up the database
- In Supabase: SQL Editor → paste the contents of `db/schema.sql` → Run.
  This creates all tables, row-level security, and the auto-profile trigger.

## 3. Configure environment variables
```
cp .env.example .env
```
Fill in every value from step 1.

## 4. Install and run locally
```
npm install
npm run dev
```
Visit `http://localhost:3000/health` — you should see `{"ok":true}`.

## 5. Test the Stripe webhook locally
```
stripe listen --forward-to localhost:3000/api/billing/webhook
```
This prints a `whsec_...` value — put it in `.env` as `STRIPE_WEBHOOK_SECRET`.

## 6. Deploy
- **Backend**: push this folder to a GitHub repo, then deploy on Railway or
  Render (both auto-detect Node and give you a free tier). Set the same env
  vars in their dashboard.
- Once deployed, go back to Stripe → Developers → Webhooks → add an endpoint
  pointing at `https://your-backend-domain.com/api/billing/webhook`, and
  replace your local `STRIPE_WEBHOOK_SECRET` with the one Stripe gives you
  for that live endpoint.

## 7. Connect the frontend
The `moonshift.html` page currently calls the Anthropic API directly from
the browser for the demo — fine for a prototype, not for production (it
exposes no real key today, but a production build must never ship an API
key client-side). Once this backend is deployed:
- Replace the demo's `fetch` call with a call to your own
  `POST /api/tailor` endpoint instead.
- Add Supabase Auth (`@supabase/supabase-js` on the frontend) for real
  signup/login — it issues the access token this API expects in the
  `Authorization: Bearer <token>` header.
- Wire the pricing buttons to `POST /api/billing/checkout` with
  `{ "plan": "starter" }` or `{ "plan": "pro" }`, then redirect the browser
  to the `url` it returns.

## What's deliberately not built yet
- Resume file parsing (PDF/DOCX → text). Start with paste-as-text like the
  demo; add `pdf-parse` for PDF uploads when ready.
- Job board auto-discovery and auto-submission. No official API covers all
  boards, and automated submission usually isn't allowed by the platforms'
  terms — treat this as a later, board-by-board integration project, not
  a v1 feature.
