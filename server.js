import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const appSharedSecret = process.env.APP_SHARED_SECRET || "";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "matchmyskills-ai-backend" });
});

app.post("/api/ai/candidate-analysis", async (req, res) => {
  try {
    if (appSharedSecret) {
      const incoming = req.header("x-app-secret") || "";
      if (incoming !== appSharedSecret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    if (!openRouterApiKey) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY is not configured" });
    }

    const body = req.body || {};
    const jobDescription = String(body.job_description || body.jobDescription || "").trim();
    const requiredSkills = Array.isArray(body.required_skills)
      ? body.required_skills
      : Array.isArray(body.requiredSkills)
      ? body.requiredSkills
      : [];
    const candidateSkills = Array.isArray(body.candidate_skills)
      ? body.candidate_skills
      : Array.isArray(body.candidateSkills)
      ? body.candidateSkills
      : [];
    const resumeText = String(body.resume_text || body.resumeText || "").trim();

    if (!jobDescription || requiredSkills.length === 0 || candidateSkills.length === 0) {
      return res.status(400).json({
        error: "job_description, required_skills, and candidate_skills are required"
      });
    }

    const prompt = [
      "Analyze this candidate for the job.",
      "",
      `Job Description:\n${jobDescription}`,
      "",
      `Required Skills:\n${requiredSkills.join(", ")}`,
      "",
      `Candidate Skills:\n${candidateSkills.join(", ")}`,
      "",
      `Resume:\n${resumeText || "Not provided"}`,
      "",
      "Return ONLY valid JSON in this exact shape:",
      '{"matchPercentage":0,"strengths":[],"missingSkills":[],"recommendation":""}',
      "Do not include markdown code blocks."
    ].join("\n");

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://matchmyskills.local",
        "X-Title": "MatchMySkills Candidate Analysis"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a hiring assistant. You provide analysis only. Never make hiring decisions. Return strict JSON only."
          },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return res.status(502).json({ error: "OpenRouter error", details: text.slice(0, 800) });
    }

    const aiJson = await aiRes.json();
    const content =
      aiJson?.choices?.[0]?.message?.content ||
      aiJson?.choices?.[0]?.text ||
      "{}";

    const parsed = safeParseAnalysis(content);

    const normalized = {
      matchPercentage: clampNumber(parsed.matchPercentage),
      strengths: normalizeList(parsed.strengths),
      missingSkills: normalizeList(parsed.missingSkills),
      recommendation: String(parsed.recommendation || "No recommendation provided").trim()
    };

    const fitLabel =
      normalized.matchPercentage >= 80
        ? "Strong Fit"
        : normalized.matchPercentage >= 55
        ? "Moderate Fit"
        : "Needs Improvement";

    return res.json({ ...normalized, fitLabel });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error", details: String(error?.message || error) });
  }
});

app.listen(port, () => {
  console.log(`AI backend running on http://localhost:${port}`);
});

function safeParseAnalysis(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function clampNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 12);
}
