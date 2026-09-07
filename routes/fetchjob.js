import { Router } from "express";
import * as cheerio from "cheerio";
import { requireAuth } from "./auth.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "That doesn't look like a valid URL." });
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MoonshiftBot/1.0)",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return res.status(502).json({
        error: That site returned an error (status ${response.status}). Try pasting the description manually.,
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header, noscript, svg, iframe").remove();

    let text = $("body").text();
    text = text.replace(/\s+/g, " ").trim();

    const pageTitle = $("title").first().text().trim();

    if (!text || text.length < 100) {
      return res.status(422).json({
        error: "Couldn't find readable job text on that page — try pasting the description manually.",
      });
    }

    const trimmed = text.slice(0, 8000);

    res.json({ text: trimmed, pageTitle });
  } catch (err) {
    console.error("Job fetch error:", err);
    res.status(502).json({
      error: "Couldn't reach that link — the site may block automated requests. Try pasting the description manually.",
    });
  }
});

export default router;
