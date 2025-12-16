Sakescope Frontend — Realtime Voice Agent

Setup

- Env: set `OPENAI_API_KEY` for the Next.js API route `src/app/api/client-secret/route.ts`.
- Run: `npm run dev` in the `frontend` directory.
- HTTPS: use HTTPS locally (or localhost) so the browser can access the microphone.

What’s Implemented

- Realtime voice agent using WebRTC via OpenAI Realtime API.
- Frontend obtains an ephemeral client secret from `/api/client-secret` and connects directly from the browser.
- Audio input/output with VAD-based turn detection and input transcription enabled.
- Transcript panel shows “You:” (input transcription) and “AI:” (assistant output text).

Key Notes

- Model: `gpt-realtime-mini-2025-12-15` (pinned to avoid version drift).
- GA session config with `type: "realtime"`, `output_modalities: ["audio","text"]`.
- Input transcription model: `gpt-4o-transcribe` for user transcript display.
- The mic button toggles mute/unmute while connected; closing the tab or navigating away closes the session.
