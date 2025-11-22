import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WORKFLOW_ID =
  process.env.TEXT_CHATKIT_WORKFLOW_ID ??
  process.env.NEXT_PUBLIC_TEXT_CHATKIT_WORKFLOW_ID;
const SESSION_URL = 'https://api.openai.com/v1/chatkit/sessions';
const DEFAULT_TTL_SECONDS = 9 * 60; // 9 minutes (API上限600秒未満で安全域)

async function createChatKitSession() {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured on the server' },
      { status: 500 },
    );
  }

  if (!WORKFLOW_ID) {
    return NextResponse.json(
      { error: 'TEXT_CHATKIT_WORKFLOW_ID is not configured' },
      { status: 500 },
    );
  }

  const userId = `sakescope-web-${randomUUID()}`;
  const expiresIn = Number(
    Math.min(
      Number(process.env.TEXT_CHATKIT_CLIENT_SECRET_TTL ?? DEFAULT_TTL_SECONDS),
      600,
    ),
  );

  const response = await fetch(SESSION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'chatkit_beta=v1',
    },
    body: JSON.stringify({
      workflow: { id: WORKFLOW_ID },
      user: userId,
      expires_after: { anchor: 'created_at', seconds: expiresIn },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('ChatKit session create failed', detail);
    return NextResponse.json(
      { error: 'Failed to create ChatKit session', detail },
      { status: response.status || 502 },
    );
  }

  const data = await response.json();
  return NextResponse.json({
    client_secret: data.client_secret ?? data.clientSecret,
    expires_in: data.expires_in ?? expiresIn,
  });
}

export async function POST() {
  return createChatKitSession();
}
