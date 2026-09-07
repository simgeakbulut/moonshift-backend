import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, supabaseAdmin } from "./auth.js";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post("/", requireAuth, async (req, res) => {
  const { resume_id, job_description, source_url, company, title } = req.body;
  if (!resume_id || !job_description) {
    return res.status(400).json({ error: "resume_id and job_description are required" });
  }

  // 1. Enforce the user's plan limit BEFORE spending an AI call.
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("applications_used_this_period, applications_limit, subscription_status")
    .eq("id", req.user.id)
    .single();

  if (profileErr) return res.status(500).json({ error: profileErr.message });

  if (profile.applications_used_this_period >= profile.applications_limit) {
    return res.status(402).json({
      error: "Application limit reached for your current plan. Upgrade to continue.",
    });
  }

  // 2. Fetch the resume text.
  const { data: resume, error: resumeErr } = await supabaseAdmin
    .from("resumes")
    .select("raw_text")
    .eq("id", resume_id)
    .eq("user_id", req.user.id)
    .single();

  if (resumeErr || !resume) return res.status(404).json({ error: "Resume not found" });

  // 3. Create the job_target row.
  const { data: jobTarget, error: jobErr } = await supabaseAdmin
    .from("job_targets")
    .insert({
      user_id: req.user.id,
      source_url,
      company,
      title,
      job_description,
      status: "tailored",
    })
    .select()
    .single();

  if (jobErr) return res.status(500).json({ error: jobErr.message });

  // 4. Call Claude to tailor the resume + write a cover letter.
  const prompt = `You are a resume tailoring assistant. Given a candidate's resume text and a target job description, produce:
1. Four to six tailored resume bullet points (rewritten to match the job's language and priorities, based only on real experience in the resume — never invent experience).
2. A full three-paragraph cover letter tailored to this role.
3. Draft answers to three common screening questions: "Why are you interested in this role?", "What's your relevant experience?", and "What's your desired salary range?" (for salary, answer generically that it's negotiable based on total compensation unless the resume implies a specific range).

Resume:
${resume.raw_text}

Job description:
${job_description}

Respond ONLY as JSON, no markdown, no preamble, with this exact shape:
{"bullets": ["...", "..."], "coverLetter": "...", "screeningAnswers": {"why_interested": "...", "relevant_experience": "...", "salary_expectations": "..."}}`;

  let parsed;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content.map((b) => b.text || "").join("\n");
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (err) {
    console.error("Anthropic error:", err);
    return res.status(502).json({ error: "AI tailoring failed. Try again." });
  }

  // 5. Store the result.
  const { data: tailored, error: tailoredErr } = await supabaseAdmin
    .from("tailored_applications")
    .insert({
      user_id: req.user.id,
      job_target_id: jobTarget.id,
      resume_id,
      tailored_resume_text: (parsed.bullets || []).join("\n"),
      cover_letter_text: parsed.coverLetter,
      screening_answers: parsed.screeningAnswers,
    })
    .select()
    .single();

  if (tailoredErr) return res.status(500).json({ error: tailoredErr.message });

  // 6. Increment usage.
  await supabaseAdmin
    .from("profiles")
    .update({ applications_used_this_period: profile.applications_used_this_period + 1 })
    .eq("id", req.user.id);

  res.json({ jobTarget, tailored });
});

export default router;
