import type { Sake, PurchaseOffer } from '@/domain/sake/types';

export interface SakeHistoryItem {
  id: string;
  sake: Sake;
  offer: PurchaseOffer | null;
  timestamp: number;
}

const STORAGE_KEY = 'sake_recommendation_history';
const MAX_HISTORY_ITEMS = 50;

/**
 * レコメンドされた日本酒の履歴をlocalStorageに保存・取得するユーティリティ
 */
export class SakeHistoryStorage {
  /**
   * 履歴を全て取得（新しい順）
   */
  static getHistory(): SakeHistoryItem[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const items = JSON.parse(data) as SakeHistoryItem[];
      return items.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to load sake history:', error);
      return [];
    }
  }

  /**
   * 新しい日本酒を履歴に追加
   */
  static addToHistory(sake: Sake, offer: PurchaseOffer | null): void {
    if (typeof window === 'undefined') return;

    try {
      const history = this.getHistory();
      
      // 同じ名前の日本酒が既に存在する場合は削除（重複を避ける）
      const filteredHistory = history.filter(
        (item) => item.sake.name !== sake.name
      );

      // 新しいアイテムを追加
      const newItem: SakeHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sake,
        offer,
        timestamp: Date.now(),
      };

      filteredHistory.unshift(newItem);

      // 最大件数を超えた場合は古いものを削除
      const limitedHistory = filteredHistory.slice(0, MAX_HISTORY_ITEMS);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));
    } catch (error) {
      console.error('Failed to save sake history:', error);
    }
  }

  /**
   * 特定のIDの履歴アイテムを取得
   */
  static getItemById(id: string): SakeHistoryItem | null {
    const history = this.getHistory();
    return history.find((item) => item.id === id) || null;
  }

  /**
   * 特定のIDの履歴アイテムを削除
   */
  static removeItem(id: string): void {
    if (typeof window === 'undefined') return;

    try {
      const history = this.getHistory();
      const filtered = history.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove sake history item:', error);
    }
  }

  /**
   * 履歴を全てクリア
   */
  static clearHistory(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear sake history:', error);
    }
  }
}
