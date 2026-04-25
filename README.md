# MatchMySkills AI Backend

This backend keeps OpenRouter API key off the Android app and exposes one endpoint for candidate analysis.

## 1) Setup

1. Open terminal in ai-backend
2. Install dependencies
3. Copy .env.example to .env
4. Fill OPENROUTER_API_KEY
5. Start server

## 2) Commands

```bash
npm install
cp .env.example .env
npm run dev
```

Server runs on:

- http://localhost:8787

Health check:

- GET /health

Analysis endpoint:

- POST /api/ai/candidate-analysis

## 3) Request body example

```json
{
  "job_description": "Android developer role building Kotlin apps",
  "required_skills": ["Kotlin", "Android", "Firebase"],
  "candidate_skills": ["Kotlin", "Firebase", "MVVM"],
  "resume_text": "Built 3 Android apps and internship project"
}
```

## 4) Response example

```json
{
  "matchPercentage": 82,
  "strengths": ["Kotlin", "Firebase"],
  "missingSkills": ["Android testing"],
  "recommendation": "Good fit for interview",
  "fitLabel": "Strong Fit"
}
```

## 5) Android local endpoint

- Emulator (Android Studio): http://10.0.2.2:8787/api/ai/candidate-analysis
- Physical device: use your computer LAN IP, for example http://192.168.1.20:8787/api/ai/candidate-analysis
