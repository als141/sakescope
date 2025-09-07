import { NextRequest, NextResponse } from 'next/server';
import { getSakeRecommendations } from '@/data/sakeData';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flavor_preference, body_preference, price_range, food_pairing } = body;

    const recommendations = getSakeRecommendations({
      flavor_preference,
      body_preference,
      price_range,
      food_pairing
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