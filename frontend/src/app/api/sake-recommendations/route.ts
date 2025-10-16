import { NextRequest, NextResponse } from 'next/server';
import { RecommendationService } from '@/application/services/RecommendationService';
import { InMemorySakeRepository } from '@/infrastructure/repositories/InMemorySakeRepository';

const repository = new InMemorySakeRepository();
const recommendationService = new RecommendationService(repository);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      flavor_preference,
      body_preference,
      price_range,
      food_pairing,
    } = body;

    const recommendations = await recommendationService.recommend({
      flavorPreference: flavor_preference ?? 'balanced',
      bodyPreference: body_preference ?? 'medium',
      priceRange: price_range ?? 'mid',
      foodPairing: food_pairing ?? undefined,
    });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Error getting sake recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}
