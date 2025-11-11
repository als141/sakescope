# Repository Guidelines

## プロジェクト構成とモジュール配置
- `frontend/` は Next.js 15 + Clerk + Supabase クライアント一式を保持し、`src/app` が App Router、`src/application` `src/domain` `src/infrastructure` がユースケース層・ドメインモデル・外部アダプタを分割します。
- `frontend/src/components` で再利用 UI、`frontend/src/lib` で各種ユーティリティ、`public/` に音声・画像アセット、`docs/` には GIFT 仕様や Realtime API メモがまとまっています。
- `backend/` と `supabase/` は将来の API / データ層拡張用プレースホルダなので、変更予定があればまず Issue を立ててから着手してください。

## ビルド・テスト・開発コマンド
- 依存追加は常に `cd frontend && bun install` を使用し、`package-lock.json` を直接編集しないでください。
- ローカル開発は `cd frontend && bun run dev`、パフォーマンス検証は `bun run dev -- --turbopack` を選びます。
- 静的解析と型チェックは `cd frontend && bun run lint` と `bun run build` が担います。どちらも失敗時は修正内容をコミットしないでください。
- 本番挙動の確認やバグ再現には `cd frontend && bun run start` を使い、`bun run build` 成果物を必ず利用します。

## コーディングスタイルと命名規約
- TypeScript / TSX は 2 スペースインデント、セミコロン有り、import は `next`, `@clerk`, ローカル alias の順でグループ化します。
- React コンポーネントは PascalCase ファイル + デフォルトエクスポート、フックとユーティリティは camelCase、App Router のディレクトリ名は kebab-case でルーティングに一致させます。
- UI は Tailwind CSS v4 を前提にし、複雑なバリアントは `class-variance-authority` で定義、`tw-animate-css` を使う場合はコメントで依存関係を明示してください。

## テストガイドライン
- 現在は Lint と Next.js ビルドを品質ゲートとしています。新規ロジックを追加する際は PR に手動検証ステップを明記してください。
- 自動テストを導入する場合はモジュール直下に `*.spec.ts` を配置し、`bun test` スクリプトを同じ PR で package.json に追加する方針を取ります。失敗時は最低限再現手順とログを追記してください。

## コミットとプルリクエスト
- Git 履歴は「Add ...」「Refactor ...」のように先頭動詞 + 目的語 + ピリオドで 1 行サマリを記述しています。この形式を踏襲し、英語でコンポーネント名を含めてください。
- PR には変更概要、関連 Issue、追加コマンド、必要ならスクリーンショットまたは音声キャプチャを添付し、環境変数の変更がある場合は `docs/` に追記したリンクを示します。

## セキュリティと設定
- `frontend/.env.local` に `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_REALTIME_MODEL`, `NEXT_PUBLIC_OPENAI_REALTIME_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` を定義し、Git には絶対に含めないでください。
- Clerk や Supabase のキーを共有する際は 1Password 等のシークレットストアを使用し、`docs/openai-realtime.md` の更新履歴に合わせてモデル名を統一してください。

## 出荷前チェック
- すべての変更についてローカルで `bun run lint` を通過させ、最終確認として `bun run build` で本番同等テストを必ず実行してください。
