import { Router } from "express";
import { requireAuth, supabaseAdmin } from "./auth.js";

const router = Router();

// List all tailored applications for the current user, newest first,
// joined with their job target info.
router.get("/", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("tailored_applications")
    .select("*, job_targets(company, title, source_url, job_description, status)")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Mark a tailored application as approved (the user reviewed it and is
// ready for it to be submitted — actual submission is a separate,
// later integration per job board).
router.post("/:id/approve", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("tailored_applications")
    .update({ approved_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin
    .from("job_targets")
    .update({ status: "approved" })
    .eq("id", data.job_target_id);

  res.json(data);
});

// Skip/reject a tailored application — frees it from the queue without
// counting against anything further.
router.post("/:id/skip", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("tailored_applications")
    .select("job_target_id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin
    .from("job_targets")
    .update({ status: "skipped" })
    .eq("id", data.job_target_id);

  res.json({ skipped: true });
});

export default router;
