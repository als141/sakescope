import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { generateToken, hashToken } from '@/lib/tokenUtils';
import type { CreateGiftRequest, CreateGiftResponse } from '@/types/gift';

const createGiftSchema = z.object({
  occasion: z.string().optional(),
  recipientFirstName: z.string().optional(),
  budgetMin: z.number().int().positive(),
  budgetMax: z.number().int().positive(),
  message: z.string().optional(),
}).refine((data) => data.budgetMax >= data.budgetMin, {
  message: 'budgetMax must be greater than or equal to budgetMin',
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate user with Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json() as CreateGiftRequest;
    const validatedData = createGiftSchema.parse(body);

    // Create server-side Supabase client (with service role)
    const supabase = createServerSupabaseClient();

    // Generate one-time token
    const token = generateToken(32);
    const tokenHash = await hashToken(token);

    // Set expiration to 72 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    // Insert gift record
    const { data: gift, error: giftError } = await supabase
      .from('gifts')
      .insert({
        sender_user_id: userId,
        recipient_first_name: validatedData.recipientFirstName || null,
        occasion: validatedData.occasion || null,
        budget_min: validatedData.budgetMin,
        budget_max: validatedData.budgetMax,
        message_to_recipient: validatedData.message || null,
        status: 'LINK_CREATED',
      })
      .select()
      .single();

    if (giftError || !gift) {
      console.error('Error creating gift:', giftError);
      return NextResponse.json(
        { error: 'Failed to create gift', details: giftError?.message },
        { status: 500 }
      );
    }

    // Insert token record
    const { error: tokenError } = await supabase
      .from('gift_tokens')
      .insert({
        gift_id: gift.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('Error creating gift token:', tokenError);
      // Rollback: delete the gift
      await supabase.from('gifts').delete().eq('id', gift.id);
      return NextResponse.json(
        { error: 'Failed to create gift token', details: tokenError.message },
        { status: 500 }
      );
    }

    // Generate share URL
    const origin = req.nextUrl.origin;
    const shareUrl = `${origin}/gift/${token}`;

    const response: CreateGiftResponse = {
      giftId: gift.id,
      shareUrl,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error in gift creation:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
