import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase';
import { mapGiftRecommendationPayload } from '@/lib/giftRecommendation';
import { normalizeIntakeSummary } from '@/lib/giftIntake';
import GiftManager from '@/components/GiftManager';
import type { GiftStatus, GiftDashboardItem } from '@/types/gift';

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
  gift_recommendations:
    | {
        recommendations: unknown;
        model: string | null;
        created_at: string;
      }
    | Array<{
        recommendations: unknown;
        model: string | null;
        created_at: string;
      }>
    | null;
  gift_sessions: Array<{
    id: string;
    intake_summary: unknown;
    started_at: string;
    completed_at: string | null;
    age_confirmed: boolean;
  }> | null;
};

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

    const recommendationEntries = Array.isArray(gift.gift_recommendations)
      ? gift.gift_recommendations
      : gift.gift_recommendations
        ? [gift.gift_recommendations]
        : [];
    const latestRecommendation =
      recommendationEntries
        .slice()
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0] ?? null;
    const recommendationRecord = latestRecommendation?.recommendations ?? null;
    const recommendationCreatedAt = latestRecommendation?.created_at ?? null;
    const recommendationModel = latestRecommendation?.model ?? null;
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
