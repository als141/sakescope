import {
  SakeRecommendation,
  UserPreferenceProfile,
  Sake,
} from '@/domain/sake/types';
import { SakeRepository } from '@/application/ports/SakeRepository';

export class RecommendationService {
  constructor(private readonly repository: SakeRepository) {}

  async recommend(
    profile: UserPreferenceProfile
  ): Promise<SakeRecommendation[]> {
    return this.repository.recommendByPreferences(profile);
  }

  async getById(id: string): Promise<Sake | undefined> {
    return this.repository.findById(id);
  }
}
