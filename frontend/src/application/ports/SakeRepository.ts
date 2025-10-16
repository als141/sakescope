import {
  Sake,
  SakeId,
  UserPreferenceProfile,
  SakeRecommendation,
} from '@/domain/sake/types';

export interface SakeRepository {
  findAll(): Promise<Sake[]>;
  findById(id: SakeId): Promise<Sake | undefined>;
  recommendByPreferences(
    preferences: UserPreferenceProfile
  ): Promise<SakeRecommendation[]>;
}
