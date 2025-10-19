import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase';
import { mapGiftRecommendationPayload } from '@/lib/giftRecommendation';
import GiftManager from '@/components/GiftManager';
import type { GiftStatus, IntakeSummary, GiftDashboardItem } from '@/types/gift';

type SupabaseGiftRecord = {
  id: string;
  recipient_first_name: string | null;
  occasion: string | null;
  budget_min: number;
  budget_max: number;
  message_to_recipient: string | null;
  status: GiftStatus;
  created_at: string;
  updated_at: string;
  gift_recommendations: {
    recommendations: unknown;
    model: string | null;
    created_at: string;
  } | null;
  gift_sessions: Array<{
    id: string;
    intake_summary: unknown;
    started_at: string;
    completed_at: string | null;
    age_confirmed: boolean;
  }> | null;
};

function normalizeIntakeSummary(data: unknown): IntakeSummary | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  const summary: IntakeSummary = {};

  if (Array.isArray(record.aroma)) {
    const aroma = record.aroma.filter((item): item is string => typeof item === 'string');
    if (aroma.length > 0) summary.aroma = aroma;
  }

  if (Array.isArray(record.taste_profile)) {
    const taste = record.taste_profile.filter(
      (item): item is string => typeof item === 'string',
    );
    if (taste.length > 0) summary.taste_profile = taste;
  }

  if (typeof record.sweetness_dryness === 'string') {
    summary.sweetness_dryness = record.sweetness_dryness;
  }

  if (Array.isArray(record.temperature_preference)) {
    const temps = record.temperature_preference.filter(
      (item): item is string => typeof item === 'string',
    );
    if (temps.length > 0) summary.temperature_preference = temps;
  }

  if (Array.isArray(record.food_pairing)) {
    const foods = record.food_pairing.filter(
      (item): item is string => typeof item === 'string',
    );
    if (foods.length > 0) summary.food_pairing = foods;
  }

  if (typeof record.drinking_frequency === 'string') {
    summary.drinking_frequency = record.drinking_frequency;
  }

  if (Array.isArray(record.region_preference)) {
    const regions = record.region_preference.filter(
      (item): item is string => typeof item === 'string',
    );
    if (regions.length > 0) summary.region_preference = regions;
  }

  if (typeof record.notes === 'string') {
    summary.notes = record.notes;
  }

  return Object.keys(summary).length > 0 ? summary : null;
}

export default async function GiftDashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect_url=/gift');
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('gifts')
    .select(
      `
        id,
        recipient_first_name,
        occasion,
        budget_min,
        budget_max,
        message_to_recipient,
        status,
        created_at,
        updated_at,
        gift_recommendations (
          recommendations,
          model,
          created_at
        ),
        gift_sessions (
          id,
          intake_summary,
          started_at,
          completed_at,
          age_confirmed
        )
      `,
    )
    .eq('sender_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load gifts dashboard:', error);
    throw new Error('ギフト情報の取得に失敗しました。');
  }

  const gifts: GiftDashboardItem[] = (data as SupabaseGiftRecord[] | null)?.map((gift) => {
    const sessions = Array.isArray(gift.gift_sessions) ? gift.gift_sessions : [];
    const latestSession = sessions
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.completed_at ?? a.started_at).getTime();
        const bTime = new Date(b.completed_at ?? b.started_at).getTime();
        return bTime - aTime;
      })[0];

    const recommendationRecord = gift.gift_recommendations?.recommendations ?? null;
    const recommendationCreatedAt = gift.gift_recommendations?.created_at ?? null;
    const recommendationModel = gift.gift_recommendations?.model ?? null;
    const recommendation = mapGiftRecommendationPayload(
      recommendationRecord,
      recommendationCreatedAt ?? undefined,
    );

    return {
      id: gift.id,
      recipientFirstName: gift.recipient_first_name,
      occasion: gift.occasion,
      budgetMin: gift.budget_min,
      budgetMax: gift.budget_max,
      messageToRecipient: gift.message_to_recipient,
      status: gift.status,
      createdAt: gift.created_at,
      updatedAt: gift.updated_at,
      intakeSummary: normalizeIntakeSummary(latestSession?.intake_summary ?? null),
      intakeCompletedAt: latestSession?.completed_at ?? null,
      ageConfirmed: latestSession?.age_confirmed ?? false,
      recommendation,
      recommendationCreatedAt,
      recommendationModel,
    };
  }) ?? [];

  return <GiftManager gifts={gifts} />;
}
