# ギフト機能 セットアップガイド

このドキュメントでは、Sakescopeのギフト機能をセットアップする方法を説明します。

## 前提条件

- Supabaseアカウント
- Clerkアカウント
- OpenAI APIキー

## 1. Supabaseのセットアップ

### 1.1 プロジェクトの作成

1. [Supabase](https://supabase.com)にログイン
2. 新しいプロジェクトを作成
3. プロジェクトのURLとAPI Keyをメモ

### 1.2 データベーススキーマの作成

1. Supabaseダッシュボードで「SQL Editor」を開く
2. `/docs/supabase-schema.sql`の内容をコピー
3. SQL Editorに貼り付けて実行

これにより以下のテーブルが作成されます：
- `gifts` - ギフト情報
- `gift_tokens` - ワンタイムアクセストークン
- `gift_sessions` - 受け手の会話セッション
- `gift_messages` - 会話ログ
- `gift_recommendations` - テキストエージェントの推薦結果
- `notifications` - 送り手への通知

### 1.3 Realtime機能の有効化

1. Supabaseダッシュボードで「Database」→「Replication」を開く
2. 以下のテーブルでRealtimeを有効化：
   - `gifts`
   - `gift_recommendations`
   - `notifications`

## 2. Clerkのセットアップ

### 2.1 アプリケーションの作成

1. [Clerk](https://clerk.com)にログイン
2. 新しいアプリケーションを作成
3. APIキーをメモ

### 2.2 認証設定

1. Clerkダッシュボードで「User & Authentication」→「Email, Phone, Username」を開く
2. Email認証を有効化
3. 必要に応じてソーシャルログインを設定

## 3. 環境変数の設定

`frontend/.env.local`ファイルを作成し、以下の環境変数を設定：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_TEXT_MODEL=gpt-4o-mini  # または gpt-4o
OPENAI_GIFT_MODEL=gpt-4o-mini  # ギフト会話用モデル

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 本番環境では実際のURLに変更
```

### 環境変数の説明

- **NEXT_PUBLIC_SUPABASE_URL**: Supabaseプロジェクトのpublic URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabaseの匿名アクセスキー（public）
- **SUPABASE_SERVICE_ROLE_KEY**: Supabaseのサービスロールキー（サーバーサイドのみ、秘密）
- **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**: Clerkのpublishable key
- **CLERK_SECRET_KEY**: Clerkのsecret key（サーバーサイドのみ、秘密）
- **OPENAI_API_KEY**: OpenAI APIキー
- **OPENAI_TEXT_MODEL**: テキストエージェント用のモデル
- **OPENAI_GIFT_MODEL**: ギフト会話用のモデル

## 4. アプリケーションの起動

```bash
cd frontend
npm install
npm run dev
```

アプリケーションは`http://localhost:3000`で起動します。

## 5. ギフト機能の使い方

### 送り手（Sender）

1. ホームページで「ギフトを贈る」ボタンをクリック
2. ギフト情報を入力：
   - 用途（例：父の日、誕生日）
   - 贈る相手の呼び名（例：お父さん）
   - 予算範囲
   - メッセージ（任意）
3. 「ギフトリンクを作成」をクリック
4. 生成されたURLを相手に送信
5. 推薦結果は「/gift/[id]/result」ページで確認できます

### 受け手（Recipient）

1. 送られてきたURLにアクセス
2. 年齢確認に同意
3. AIアシスタントと会話して好みを伝える
4. 会話が終了すると、送り手に推薦結果が届く

## 6. セキュリティ設定

### Row Level Security (RLS)

スキーマには既にRLSポリシーが含まれていますが、確認してください：

- 送り手は自分のギフトのみ閲覧可能
- 受け手は匿名でアクセス（トークン検証はサーバーサイド）
- 推薦結果は送り手のみ閲覧可能

### トークンの有効期限

- ワンタイムトークンは72時間有効
- 一度使用すると無効化される
- トークンはSHA-256ハッシュで保存

## 7. トラブルシューティング

### ギフトリンクが無効と表示される

- トークンの有効期限（72時間）を確認
- トークンが既に使用されていないか確認
- `gift_tokens`テーブルを確認

### 推薦結果が表示されない

- ギフトのstatusを確認：`gifts`テーブル
- テキストワーカーのログを確認
- `gift_recommendations`テーブルにデータがあるか確認

### Realtime更新が動作しない

- Supabaseでテーブルのレプリケーションが有効か確認
- ブラウザのコンソールでWebSocket接続を確認

## 8. 本番環境へのデプロイ

### Vercel推奨設定

```bash
# 環境変数を設定
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add OPENAI_API_KEY
# ... その他の環境変数

# デプロイ
vercel --prod
```

### Clerkのドメイン設定

1. Clerkダッシュボードで「Domains」を開く
2. 本番環境のドメインを追加
3. 環境変数`NEXT_PUBLIC_APP_URL`を本番URLに更新

## 9. モニタリングとログ

### Supabaseのログ

- 「Logs」セクションでデータベースクエリを監視
- API呼び出しのエラーを確認

### Vercelのログ

- 関数のログを確認
- エラートレースを監視

## サポート

問題が発生した場合は、以下を確認してください：

1. すべての環境変数が正しく設定されているか
2. Supabaseのスキーマが正しく適用されているか
3. Clerkの認証が正しく機能しているか
4. OpenAI APIの残高があるか

それでも解決しない場合は、GitHubのIssuesで報告してください。
## 10. バックグラウンドジョブ設定

- `frontend/vercel.json` で `/api/cron/gift-jobs` を 2 分間隔の Vercel Cron に登録済み。
- Vercel ダッシュボード > Project Settings > Cron Jobs でエントリが有効になっているか確認。
- Cron は Supabase の service role で `gift_jobs` を確認し、OpenAI Responses の完了を検知して `gift_recommendations` を更新します。
- `NEXT_PUBLIC_APP_URL` が正しい本番URLになっていることを確認（通知時のURL生成に使用）。
