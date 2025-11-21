import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const XAI_API_KEY = process.env.XAI_API_KEY;
const ALLOWED_DOMAINS = ['www.echigo.sake-harasho.com', 'echigo.sake-harasho.com'];
const client =
  XAI_API_KEY &&
  new OpenAI({
    apiKey: XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  });

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const parseMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowedRoles = new Set<ChatMessage['role']>(['user', 'assistant', 'system']);
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if (typeof role !== 'string' || typeof content !== 'string') {
        return null;
      }
      if (!allowedRoles.has(role as ChatMessage['role'])) {
        return null;
      }
      const trimmed = content.trim();
      if (!trimmed) {
        return null;
      }
      return { role: role as ChatMessage['role'], content: trimmed };
    })
    .filter((item): item is ChatMessage => Boolean(item));
};

const encoder = new TextEncoder();

const extractTextFromOutput = (output: unknown): string => {
  if (typeof output === 'string') {
    return output;
  }
  if (!Array.isArray(output)) {
    return '';
  }
  const text = output
    .flatMap((block) =>
      Array.isArray((block as { content?: unknown[] }).content)
        ? ((block as { content?: unknown[] }).content as unknown[])
        : [],
    )
    .filter((item) => (item as { type?: string })?.type === 'output_text')
    .map((item) => ((item as { text?: string }).text ?? '').trim())
    .join('\n')
    .trim();
  return text;
};

const extractTextFromResponse = (res: unknown): string => {
  if (!res || typeof res !== 'object') return '';
  const outputText = (res as { output_text?: string | null }).output_text;
  if (typeof outputText === 'string' && outputText.trim().length > 0) {
    return outputText.trim();
  }
  return extractTextFromOutput((res as { output?: unknown }).output);
};

const streamResponse = async (messages: ChatMessage[]) => {
  if (!client) {
    return NextResponse.json(
      { error: 'XAI_API_KEY is not configured on the server' },
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

      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(':\n\n')), 15000);
      let finalText = '';
      let finalCitations: string[] = [];
      let sentDone = false;
      try {
        const aiStream = await client.responses.create({
          model: 'grok-4-1-fast',
          input: messages,
          tools: [
            {
              type: 'web_search' as const,
              filters: { allowed_domains: ALLOWED_DOMAINS },
            },
          ],
          tool_choice: 'required',
          stream: true,
        });

        for await (const event of aiStream as AsyncIterable<Record<string, unknown>>) {
          const type = (event as { type?: string }).type ?? '';

          if (type === 'response.output_text.delta') {
            const delta = (event as { delta?: string }).delta ?? '';
            finalText += delta;
            send('delta', { delta });
            continue;
          }

          if (type === 'response.output_text.done') {
            const text = (event as { text?: string }).text;
            if (typeof text === 'string' && text.trim()) {
              finalText = text.trim();
            }
            continue;
          }

          if (type === 'response.reasoning_summary_text.delta') {
            const delta = (event as { delta?: string }).delta ?? '';
            if (delta) {
              send('reasoning', { delta });
            }
            continue;
          }

          if (type === 'response.web_search_call.searching') {
            const query = (event as { parameters?: { query?: string } }).parameters?.query;
            send('search', { status: 'searching', query });
            continue;
          }

          if (type === 'response.web_search_call.completed') {
            const query = (event as { parameters?: { query?: string } }).parameters?.query;
            send('search', { status: 'completed', query });
            continue;
          }

          if (type === 'response.done') {
            const resObj = (event as { response?: unknown }).response;
            const text = extractTextFromResponse(resObj);
            if (text) {
              finalText = text;
            }
            const cits = (resObj as { citations?: unknown })?.citations;
            if (Array.isArray(cits) && cits.every((c) => typeof c === 'string')) {
              finalCitations = cits as string[];
            }
            send('done', { text: finalText, citations: finalCitations });
            sentDone = true;
          }
        }
      } catch (err) {
        console.error('[grok-chat] stream failed', err);
        const message = err instanceof Error ? err.message : 'stream error';
        send('error', { message });
      } finally {
        clearInterval(keepAlive);
        if (!sentDone && finalText) {
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({
                text: finalText,
                citations: finalCitations,
              })}\n\n`,
            ),
          );
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
};

export async function POST(req: NextRequest) {
  let messages: ChatMessage[] = [];
  try {
    const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
    messages = parseMessages(body?.messages);
  } catch {
    // ignore: handled by validation below
  }

  if (messages.length === 0) {
    return NextResponse.json(
      { error: 'messages payload is required and must contain at least one entry' },
      { status: 400 },
    );
  }

  const wantsStream =
    (req.headers.get('accept')?.includes('text/event-stream') ?? false) ||
    new URL(req.url).searchParams.get('stream') === '1';

  if (wantsStream) {
    return streamResponse(messages);
  }

  if (!client) {
    return NextResponse.json(
      { error: 'XAI_API_KEY is not configured on the server' },
      { status: 500 },
    );
  }

  try {
    const response = await client.responses.create({
      model: 'grok-4-1-fast',
      input: messages,
      tools: [
        {
          type: 'web_search' as const,
          filters: { allowed_domains: ALLOWED_DOMAINS },
        },
      ],
      tool_choice: 'required',
    });

    const textOutput = extractTextFromResponse(response);
    const citations =
      Array.isArray((response as { citations?: unknown }).citations) &&
      (response as { citations?: unknown[] }).citations?.every((item) => typeof item === 'string')
        ? ((response as { citations?: string[] }).citations ?? [])
        : [];

    return NextResponse.json({
      reply: textOutput || '（応答が空でした。もう一度お試しください）',
      citations,
    });
  } catch (err) {
    console.error('[grok-chat] request failed', err);
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
