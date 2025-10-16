import { NextResponse } from 'next/server';
import { createVoiceAgent } from '@/infrastructure/openai/agents/voiceAgentFactory';
import type { FunctionTool } from '@openai/agents-core';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-mini';

type ToolManifest = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};

function buildToolManifest(): ToolManifest[] {
  const agent = createVoiceAgent();
  const tools = agent.tools ?? [];
  return tools
    .filter((tool): tool is FunctionTool => tool.type === 'function')
    .map((tool) => ({
      type: 'function' as const,
      name: tool.name ?? 'tool',
      description: tool.description ?? '',
      parameters: (tool.parameters ?? {
        type: 'object',
        properties: {},
        required: [],
      }) as unknown as Record<string, unknown>,
      strict: tool.strict ? true : undefined,
    }));
}

function buildInstructions(): string {
  const agent = createVoiceAgent();
  return typeof agent.instructions === 'string'
    ? agent.instructions
    : 'You are a helpful sake sommelier.';
}

export async function POST() {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  try {
    const sessionConfig = {
      session: {
        type: 'realtime',
        model: REALTIME_MODEL,
        instructions: buildInstructions(),
        audio: {
          output: { voice: 'alloy' },
        },
        tools: buildToolManifest(),
        tool_choice: 'auto',
      },
    };

    const response = await fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionConfig),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create client secret', details: errorData },
        { status: response.status }
      );
    }

    const data: Record<string, unknown> = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating client secret:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
