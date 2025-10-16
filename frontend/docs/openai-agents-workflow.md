## Realtime Voice × Text Agents workflow

1. **Voice intake** – the WebRTC session (`RealtimeSession`) runs with the voice-oriented `RealtimeAgent`.  
2. **Preference acquisition** – the voice agent collects profile data and calls `find_sake_recommendations` to ground choices on our structured catalog (fallback-able).  
3. **Task delegation** – when the guest requests deeper research or purchase options, the voice agent uses the handoff tool `transfer_to_text_worker` (backed by the `textWorkerAgent`).  
4. **Research loop** – the text worker executes these tools in a ReAct-style loop:
   - `lookup_sake_profile`: fetch canonical data from our repository.  
   - Hosted `web_search`: query public sources (model-side execution) for retailers, reviews, and pricing.  
   - `submit_purchase_recommendation`: push a structured JSON payload (sake metadata, tasting cues, shop listings, summary) back into the app.  
5. **UI update** – the submit tool triggers the runtime callback, which updates state in `VoiceChat` and surfaces the offer in `SakeDisplay`.  
6. **Voice follow-up** – after receiving the tool output, the voice agent explains findings, handles follow-up questions, or loops additional research as needed.  

### Agent configuration

- Voice agent  
  - Model: `gpt-realtime-mini` (session attached to client secret).  
  - Tools: `find_sake_recommendations` (function tool), `transfer_to_text_worker` (handoff).  

- Text worker agent  
  - Model: `gpt-5-mini` via `OpenAIResponsesModel`.  
  - Tools: `lookup_sake_profile`, hosted `web_search`, `submit_purchase_recommendation`.  
  - Instructions emphasise citing sources and always returning a `submit_purchase_recommendation` call once the research pass is complete.  

### Domain callbacks

`AgentRuntimeContext.callbacks` now carries:

- `onRecommendations` – hydrate base sake choice.  
- `onOfferReady` – accept full purchase offering (summary + shops) for UI.  
- `onError` – surface operational issues.  

### Safety & monitoring

- Realtime session tracing stays enabled by default for diagnostics.  
- Web search tool usage is scoped through provider filters (whitelisted domains optional).  
- TODO: add guardrails (age checks, disclaimers) and persist trace IDs for auditing.  
