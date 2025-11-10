import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    const { data: account, error: accountError } = await supabase
      .from('user_line_accounts')
      .select('line_user_id, display_name, friend_flag, linked_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (accountError) {
      console.error('Failed to fetch LINE account', accountError);
      return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    const { data: pending } = await supabase
      .from('line_link_nonces')
      .select('nonce, expires_at')
      .eq('user_id', userId)
      .gt('expires_at', nowIso)
      .maybeSingle();

    return NextResponse.json({
      account: account ?? null,
      pending: pending ?? null,
    });
  } catch (error) {
    console.error('Error fetching LINE link status', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
