import sys

import requests
from bs4 import BeautifulSoup

def get_product_image_url(product_page_url: str) -> str:
    """
    指定された商品ページURLからメイン画像のURLをスクレイピングして返します。
    """
    try:
        # ヘッダーを設定（スクレイピング対策回避のため一般的なブラウザを模倣）
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        # HTMLを取得
        response = requests.get(product_page_url, headers=headers)
        response.raise_for_status() # ステータスコードが200以外ならエラー
        
        # BeautifulSoupで解析
        soup = BeautifulSoup(response.content, "html.parser")
        
        # 解析ロジック: ID 'goods-img-basis' 内の imgタグの src を取得
        # 提供されたHTML構造: <li id="goods-img-basis"><img src="..."></li>
        image_element = soup.select_one('#goods-img-basis img')
        
        if image_element and image_element.get('src'):
            image_url = image_element['src']
            
            # URLが相対パスの場合の処理（念のため）
            if not image_url.startswith('http'):
                # サイトによってはドメインが含まれない場合があるため補完
                # 今回のHTMLでは絶対パス(https://...)ですが、念の為の実装
                from urllib.parse import urljoin
                image_url = urljoin(product_page_url, image_url)
                
            return image_url
        else:
            return "Error: Image not found on the page."

    except Exception as e:
        return f"Error fetching image: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: uv run main.py <product_page_url>")
        sys.exit(1)

    target_url = sys.argv[1]
    print(get_product_image_url(target_url))