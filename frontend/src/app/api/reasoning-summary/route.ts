import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TRANSLATION_MODEL =
  process.env.REASONING_SUMMARY_TRANSLATE_MODEL ?? 'gpt-5.1-nano';

const requestSchema = z.object({
  summary: z.string().min(1).max(4000),
});

const collectOutputText = (output: unknown): string => {
  if (!Array.isArray(output)) {
    return '';
  }
  const texts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        'type' in block &&
        (block as { type?: string }).type === 'output_text'
      ) {
        const text = (block as { text?: unknown }).text;
        if (typeof text === 'string' && text.trim().length > 0) {
          texts.push(text.trim());
        }
      }
    }
  }
  return texts.join('\n').trim();
};

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key is not configured.' },
      { status: 500 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const response = await openai.responses.create({
      model: TRANSLATION_MODEL,
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You are a translation assistant. Translate the provided reasoning summary into natural Japanese, keeping key nouns and technical names as-is. Respond with Japanese text only.',
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: parsed.data.summary }],
        },
      ],
    });

    const translation = collectOutputText(response.output ?? []);
    if (!translation) {
      throw new Error('No translation text returned.');
    }

    return NextResponse.json({ translation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Translation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
