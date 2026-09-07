import { Router } from "express";
import { requireAuth, supabaseAdmin } from "./auth.js";

const router = Router();

// Save a resume (plain text already extracted client-side or via a parsing step upstream).
router.post("/", requireAuth, async (req, res) => {
  const { label, raw_text } = req.body;
  if (!raw_text) return res.status(400).json({ error: "raw_text is required" });

  const { data, error } = await supabaseAdmin
    .from("resumes")
    .insert({ user_id: req.user.id, label: label || "My resume", raw_text })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// List the current user's resumes.
router.get("/", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("resumes")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
