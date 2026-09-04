# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server on port 3000 (host 0.0.0.0); proxies `/api/*` to the backend at `localhost:8787`
- `npm run server` (alias: `npm start`) — run the Express backend that calls Vertex AI, on port 8787 (or `$PORT`)
- `npm run build` — production build via Vite
- `npm run preview` — preview the production build
- `npm run lint` — type-check only (`tsc --noEmit`); there is no separate test suite or linter (ESLint) configured
- `npm run clean` — remove `dist/`

Local dev requires both `npm run dev` and `npm run server` running concurrently in separate terminals.

## Environment

Requires a `.env` with `GOOGLE_CLOUD_PROJECT` and optionally `GOOGLE_CLOUD_LOCATION` (default `us-central1`) — see `.env.example`. The backend authenticates to Vertex AI via Application Default Credentials (`gcloud auth application-default login`, or the runtime's service account); there is no API key anywhere in this app.

## Architecture

This is a two-part app: a Vite/React frontend (`src/App.tsx`) and an Express backend (`server/index.ts`) that is the only thing allowed to talk to Vertex AI. The frontend never holds credentials — it POSTs to `/api/generate` and the backend does the Gemini call server-side. In production, the same Express server also serves the built `dist/` static assets (single deployable, e.g. to Cloud Run).

`src/App.tsx` has almost all frontend logic in one file — no router, no component directory, no state management library, everything is local `useState` in the `App` component.

Key structure:
- `CHEAT_SHEET` — static data for the OpenAI/Bedrock/Vertex AI comparison table.
- `getCodeSamples(model)` / `getOpenAiCompatibleSamples(model)` — static, hand-written side-by-side code snippets (not LLM-generated) shown in the "Code Samples" tab.
- `handleGenerate` (in `App.tsx`) sends the user's use case/prompts/code to `POST /api/generate`; the actual `ai.models.generateContent` call, the large inline `systemInstruction`, and the strict `responseSchema` (via `Type.OBJECT` from `@google/genai`) all live in `server/index.ts`, forcing structured JSON output matching the `MigrationPlan` interface. Changing the plan's shape requires updating the `MigrationPlan` interface in `App.tsx` together with the `responseSchema` and `systemInstruction` in `server/index.ts` — they must stay in sync across the two files.
- `server/index.ts` allowlists `selectedModel` against known Gemini model ids before passing it to Vertex AI.
- The system prompt hardcodes a policy that only `gemini-3.8-flash` may be recommended (never 1.5 or Pro models); it's the sole entry in `ALLOWED_MODELS`.
- The generated `MigrationPlan` is rendered across tabs (`overview`, `cheatsheet`, `samples`, `prompt`, `code`, `integration`, `skills`) driven by the `activeTab` state; the `integration` tab client-side-templates a full FastAPI app (`main.py` + `requirements.txt` + `.env`) by interpolating the generated prompt/code into template literals — it does not call the model again.
- `sourceSystem` (`OpenAI` vs `Claude on Bedrock`) and `sdkApproach`/`sampleApproach` (`google-genai` vs `openai-compatible`) toggle which static/generated snippets are displayed; Bedrock as a source only supports the `google-genai` SDK path (the OpenAI-compatible toggle is hidden in that case).
- `react-joyride` drives the "Take Tour" onboarding walkthrough, targeting elements via `tour-step-*` CSS classes scattered through the JSX.

## Notes

- Styling is Tailwind CSS v4 via the `@tailwindcss/vite` plugin (see `vite.config.ts`), not a separate Tailwind config file.
- `server/index.ts` is run directly via `tsx` (no separate compile step); it loads `.env` itself via `dotenv/config` since Vite's env loading doesn't apply outside the frontend build.
