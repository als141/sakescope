import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { hashToken } from '@/lib/tokenUtils';
import type { ValidateTokenResponse } from '@/types/gift';

const validateTokenSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const { token } = validateTokenSchema.parse(body);

    // Hash the token
    const tokenHash = await hashToken(token);

    // Create server-side Supabase client
    const supabase = createServerSupabaseClient();

    // Look up token
    const { data: tokenData, error: tokenError } = await supabase
      .from('gift_tokens')
      .select('gift_id, expires_at, consumed_at')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json<ValidateTokenResponse>(
        { valid: false, error: 'Invalid token' },
        { status: 404 }
      );
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);

    if (now > expiresAt) {
      return NextResponse.json<ValidateTokenResponse>(
        { valid: false, error: 'Token has expired' },
        { status: 410 }
      );
    }

    // Check if token has already been consumed
    if (tokenData.consumed_at) {
      return NextResponse.json<ValidateTokenResponse>(
        { valid: false, error: 'Token has already been used' },
        { status: 410 }
      );
    }

    // Mark token as consumed
    const { error: updateError } = await supabase
      .from('gift_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    if (updateError) {
      console.error('Error updating token:', updateError);
      return NextResponse.json<ValidateTokenResponse>(
        { valid: false, error: 'Failed to consume token' },
        { status: 500 }
      );
    }

    // Update gift status
    await supabase
      .from('gifts')
      .update({ status: 'OPENED', updated_at: new Date().toISOString() })
      .eq('id', tokenData.gift_id);

    // Create a gift session
    const { data: session, error: sessionError } = await supabase
      .from('gift_sessions')
      .insert({
        gift_id: tokenData.gift_id,
        age_confirmed: false,
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json<ValidateTokenResponse>(
        { valid: false, error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json<ValidateTokenResponse>({
      valid: true,
      giftId: tokenData.gift_id,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error validating token:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json<ValidateTokenResponse>(
        { valid: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json<ValidateTokenResponse>(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
