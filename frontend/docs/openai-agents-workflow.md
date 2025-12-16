## Realtime Voice × Text Agents workflow

1. **Voice intake** – the WebRTC session (`RealtimeSession`) runs with the voice-oriented `RealtimeAgent`.  
2. **Preference acquisition** – the voice agent gathers flavour, body, budget, and pairing cues through conversation.  
3. **Task delegation** – once ready (or when the guest asks for pricing/links), the voice agent calls the single function tool `recommend_sake`, passing a natural-language summary of the conversation (and optional metadata such as extracted preferences). The payload is forwarded to `/api/text-worker` together with the shared trace ID.  
4. **Research loop** – the server text worker (Agents SDK + `gpt-5-mini`) orchestrates a ReAct loop:
   - Hosted `web_search` gathers product facts, availability, and pricing from trusted retailers.  
   - Intermediate reasoning turns evaluate candidates and, if needed, repeat searches until a confident match is found.  
   - `finalize_recommendation` consolidates the primary pick (full schema) and lightweight alternatives (name + 1行要約 + URL/価格メモ) into the JSON payload consumed by the UI.  
5. **UI update** – the browser tool `submit_purchase_recommendation` parses the JSON payload, hydrates the domain models, and refreshes `SakeDisplay` with live offers.  
6. **Voice follow-up** – the voice agent summarises results, cites sources, honours follow-up prompts, and re-invokes `recommend_sake` for refinements (e.g., different budget, other retailers).  

### Agent configuration

- Voice agent  
  - Model: `gpt-realtime-mini-2025-12-15` (session established via ephemeral client secret).  
  - Tools: `recommend_sake` — the only callable function; everything else (UI submission) is handled locally after the server response.  

- Text worker agent (server-side API)  
  - Model: `gpt-5-mini` via `OpenAIResponsesModel`.  
  - Tools: hosted `web_search`, `finalize_recommendation`.  
  - Instructions stress multi-source verification, pricing transparency, and always finishing with a single `finalize_recommendation` call.  
  - Latency levers: set `TEXT_AGENT_REASONING_EFFORT` (`minimal`/`low`/`medium`/`high`, default `low`) and `TEXT_AGENT_VERBOSITY` (`low`/`medium`/`high`, default `low`) to tune the Responses API `reasoning` + `text.verbosity` settings for GPT-5. Lower settings keep the model terse and reduce reasoning tokens. `TEXT_AGENT_REASONING_SUMMARY` (`auto`/`concise`/`detailed`, default `detailed`) controls how the model emits reasoning summaries so we can mirror that text in the realtime UI. The realtime subtitles call `/api/reasoning-summary` which translates the summary via `REASONING_SUMMARY_TRANSLATE_MODEL` (defaults to `gpt-5.1-nano`) using low reasoning/verbosity settings.

### Domain callbacks

`AgentRuntimeContext.callbacks` now carries:

- `onSakeProfile` – merge the latest sake metadata into view state.  
- `onShopsUpdated` – toggle loading / delegation indicators.  
- `onOfferReady` – publish the final structured offer to the UI.  
- `onError` – surface operational issues.  

### Safety & monitoring

- Realtime session tracing stays enabled by default for diagnostics.  
- Every delegation shares a trace group ID so the voice session and text worker runs appear in the same Agents SDK trace.  
- Web search tool usage is scoped through provider filters (whitelisted domains optional).  
- TODO: add guardrails (age checks, disclaimers) and persist trace IDs for auditing.  
