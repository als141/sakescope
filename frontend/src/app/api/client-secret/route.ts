import { NextRequest, NextResponse } from 'next/server';

// Ensure no caching and Node runtime for external fetch
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Keep payload minimal to avoid validation issues
    const sessionConfig = {
      session: {
        type: "realtime",
        model: "gpt-realtime",
        instructions: `あなたは日本酒の専門知識を持つ親しみやすいAIソムリエです。
        
        ## あなたの役割
        - 日本酒を愛する情熱的なソムリエとして、お客様の好みや要望を聞き取る
        - 対話を通じてお客様の好みを理解し、最適な日本酒を推薦する
        - 日本酒の知識を分かりやすく、楽しく伝える
        
        ## 対話の流れ
        1. まず挨拶をして、お客様がどのような日本酒をお探しかを尋ねる
        2. 以下の項目について質問して好みを把握する：
           - 味の好み（辛口・甘口・バランス型）
           - ボディの好み（軽快・中程度・濃厚）
           - 価格帯（お手頃・中価格帯・高級）
           - 一緒に楽しむ料理
           - 飲む場面・シーン
        3. 情報が十分集まったら、find_sake_recommendations関数を呼び出す
        4. 推薦された日本酒を詳しく紹介し、なぜその日本酒がおすすめなのかを説明する
        
        ## 話し方
        - 親しみやすく、専門知識を持ちながらも堅苦しくない
        - 日本酒の魅力を伝える情熱を持って話す
        - 相手の話をよく聞き、質問を通じて理解を深める
        - 日本酒の専門用語は分かりやすく説明する`,
        audio: {
          output: { voice: "alloy" }
        },
        tools: [
          {
            type: "function",
            name: "find_sake_recommendations",
            description: "お客様の好みに基づいて日本酒を推薦します",
            parameters: {
              type: "object",
              strict: true,
              properties: {
                flavor_preference: {
                  type: "string",
                  enum: ["dry", "sweet", "balanced"],
                  description: "味の好み: dry(辛口), sweet(甘口), balanced(バランス型)"
                },
                body_preference: {
                  type: "string", 
                  enum: ["light", "medium", "rich"],
                  description: "ボディの好み: light(軽快), medium(中程度), rich(濃厚)"
                },
                price_range: {
                  type: "string",
                  enum: ["budget", "mid", "premium"],
                  description: "価格帯: budget(お手頃), mid(中価格帯), premium(高級)"
                },
                food_pairing: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "一緒に楽しむ料理のリスト"
                }
              },
              required: ["flavor_preference", "body_preference", "price_range"]
            }
          }
        ],
        tool_choice: "auto"
      }
    };

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create client secret', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating client secret:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
