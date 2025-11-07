# Sakescope 埋め込みガイド（iframe）

外部サイト（例: MakeShop / WordPress / LP）に Sakescope の音声チャットを埋め込むための最小手順です。

## 1. 埋め込み用URL

- エンドポイント: `https://<あなたのドメイン>/embed`
- 既存の `VoiceChat` をヘッダーなしで表示する専用ページです。HTTPS が必須です。

## 2. HTML スニペット

埋め込み先の管理画面で以下を貼り付けます（フッターや任意のコンテンツ枠など）。

```html
<div id="sakescope-chat-container" style="position:fixed;right:16px;bottom:16px;z-index:2147483647"></div>
<script>
  (function () {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://<あなたのドメイン>/embed';
    iframe.title = 'Sakescope AI Sommelier';
    iframe.allow = 'microphone; autoplay';
    iframe.style.cssText = 'width:380px;height:560px;border:0;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.25)';
    document.getElementById('sakescope-chat-container').appendChild(iframe);
  })();
</script>
```

### ポイント
- `allow="microphone; autoplay"` を必ず付与します。これが無いと iframe 内からマイクを取得できません。
- `style.cssText` はレイアウトに合わせて任意に変更してください（幅・高さ・位置など）。
- 必要に応じて固定配置ではなく、ページ内レイアウトに合わせたラッパー要素へ差し替えてください。

## 3. マイク権限と HTTPS
- ブラウザは HTTPS でないと `getUserMedia`（マイク許可）を拒否します。必ず SSL 化されたドメインを使用してください。
- 埋め込みサイトと Sakescope 側ドメインの双方が HTTPS であることを確認します。

## 4. 動作確認チェックリスト
1. 埋め込みページを開き、マイク許可ダイアログが表示されるか。
2. マイクを許可後、音声会話が始まり再生音が聞こえるか。
3. ブラウザコンソールに `Refused to frame` といった CSP エラーが出ていないか。
4. 音声が自動で再生されない場合は、一度マイクボタンを押すなどユーザー操作を促してください（各ブラウザの autoplay ポリシーによります）。

## 5. 親サイトとの連携を強化したい場合
- `window.postMessage` で iframe ↔ 親ページのイベント連携が可能です（例: 商品情報をチャットに渡すなど）。
- その際は `message.origin` をチェックして許可ドメインだけを処理してください。

## 6. よくあるトラブル
| 症状 | 確認ポイント |
| --- | --- |
| マイク許可が出ない | `allow="microphone"` が付いているか、ブラウザの設定でブロックしていないか |
| 画面が真っ白 | ネットワーク/CORS/CSP（`frame-ancestors`）などのエラーログを確認 |
| 音声が再生されない | 初回操作を挟む、`allow="autoplay"`、ブラウザのメディア設定を確認 |

## 7. 将来的なホワイトリスト設定
- 本番運用時は `frame-ancestors` を使って「埋め込みを許可する親ドメイン」を限定することを推奨します。
- `next.config.ts` の `headers()` で `/embed` だけ指定し、顧客ごとにドメインを追記する運用が安全です。

---
このドキュメントの内容で不明点があれば `docs/EMBED_IFRAME_GUIDE.md` を更新しつつ共有してください。
