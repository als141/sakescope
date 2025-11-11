# ギフト機能 - 実装概要

## 概要

Sakescopeのギフト機能は、日本酒をプレゼントしたい送り手が、受け手の嗜好をさりげなく聞き取り、最適な日本酒を推薦する機能です。

## 主要な特徴

### 1. プライバシー保護
- **予算の秘匿**: 予算は受け手に一切表示されず、会話でも言及されません
- **匿名アクセス**: 受け手はログイン不要でアクセス可能
- **最小限の情報収集**: 個人を特定できる情報は収集しません

### 2. ワンタイムURL
- 72時間の有効期限
- 一度のみ使用可能
- SHA-256ハッシュでトークンを安全に保存

### 3. さりげない嗜好収集
- AIアシスタントが自然な会話で好みを聞き出す
- 価格や予算には一切触れない
- 5〜7回の質問で十分な情報を収集

### 4. 送り手のみに結果通知
- テキストエージェントが最適な日本酒を推薦
- 結果は送り手にのみ表示
- 受け手には何も通知されない

## アーキテクチャ

```
送り手 (Clerk認証)
  ↓
ギフト作成API
  ↓
ワンタイムURL生成
  ↓
受け手 (匿名)
  ↓
トークン検証
  ↓
会話セッション
  ↓
嗜好収集
  ↓
ハンドオフ
  ↓
テキストワーカー (ギフトモード)
  ↓
推薦結果 → 送り手のみ
```

## データフロー

### 1. ギフト作成フロー

```typescript
POST /api/gift/create
{
  occasion: "父の日",
  recipientFirstName: "お父さん",
  budgetMin: 5000,
  budgetMax: 10000,
  message: "いつもありがとう"
}

↓

Response:
{
  giftId: "uuid",
  shareUrl: "https://app.com/gift/[token]"
}
```

### 2. 受け手アクセスフロー

```
1. GET /gift/[token]
   ↓ トークン検証
2. POST /api/gift/validate-token
   ↓ セッション作成
3. POST /api/gift/session/message
   ↓ 会話
4. POST /api/gift/[id]/trigger-handoff
   ↓ gift_jobs にバックグラウンドジョブを登録（Responses API background）
5. `/api/cron/gift-jobs` が OpenAI Responses の完了を監視
   ↓ 推薦JSONを gift_recommendations へ保存 & 通知
6. 送り手が /gift/[id]/result で結果閲覧
```

## データベーススキーマ

### gifts テーブル
```sql
- id: uuid (PK)
- sender_user_id: text (Clerk user ID)
- recipient_first_name: text (nullable)
- occasion: text (nullable)
- budget_min: int
- budget_max: int
- message_to_recipient: text (nullable)
- status: text (状態管理)
- created_at, updated_at: timestamptz
```

### gift_tokens テーブル
```sql
- gift_id: uuid (FK)
- token_hash: text (SHA-256)
- expires_at: timestamptz
- consumed_at: timestamptz (nullable)
```

### gift_sessions テーブル
```sql
- id: uuid (PK)
- gift_id: uuid (FK)
- started_at: timestamptz
- completed_at: timestamptz (nullable)
- agent_trace_id: text (nullable)
- intake_summary: jsonb (嗜好データ)
- age_confirmed: boolean
```

### gift_recommendations テーブル
```sql
- gift_id: uuid (PK, FK)
- recommendations: jsonb
- model: text
- created_at: timestamptz
```

### gift_jobs テーブル
```sql
- id: uuid (PK)
- gift_id: uuid (FK)
- response_id: text (OpenAI ResponsesのID)
- status: text (QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED)
- metadata: jsonb (trace_group_idやギフト情報)
- handoff_summary: text
- last_error: text
- started_at / completed_at / timeout_at: timestamptz
- created_at, updated_at: timestamptz
```

### gift_job_events テーブル
```sql
- id: bigint (identity)
- job_id: uuid (FK)
- event_type: text (status, error, final など)
- label: text
- message: text
- payload: jsonb
- created_at: timestamptz
```

## 状態遷移

```
DRAFT
  ↓
LINK_CREATED (リンク生成完了)
  ↓
OPENED (受け手がアクセス)
  ↓
INTAKE_STARTED (会話開始)
  ↓
INTAKE_COMPLETED (会話終了)
  ↓
HANDOFFED (テキストワーカー起動)
  ↓
RECOMMEND_READY (推薦完了)
  ↓
NOTIFIED (送り手に通知)
  ↓
CLOSED (クローズ)
```

## セキュリティ対策

### 1. トークン管理
- 生成: `crypto.randomBytes(32).toString('base64url')`
- 保存: SHA-256ハッシュのみ保存
- 検証: サーバーサイドのみ

### 2. Row Level Security (RLS)
```sql
-- 送り手は自分のギフトのみ閲覧可能
CREATE POLICY "Senders can read own gifts"
  ON gifts FOR SELECT
  USING (auth.uid()::text = sender_user_id);
```

### 3. 予算の秘匿
- 会話AIのプロンプトで厳密に禁止
- クライアントサイドには一切送信しない
- テキストワーカーにのみサーバーサイドで注入

### 4. 年齢確認
- 20歳未満の飲酒防止
- 受け手の入室時に確認

## テキストワーカーのギフトモード

### インストラクションの拡張

```typescript
if (isGiftMode) {
  instructions += `
### ギフトモード特別指示
- 予算範囲: ${budgetMin}円〜${budgetMax}円
- 用途: ${occasion}
- 贈る相手: ${recipientName}
- ギフト包装可能な販売店を優先
- 高品質で贈答用に適した銘柄を選ぶ
`;
}
```

### コンテキストの追加

```typescript
const giftContext = [
  '【ギフトモード】',
  `予算: ${budgetMin}円〜${budgetMax}円`,
  `用途: ${occasion}`,
  '※ギフト包装・のし対応可能な販売店を優先してください'
];
```

## UI/UXフロー

### 送り手側

1. **ギフト作成モーダル**
   - フォーム入力
   - ギフトリンク生成
   - URLコピー機能

2. **結果表示ページ**
   - 推薦された日本酒の詳細
   - 購入リンク
   - 理由と提案

### 受け手側

1. **年齢確認画面**
   - 20歳以上の確認
   - プライバシーポリシー同意

2. **チャットインターフェース**
   - テキストベースの会話
   - 自然な質問形式
   - 予算に関する質問なし

3. **完了メッセージ**
   - 感謝のメッセージ
   - 送り手に結果が届く旨を通知

## Realtime更新

### Supabase Realtimeの利用

```typescript
const channel = supabase
  .channel(`gift-${giftId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'gifts',
      filter: `id=eq.${giftId}`,
    },
    (payload) => {
      // 状態更新を処理
    }
  )
  .subscribe();
```

### 通知システム

```sql
INSERT INTO notifications (user_id, type, payload)
VALUES (
  sender_user_id,
  'gift_recommend_ready',
  jsonb_build_object(
    'gift_id', gift_id,
    'occasion', occasion,
    'recipient_name', recipient_name
  )
);
```

## エラーハンドリング

### 一般的なエラー

1. **無効なトークン**
   - 原因: 期限切れ、使用済み、不正なトークン
   - 対応: エラーメッセージを表示し、送り主に連絡を促す

2. **セッション期限切れ**
   - 原因: 長時間の非アクティブ
   - 対応: セッションを再開できない場合は新しいリンクを要求

3. **テキストワーカー失敗**
   - 原因: APIエラー、タイムアウト
   - 対応: ギフト状態を`CLOSED`に更新し、送り主に通知

## パフォーマンス最適化

### 1. バックグラウンド処理
- テキストワーカーは非同期実行
- 受け手はすぐに完了メッセージを受け取る

### 2. キャッシング
- 画像抽出結果をキャッシュ
- 会話履歴は必要最小限

### 3. データベースインデックス
```sql
CREATE INDEX idx_gifts_sender_user_id ON gifts(sender_user_id);
CREATE INDEX idx_gift_tokens_hash ON gift_tokens(token_hash);
```

## テスト

### ユニットテスト
- トークン生成・検証
- ハッシュ計算
- スキーマバリデーション

### 統合テスト
- ギフト作成フロー
- トークン検証
- 会話セッション
- ハンドオフ

### E2Eテスト
1. 送り手がギフトを作成
2. URLが生成される
3. 受け手がアクセス
4. 会話が完了
5. 推薦結果が送り手に届く

## 今後の拡張案

### 1. メール通知
- 送り手への結果通知
- 受け手へのリマインダー

### 2. ギフト履歴
- 過去のギフト一覧
- 再送信機能

### 3. 複数候補
- 代替案の提示
- 比較機能

### 4. カスタマイズ
- ギフトメッセージのカスタマイズ
- テーマ選択

### 5. 分析
- 嗜好傾向の分析
- 人気のギフト

## ライセンスと規制

### アルコール関連法規
- 20歳未満への販売禁止
- 年齢確認の徹底
- 適切な警告表示

### プライバシー
- GDPR/個人情報保護法への準拠
- データ最小化原則
- ユーザー同意の取得

## まとめ

このギフト機能は、以下の原則に基づいて設計されています：

1. **プライバシー第一**: 個人情報を最小限に抑える
2. **セキュリティ**: トークンベースの認証、RLS、暗号化
3. **ユーザー体験**: 自然な会話、さりげない嗜好収集
4. **透明性**: 明確な説明、同意取得
5. **法令遵守**: 年齢確認、適切な警告

この設計により、送り手と受け手の両方に優れた体験を提供しながら、プライバシーとセキュリティを確保しています。
### バックグラウンドジョブ監視（Responses API）

- `/api/gift/[id]/trigger-handoff` で OpenAI Responses の `background` ジョブを起動し、`gift_jobs` にレスポンスIDを保存
- Vercel Cron (`/api/cron/gift-jobs`) が 2 分ごとに `gift_jobs` をポーリングして OpenAI Responses の進捗を確認
- 完了時は `gift_recommendations` へ upsert、`gifts.status` を `RECOMMEND_READY` に更新し、Supabase通知 + LINE push を送信
- 失敗・タイムアウト時は `gift_jobs.status = FAILED`、`gifts.status = CLOSED` に更新し、`gift_job_events` に error イベントを記録

### 進捗ストリーム

- `/api/gift/jobs/[id]/events`（SSE）が `gift_job_events` をポーリングし、接続中のクライアントへ逐次配信
- イベントは「ジョブ登録」「OpenAI で推論開始」「推薦完了」「失敗」「タイムアウト」など
- 受け手・送り手のブラウザ状態に依存しないため、後から接続しても履歴を再生できる
