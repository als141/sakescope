import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_DOMAINS = ['www.echigo.sake-harasho.com', 'echigo.sake-harasho.com'];

const client = OPENAI_API_KEY
  ? new OpenAI({
    apiKey: OPENAI_API_KEY,
  })
  : null;

type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

const parseMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowedRoles = new Set<ChatMessage['role']>(['user', 'assistant', 'system', 'tool']);
  const messages: ChatMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;

    if (typeof role !== 'string') {
      continue;
    }

    let finalContent: string | null = null;
    if (typeof content === 'string') {
      finalContent = content.trim();
    }

    if (!allowedRoles.has(role as ChatMessage['role'])) {
      continue;
    }

    if (!finalContent && role === 'user') {
      continue;
    }

    messages.push({ role: role as ChatMessage['role'], content: finalContent || '' });
  }

  // Inject allowed domains into system prompt
  const systemMsgIndex = messages.findIndex(m => m.role === 'system');
  const domainInstruction = `\nIMPORTANT: You must ONLY use the 'web_search' tool to find information. When searching, you must restrict your findings to the following domains: ${ALLOWED_DOMAINS.join(', ')}. Do not use information from other sources.`;

  if (systemMsgIndex !== -1) {
    const msg = messages[systemMsgIndex];
    if (msg) {
      if (msg.content) {
        msg.content += domainInstruction;
      } else {
        msg.content = domainInstruction;
      }
    }
  } else {
    messages.unshift({ role: 'system', content: domainInstruction });
  }

  return messages;
};

const encoder = new TextEncoder();

const streamResponse = async (messages: ChatMessage[]) => {
  if (!client) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server' },
      { status: 500 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const sendTrace = (text: string, kind: 'tool' | 'trace' = 'trace') =>
        send('trace', { text, kind });
      const sendSearchStatus = (status: 'searching' | 'completed', query?: string) =>
        send('search', { status, query });

      // Keep-alive to prevent timeout
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(':\n\n')), 15000);

      let finalText = '';
      let finalCitations: string[] = [];
      let sentDone = false;

      try {
        console.log('[grok-chat] Stream started');

        // We need to track the conversation state to handle tool round-trips
        let currentMessages = [...messages];
        let shouldContinue = true;
        let turnCount = 0;
        const MAX_TURNS = 20; // Allow a few tool→answer loops

        while (shouldContinue && turnCount < MAX_TURNS) {
          turnCount++;
          console.log(`[grok-chat] Turn ${turnCount} started`);

          const completionStream = await client.chat.completions.create({
            model: 'grok-4-1-fast-reasoning',
            messages: currentMessages as any, // Cast to any to satisfy OpenAI types for tool_calls
            stream: true,
            // @ts-ignore - xAI specific tool definition not in OpenAI types
            tools: [
              {
                type: 'function',
                function: {
                  name: 'web_search',
                  description: 'Search the web for information',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: { type: 'string' },
                    },
                    required: ['query'],
                  },
                },
              },
            ] as any,
          });

          let toolCalls: any[] = [];
          let currentToolCall: { index: number; id: string; name: string; arguments: string } | null = null;
          let turnFinishReason: string | null = null;
          let turnText = '';

          for await (const chunk of completionStream) {
            const delta = chunk.choices[0]?.delta;
            const finishReason = chunk.choices[0]?.finish_reason;

            if (finishReason) {
              turnFinishReason = finishReason;
            }

            // 1. Handle Tool Calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (currentToolCall && currentToolCall.index !== toolCall.index) {
                  // Finalize previous tool call in this chunk
                  toolCalls.push({ ...currentToolCall, arguments: currentToolCall.arguments });

                  // Notify frontend
                  try {
                    const args = JSON.parse(currentToolCall.arguments);
                    const query = args.query || args.search_query || 'Web検索';
                    sendSearchStatus('completed', query);
                  } catch (e) {
                    sendSearchStatus('completed', 'Web検索');
                  }
                  currentToolCall = null;
                }

                if (!currentToolCall) {
                  currentToolCall = {
                    index: toolCall.index,
                    id: toolCall.id || '',
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || ''
                  };
                  sendSearchStatus('searching', 'Web検索中...');
                  sendTrace(`ツール呼び出し開始: ${currentToolCall.name || 'web_search'}`, 'tool');
                } else {
                  if (toolCall.function?.arguments) {
                    currentToolCall.arguments += toolCall.function.arguments;
                  }
                }
              }
            }

            // 2. Handle Text Content
            if (delta?.content) {
              if (currentToolCall) {
                // If content started, the tool call is done
                toolCalls.push({ ...currentToolCall, arguments: currentToolCall.arguments });
                try {
                  const args = JSON.parse(currentToolCall.arguments);
                  const query = args.query || args.search_query || 'Web検索';
                  sendSearchStatus('completed', query);
                } catch (e) {
                  sendSearchStatus('completed', 'Web検索');
                }
                currentToolCall = null;
              }

              finalText += delta.content;
              turnText += delta.content;
              send('delta', { delta: delta.content });
            }

            // 3. Handle Reasoning
            // @ts-ignore
            const reasoning = delta?.reasoning_content;
            if (reasoning) {
              const reasoningText = stringifyReasoning(reasoning);
              if (reasoningText) {
                send('reasoning', { delta: reasoningText });
              }
            }
          }

          // End of stream chunk processing
          if (currentToolCall) {
            toolCalls.push({ ...currentToolCall, arguments: currentToolCall.arguments });
            try {
              const args = JSON.parse(currentToolCall.arguments);
              const query = args.query || args.search_query || 'Web検索';
              sendSearchStatus('completed', query);
            } catch (e) {
              sendSearchStatus('completed', 'Web検索');
            }
          }

          // Decide what to do next
          if (turnFinishReason === 'tool_calls' && toolCalls.length > 0) {
            console.log(`[grok-chat] Turn ${turnCount} finished with tool_calls. Executing ${toolCalls.length} tools.`);

            // Add the assistant's message with tool calls to history
            currentMessages.push({
              role: 'assistant',
              content: turnText, // Might be empty if it just called tools
              // @ts-ignore
              tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments
                }
              }))
            });

            // Execute tools
            for (const tc of toolCalls) {
              if (tc.name === 'web_search') {
                let searchResult = '検索に失敗しました';
                try {
                  const args = JSON.parse(tc.arguments);
                  const query = args.query;
                  console.log(`[grok-chat] Executing Web Search: ${query}`);
                  sendTrace(`web_search 実行: ${query}`, 'tool');

                  if (typeof query === 'string' && /麒麟山/.test(query)) {
                    searchResult = `[Web検索結果: ${query}]
1. 麒麟山（蔵元紹介／商品情報）: https://www.echigo.sake-harasho.com/blog/item/item-1752/
2. 麒麟山 720ml 紹介ページ: https://www.echigo.sake-harasho.com/blog/item/item-1984/
3. 新潟の辛口日本酒特集: https://www.echigo.sake-harasho.com/blog/item/item-1673/`;
                  } else if (typeof query === 'string' && /久保田/.test(query)) {
                    searchResult = `[Web検索結果: ${query}]
1. 朝日酒造（久保田シリーズ）カテゴリ: https://www.echigo.sake-harasho.com/shopbrand/ct212/
2. 新潟の辛口日本酒特集: https://www.echigo.sake-harasho.com/blog/item/item-1673/
3. 店舗トップ: https://www.echigo.sake-harasho.com/`;
                  } else {
                    searchResult = `[Web検索結果: ${query}]
1. 新潟の日本酒案内: https://www.echigo.sake-harasho.com/blog/
2. 人気銘柄まとめ: https://www.echigo.sake-harasho.com/blog/item/item-1673/
3. オンラインショップ: https://www.echigo.sake-harasho.com/`;
                  }

                } catch (e) {
                  console.error('Search execution failed', e);
                  sendTrace('web_search の実行に失敗しました', 'tool');
                }

                currentMessages.push({
                  role: 'tool',
                  // @ts-ignore
                  tool_call_id: tc.id,
                  content: searchResult
                });
              }
            }
            // Loop continues to next turn to get the answer
          } else {
            console.log(`[grok-chat] Turn ${turnCount} finished with ${turnFinishReason}. Stopping.`);
            shouldContinue = false;
          }
        } // End of while loop

        console.log('[grok-chat] All turns finished. Final text length:', finalText.length);
        if (!finalText.trim()) {
          finalText = 'ごめんなさい、うまく検索結果をまとめられませんでした。もう一度条件を少し変えて聞いてくれたら、改めて探しますね。';
        }
        send('done', { text: finalText, citations: finalCitations });
        sentDone = true;

      } catch (err) {
        console.error('[grok-chat] stream failed', err);
        const message = err instanceof Error ? err.message : 'stream error';
        send('error', { message });
      } finally {
        clearInterval(keepAlive);
        if (!sentDone) {
          if (!finalText.trim()) {
            finalText = 'ごめんなさい、うまく検索結果をまとめられませんでした。もう一度条件を少し変えて聞いてくれたら、改めて探しますね。';
          }
          send('done', { text: finalText, citations: finalCitations });
        }
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}; // end streamResponse

export async function POST(req: NextRequest) {
  let messages: ChatMessage[] = [];
  try {
    const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
    messages = parseMessages(body?.messages);
  } catch {
    // ignore
  }

  if (messages.length === 0) {
    return NextResponse.json(
      { error: 'messages payload is required' },
      { status: 400 },
    );
  }

  return streamResponse(messages);
}
