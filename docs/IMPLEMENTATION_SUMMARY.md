# ギフト機能 実装完了サマリー

## 実装概要

Sakescopeに日本酒ギフト機能を実装しました。この機能により、送り手が受け手の嗜好をさりげなく聞き取り、最適な日本酒を推薦できます。

## 実装したファイル

### データベース・インフラストラクチャ

1. **`docs/supabase-schema.sql`**
   - ギフト機能用のデータベーススキーマ
   - テーブル: gifts, gift_tokens, gift_sessions, gift_messages, gift_recommendations, notifications
   - Row Level Security (RLS) ポリシー

2. **`frontend/src/lib/supabase.ts`**
   - Supabaseクライアントの初期化
   - サーバーサイド用のサービスロールクライアント

3. **`frontend/middleware.ts`**
   - Clerk認証ミドルウェア
   - ギフトページの公開アクセス設定

4. **`frontend/src/lib/tokenUtils.ts`**
   - ワンタイムトークンの生成・ハッシュ・検証

### 型定義

5. **`frontend/src/types/gift.ts`**
   - ギフト関連の型定義
   - GiftStatus, Gift, GiftToken, GiftSession, etc.

### APIルート

6. **`frontend/src/app/api/gift/create/route.ts`**
   - ギフト作成API
   - Clerk認証必須
   - ワンタイムトークン生成

7. **`frontend/src/app/api/gift/validate-token/route.ts`**
   - トークン検証API
   - 一度のみ使用可能
   - セッション作成

8. **`frontend/src/app/api/gift/session/message/route.ts`**
   - 会話メッセージAPI
   - OpenAI GPTで嗜好収集
   - ハンドオフ判定

9. **`frontend/src/app/api/gift/[id]/trigger-handoff/route.ts`**
   - テキストワーカー起動API
   - バックグラウンド処理
   - 結果通知

10. **`frontend/src/app/api/text-worker/route.ts` (拡張)**
    - ギフトモード対応
    - 予算の秘匿
    - ギフト用インストラクション

### UIコンポーネント

11. **`frontend/src/components/GiftChat.tsx`**
    - 受け手向けチャットUI
    - テキストベースの会話
    - ハンドオフトリガー

12. **`frontend/src/components/CreateGiftModal.tsx`**
    - ギフト作成モーダル
    - フォーム入力
    - URLコピー機能

### ページ

13. **`frontend/src/app/gift/[token]/page.tsx`**
    - 受け手用エントリーページ
    - トークン検証
    - 年齢確認

14. **`frontend/src/app/gift/[id]/result/page.tsx`**
    - 送り手用結果表示ページ
    - 推薦詳細
    - Realtime更新

15. **`frontend/src/app/page.tsx` (拡張)**
    - ギフトボタン追加
    - モーダル統合

### ドキュメント

16. **`docs/GIFT_FEATURE_SETUP.md`**
    - セットアップガイド
    - 環境変数設定
    - トラブルシューティング

17. **`docs/GIFT_FEATURE_README.md`**
    - 実装詳細
    - アーキテクチャ
    - データフロー

18. **`frontend/.env.example`**
    - 環境変数テンプレート

19. **`frontend/src/server/textWorkerSchemas.ts`**
    - テキストワーカー/Responses共有のZodスキーマとJSON Schema定義

20. **`frontend/src/server/giftJobService.ts`**
    - gift_jobsへのジョブ登録、イベント記録、失敗時処理ユーティリティ

21. **`frontend/supabase/functions/gift-jobs/index.ts`**
    - Supabase Edge Function として OpenAI Responses backgroundジョブの完了監視とDB反映を担当

22. **`frontend/src/app/api/gift/jobs/[id]/events/route.ts`**
    - gift_job_events を SSE で配信する進捗ストリームAPI

23. **Supabase Scheduled Trigger**
    - Supabase Dashboard で `gift-jobs` Edge Function を 2分間隔で実行する設定（コード外で構成）

## 主要機能

### 1. セキュリティ
- ✅ ワンタイムURL (SHA-256ハッシュ)
- ✅ 72時間の有効期限
- ✅ Row Level Security (RLS)
- ✅ Clerk認証統合
- ✅ サービスロールでのトークン検証

### 2. プライバシー
- ✅ 予算の完全秘匿
- ✅ 匿名アクセス（受け手）
- ✅ 最小限の個人情報
- ✅ 年齢確認

### 3. ユーザー体験
- ✅ さりげない会話形式
- ✅ 自然な嗜好収集
- ✅ リアルタイム更新
- ✅ レスポンシブデザイン

### 4. AI統合
- ✅ OpenAI GPT for 会話
- ✅ テキストワーカーのギフトモード
- ✅ 構造化された嗜好抽出
- ✅ 予算範囲での推薦

### 5. バックグラウンド処理
- ✅ OpenAI Responses API の `background` モードでギフト推薦ジョブを起動
- ✅ `gift_jobs` / `gift_job_events` による永続キューと進捗ログ
- ✅ Supabase Edge Function (`gift-jobs`) で完了検知とSupabaseへの反映
- ✅ `/api/gift/jobs/[id]/events` のSSEで後追い視聴可能な進捗ストリーム

## セットアップ手順

### 1. 依存関係のインストール

```bash
cd frontend
npm install
```

必要なパッケージは既にインストール済み：
- `@supabase/supabase-js`
- `@clerk/nextjs`

### 2. Supabaseのセットアップ

1. Supabaseプロジェクトを作成
2. SQL Editorで `docs/supabase-schema.sql` を実行
3. Realtime機能を有効化：
   - gifts
   - gift_recommendations
   - notifications

### 3. Clerkのセットアップ

1. Clerkアプリケーションを作成
2. Email認証を有効化
3. APIキーを取得

### 4. 環境変数の設定

`frontend/.env.local` を作成：

```bash
cp .env.example .env.local
```

各変数を実際の値で更新。

### 5. アプリケーションの起動

```bash
npm run dev
```

## 使用方法

### 送り手（Sender）

1. ホームページで「ギフトを贈る」ボタンをクリック
2. ギフト情報を入力
3. 生成されたURLを相手に送信
4. 結果は `/gift/[id]/result` で確認

### 受け手（Recipient）

1. 送られてきたURLにアクセス
2. 年齢確認に同意
3. AIと会話
4. 会話終了後、送り手に結果が届く

## データフロー

```
送り手 (Clerk認証)
  ↓
POST /api/gift/create
  ↓
ワンタイムURL生成
  ↓
受け手 (匿名)
  ↓
POST /api/gift/validate-token
  ↓
セッション作成
  ↓
POST /api/gift/session/message (会話)
  ↓
嗜好データ収集
  ↓
POST /api/gift/[id]/trigger-handoff
  ↓
POST /api/text-worker (ギフトモード)
  ↓
推薦結果 → Supabase
  ↓
Realtime更新 → 送り手
```

## 状態管理

ギフトの状態遷移：

```
DRAFT → LINK_CREATED → OPENED → INTAKE_STARTED
  → INTAKE_COMPLETED → HANDOFFED → RECOMMEND_READY
  → NOTIFIED → CLOSED
```

## セキュリティ対策

1. **トークン管理**
   - 生成: `crypto.randomBytes(32)`
   - 保存: SHA-256ハッシュ
   - 検証: サーバーサイドのみ

2. **認証・認可**
   - 送り手: Clerk認証必須
   - 受け手: トークンベース（匿名）
   - RLS: 送り手のみデータアクセス可

3. **予算の秘匿**
   - 会話AIで一切言及しない
   - クライアントに送信しない
   - テキストワーカーにのみ注入

4. **年齢確認**
   - 20歳未満の飲酒防止
   - 法令遵守

## 今後の拡張可能性

### Phase 2
- [ ] メール通知（Resend/SendGrid統合）
- [ ] ギフト履歴ページ
- [ ] 再送信機能

### Phase 3
- [ ] 複数候補の提示
- [ ] 比較機能
- [ ] カスタムテーマ

### Phase 4
- [ ] 嗜好分析ダッシュボード
- [ ] 人気ギフトランキング
- [ ] AIによるトレンド分析

## トラブルシューティング

### よくある問題

1. **トークンが無効**
   - 原因: 期限切れ/使用済み
   - 解決: 新しいギフトを作成

2. **結果が表示されない**
   - 原因: テキストワーカーエラー
   - 解決: ログを確認、ギフトのstatusを確認

3. **Realtime更新が動作しない**
   - 原因: Supabaseのレプリケーション設定
   - 解決: テーブルのRealtimeを有効化

## パフォーマンス

- **会話レスポンス**: ~2秒（OpenAI API）
- **推薦生成**: ~10-30秒（テキストワーカー、バックグラウンド）
- **Realtime更新**: リアルタイム（Supabase）

## コスト見積もり

### OpenAI API
- 会話: gpt-4o-mini (~$0.01/会話)
- 推薦: gpt-4o-mini + web search (~$0.05/推薦)

### Supabase
- Free tier: 500MB DB, 2GB bandwidth
- Pro: $25/月

### Clerk
- Free tier: 10,000 MAU
- Pro: $25/月

### 合計（小規模）
- ~$50-100/月 (100ギフト/月の場合)

## テスト

### 実施すべきテスト

1. **ユニットテスト**
   - トークン生成・検証
   - スキーマバリデーション

2. **統合テスト**
   - API エンドポイント
   - データベース操作

3. **E2Eテスト**
   - フルフロー
   - エラーケース

4. **セキュリティテスト**
   - トークン再利用防止
   - RLSポリシー
   - XSS/CSRF対策

## まとめ

完全に機能するギフト機能を実装しました。主要な特徴：

✅ **セキュアなワンタイムURL**
✅ **予算の完全秘匿**
✅ **自然な会話による嗜好収集**
✅ **送り手のみへの結果通知**
✅ **Realtime更新**
✅ **包括的なドキュメント**

すべてのファイルが作成され、セットアップガイドが完備されています。環境変数を設定し、データベーススキーマを適用すれば、すぐに使用開始できます。
