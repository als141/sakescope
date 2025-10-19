import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { IntakeSummary } from '@/types/gift';

const messageSchema = z.object({
  sessionId: z.string().uuid(),
  giftId: z.string().uuid(),
  message: z.string().min(1),
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GIFT_MODEL = process.env.OPENAI_GIFT_MODEL ?? 'gpt-5-mini';

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not configured');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// System prompt for gift conversation - never mentions budget/price
const GIFT_SYSTEM_PROMPT = `あなたは日本酒のギフト選びをサポートする親しみやすいアシスタントです。

## 目的
受け手の方とさり気ない会話を通じて、日本酒の好みを聞き出します。集めた情報は送り主にのみ伝えられ、最適なギフトを選ぶために使用されます。

## 重要なルール
1. **予算や価格については絶対に言及しない、質問しない**
2. 個人情報（フルネーム、住所など）は聞かない
3. 自然で親しみやすい会話を心がける
4. 5〜7回の質問で十分な情報を集める

## 聞き出す情報
- 味わいの好み（辛口/甘口/バランス型）
- 香りの好み（フルーティー/芳醇/すっきり）
- 飲む頻度・シーン
- 好きな温度帯（冷酒/常温/熱燗）
- 好きな料理・つまみ
- 好きな地域・銘柄（あれば）
- その他の嗜好

## 会話の進め方
1. 最初は一般的な質問から（「普段どんなお酒がお好きですか？」）
2. 回答に応じて掘り下げる
3. 十分な情報が集まったら、会話を自然に終わらせる

## 判断基準
以下の情報が揃ったら、会話を終了してください：
- 味わいの傾向（辛口/甘口）
- 香りや風味の好み
- 飲むシーンや温度帯
- 料理との相性

情報が揃ったら、「素敵な日本酒が見つかりそうですね」のような肯定的な締めくくりをして、
次のメッセージで **"[HANDOFF]"** というキーワードを含めてください。`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, giftId, message } = messageSchema.parse(body);

    const supabase = createServerSupabaseClient();

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from('gift_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('gift_id', giftId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 404 }
      );
    }

    // Check if session is already completed
    if (session.completed_at) {
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 400 }
      );
    }

    // Save user message
    await supabase.from('gift_messages').insert({
      session_id: sessionId,
      role: 'user',
      content: message,
    });

    // Get conversation history
    const { data: messagesData } = await supabase
      .from('gift_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: GIFT_SYSTEM_PROMPT },
      ...(messagesData || []).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    ];

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: GIFT_MODEL,
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantResponse = completion.choices[0]?.message?.content ||
      'すみません、もう一度お願いできますか？';

    // Save assistant message
    await supabase.from('gift_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: assistantResponse,
    });

    // Check if handoff should occur
    const shouldHandoff = assistantResponse.includes('[HANDOFF]');

    let intakeSummary: IntakeSummary | null = null;

    if (shouldHandoff) {
      // Extract intake summary from conversation
      const summaryPrompt = `以下の会話から、日本酒の好みを構造化データとして抽出してください。

会話履歴:
${messagesData?.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

以下のJSON形式で返してください:
{
  "aroma": ["フルーティー", "芳醇", "すっきり" のいずれか],
  "taste_profile": ["味わいの特徴"],
  "sweetness_dryness": "辛口/甘口/バランス型",
  "temperature_preference": ["冷酒", "常温", "熱燗"],
  "food_pairing": ["好きな料理やつまみ"],
  "drinking_frequency": "頻度の説明",
  "region_preference": ["好きな地域"],
  "notes": "その他の重要な情報"
}`;

      const summaryCompletion = await openai.chat.completions.create({
        model: GIFT_MODEL,
        messages: [{ role: 'user', content: summaryPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const summaryText = summaryCompletion.choices[0]?.message?.content;
      if (summaryText) {
        try {
          intakeSummary = JSON.parse(summaryText) as IntakeSummary;
        } catch (e) {
          console.error('Failed to parse intake summary:', e);
        }
      }

      // Update session with intake summary and mark as completed
      await supabase
        .from('gift_sessions')
        .update({
          intake_summary: intakeSummary,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      // Update gift status
      await supabase
        .from('gifts')
        .update({
          status: 'INTAKE_COMPLETED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', giftId);
    }

    // Remove [HANDOFF] marker from response
    const cleanResponse = assistantResponse.replace('[HANDOFF]', '').trim();

    return NextResponse.json({
      response: cleanResponse,
      shouldHandoff,
      intakeSummary,
    });
  } catch (error) {
    console.error('Error in gift session message:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
