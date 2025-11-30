# 🎤 Sakescope Voice Widget 埋め込みガイド

Sakescope Voice Widgetを使用すると、あなたのECサイトにAI音声ソムリエを簡単に追加できます。

## 📦 特徴

- **簡単導入**: 1行のコードを追加するだけ
- **音声対話**: マイクを使ってリアルタイムで日本酒を探せる
- **レスポンシブ**: モバイルにも対応
- **カスタマイズ可能**: 位置やテーマを自由に変更
- **イベント連携**: カート追加などの機能と簡単に連携

## 🚀 基本的な使い方

### 1. スクリプトタグを追加

HTMLの`</body>`タグの直前に以下を追加してください：

```html
<script src="https://your-domain.com/embed-widget.js"
        data-sakescope-host="https://your-domain.com"></script>
```

これだけで、右下にマイクボタンが表示され、クリックすると音声チャットウィジェットが開きます。

### 2. 動作確認

ページをリロードして、右下のマイクボタンをクリックしてみてください。音声チャットが開始できれば成功です！

## ⚙️ カスタマイズ

### ボタンの位置を変更

```html
<script src="https://your-domain.com/embed-widget.js"
        data-sakescope-host="https://your-domain.com"
        data-position="bottom-left"></script>
```

利用可能な位置:
- `bottom-right` (デフォルト)
- `bottom-left`

### ボタンのテーマを変更

```html
<script src="https://your-domain.com/embed-widget.js"
        data-sakescope-host="https://your-domain.com"
        data-theme="solid"></script>
```

利用可能なテーマ:
- `gradient` (デフォルト) - グラデーション
- `solid` - 単色

## 🔧 JavaScript API

ウィジェットを JavaScript から制御できます：

```javascript
// ウィジェットを開く
window.Sakescope.open();

// ウィジェットを閉じる
window.Sakescope.close();

// トグル
window.Sakescope.toggle();

// 開いているかどうか確認
const isOpen = window.Sakescope.isOpen();
```

### 例: 特定のボタンでウィジェットを開く

```html
<button onclick="window.Sakescope.open()">
  日本酒を探す
</button>
```

## 📡 イベント連携

ウィジェットからのイベントを受け取って、カート追加などの処理を実装できます。

### 日本酒がレコメンドされた時

```javascript
window.addEventListener('sakescope:sakeRecommended', (event) => {
  const sake = event.detail.sake;
  const offer = event.detail.offer;

  console.log('おすすめされた日本酒:', sake.name);
  console.log('購入情報:', offer);

  // 例: おすすめバナーを表示
  showRecommendationBanner(sake);
});
```

### ショップリンクがクリックされた時

```javascript
window.addEventListener('sakescope:shopClick', (event) => {
  const sake = event.detail.sake;
  const shop = event.detail.shop;

  console.log('クリックされた商品:', sake.name);
  console.log('販売店:', shop.retailer);
  console.log('価格:', shop.price);

  // 例: カートに追加
  addToCart({
    name: sake.name,
    price: shop.price,
    url: shop.url
  });
});
```

### 接続状態が変わった時

```javascript
window.addEventListener('sakescope:connectionChange', (event) => {
  const connected = event.detail.connected;

  if (connected) {
    console.log('音声チャット接続中');
  } else {
    console.log('音声チャット切断');
  }
});
```

## 🎨 スタイルのカスタマイズ

ウィジェットのスタイルをさらにカスタマイズしたい場合は、CSSで調整できます：

```css
/* ボタンのサイズを変更 */
#sakescope-toggle {
  width: 70px !important;
  height: 70px !important;
}

/* ウィジェットのサイズを変更 */
#sakescope-widget {
  width: 450px !important;
  height: 650px !important;
}

/* ボタンの色を変更 */
#sakescope-toggle {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
}
```

## 📱 モバイル対応

ウィジェットは自動的にモバイルに最適化されます：

- 画面サイズに応じてウィジェットのサイズが調整されます
- タッチ操作に対応しています
- マイク権限のリクエストが適切に処理されます

## 🔒 セキュリティ

本番環境では、以下のセキュリティ対策を推奨します：

1. **Origin検証**: postMessageのorigin検証を有効にする
2. **HTTPS**: 本番環境では必ずHTTPSを使用する
3. **CSP**: Content Security Policyを設定する

```javascript
// Origin検証の例 (embed-widget.js内で実装)
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://your-domain.com') {
    return; // 不正なoriginは無視
  }
  // ...
});
```

## 🧪 テスト

### ローカル環境でテスト

1. フロントエンドサーバーを起動:
```bash
cd frontend
npm run dev
```

2. サンプルHTMLを開く:
```bash
# ブラウザで以下を開く
open sample-simple.html
# または
open sample.html
```

### サンプルファイル

- `sample-simple.html` - 最小限の実装例
- `sample.html` - 実際のECサイトを模したデモ

## ❓ トラブルシューティング

### ボタンが表示されない

1. スクリプトが正しく読み込まれているか確認
2. コンソールにエラーが出ていないか確認
3. `data-sakescope-host`が正しく設定されているか確認

### マイクが使えない

1. ブラウザのマイク権限を確認
2. HTTPSで配信されているか確認（HTTPでは動作しません）
3. ブラウザがマイク対応しているか確認

### イベントが発火しない

1. イベントリスナーが正しく設定されているか確認
2. コンソールでイベントがログ出力されているか確認
3. ブラウザのコンソールでエラーがないか確認

## 📞 サポート

質問や問題がある場合は、以下までお問い合わせください：

- GitHub Issues: https://github.com/your-repo/issues
- Email: support@sakescope.com

## 📄 ライセンス

このウィジェットは [ライセンス名] の下で提供されています。

---

**Happy Sake Hunting! 🍶**
