## Realtime Voice × Text Agents workflow

1. **Voice intake** – the WebRTC session (`RealtimeSession`) runs with the voice-oriented `RealtimeAgent`.  
2. **Preference acquisition** – the voice agent gathers flavour, body, budget, and pairing cues through conversation.  
3. **Task delegation** – once準備が整うと、ボイスエージェントは公式 handoff `recommend_sake` を呼び出し、会話サマリーや抽出した嗜好メタデータを引き継ぎます。ハンドオフ先のフォローアップエージェントが感謝と今後の流れを伝えつつ、同じトレースIDで `/api/text-worker` に非同期リクエストを送信します。  
4. **Research loop** – the server text worker (Agents SDK + `gpt-5-mini`) orchestrates a ReAct loop:
   - Hosted `web_search` gathers product facts, availability, and pricing from trusted retailers.  
   - Intermediate reasoning turns evaluate candidates and, if needed, repeat searches until a confident match is found.  
   - `finalize_recommendation` consolidates the primary pick, alternative options, and retail offers into the JSON schema consumed by the UI.  
5. **UI update** – the browser tool `submit_purchase_recommendation` parses the JSON payload, hydrates the domain models, and refreshes `SakeDisplay` with live offers.  
6. **Voice follow-up** – the voice agent summarises results, cites sources, honours follow-up prompts, and re-invokes `recommend_sake` for refinements (e.g., different budget, other retailers).  

### Agent configuration

- Voice agent  
  - Model: `gpt-realtime-mini` (session established via ephemeral client secret).  
  - Handoffs: `recommend_sake` — 会話サマリーをテキストエージェントへ渡し、フォローアップエージェントに制御を切り替える公式 handoff。UI 反映はブラウザ側コールバックが担当。  

- Text worker agent (server-side API)  
  - Model: `gpt-5-mini` via `OpenAIResponsesModel`.  
  - Tools: hosted `web_search`, `finalize_recommendation`.  
  - Instructions stress multi-source verification, pricing transparency, and always finishing with a single `finalize_recommendation` call.  

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
