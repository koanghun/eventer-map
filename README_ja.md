# Event Map Application

[한국어](./README.md) | [日本語](./README_ja.md)

イベント情報を地図に表示するウェブアプリケーションです。
ユーザーはイベントを登録し、日付を選択して、該当する日付のイベントをGoogleマップで確認できます。

## 技術スタック

### バックエンド
- **Python 3.11**
- **FastAPI**: 高性能な非同期ウェブフレームワーク
- **Uvicorn**: ASGIサーバー
- **SQLAlchemy**: ORM
- **PostgreSQL**: データベース

### フロントエンド
- **React 18**
- **TypeScript**: 型の安全性
- **Tailwind CSS**: ユーティリティファーストのCSSフレームワーク
- **Radix UI**: アクセシビリティとUIコンポーネント
- **Google Maps API**: 地図および位置サービス
- **Axios**: HTTPクライアント
- **date-fns**: 日付処理

### イベント抽出機 (Event Extractor)
- **Python 3.11**
- **Gmail API**: メールのデータ収集
- **Pydantic**: データの検証および設定管理
- **AI/LLM**: イベントデータの高度化および構造化

### インフラ
- **Docker & Docker Compose**: コンテナ化
- **Nginx**: フロントエンドのサービングおよびリバースプロキシ
- **Synology NAS**: デプロイ環境


## 主な機能

- ✅ イベントの登録/修正/削除 (CRUD)
- ✅ 日付別のイベントフィルター
- ✅ Googleマップにイベントマーカーを表示
- ✅ イベントの詳細情報 (開催日、時間、場所、出演者、関連リンク)
- ✅ Google Maps APIの最適化 (最小使用量)

## プロジェクト構造

```
eventer-map/
├── backend/              # FastAPIバックエンド
│   ├── routes/          # APIルート
│   ├── models/           # DBモデル
│   ├── database.py      # DB接続設定
│   ├── main.py          # FastAPIアプリ
│   ├── requirements.txt # Python依存関係
│   └── Dockerfile       # バックエンドDockerイメージ
├── frontend/            # Reactフロントエンド
│   ├── src/
│   │   ├── components/  # React/Radixコンポーネント
│   │   ├── services/    # APIクライアント
│   │   ├── types/       # TypeScript型
│   │   └── App.tsx      # メインアプリ
│   ├── package.json     # Node依存関係
│   ├── nginx.conf       # Nginx設定
│   └── Dockerfile       # フロントエンドDockerイメージ
├── event-extractor/     # イベントデータ抽出パイプライン (Python)
│   ├── main.py          # パイプライン実行エントリーポイント
│   ├── core/            # コアロジック (LLMクライアントなど)
│   ├── services/        # 外部サービス連携 (Gmailなど)
│   ├── models/          # データモデル
│   └── requirements.txt # 依存関係
├── scripts/             # デプロイおよびバックアップスクリプト
│   ├── deploy.sh        # 自動デプロイスクリプト
│   ├── backup-db.sh     # DBバックアップスクリプト
│   └── setup_ssl.sh     # SSL設定スクリプト
└── docker-compose.yml   # Docker Compose設定 (ローカル)
```


## はじめに

### 前提条件

- Docker & Docker Compose
- Google Maps APIキー

### 1. Google Maps APIキーの発行

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Maps JavaScript APIを有効にする
3. Geocoding APIを有効にする (住所 → 座標の変換用)
4. APIキーを生成し、制限を設定する

### 2. 環境変数の設定

各コンポーネントの `.env.example` ファイルをコピーして `.env` ファイルを作成し、必要な値を設定してください。

```bash
# バックエンドの環境変数
cp backend/.env.example backend/.env

# フロントエンドの環境変数
cp frontend/.env.example frontend/.env

# イベント抽出機の環境変数
cp event-extractor/.env.example event-extractor/.env
```


### 3. 実行 (WSL環境)

```bash
# Docker Composeで全スタックを実行
docker-compose up --build

# バックグラウンド実行
docker-compose up -d --build
```

アプリケーションが実行されると:
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000
- APIドキュメント: http://localhost:8000/docs

### 4. 開発モード (WSL)

各コンポーネントを開発モードで個別に実行できます。

```bash
# バックエンド開発サーバー
cd backend
python -m venv venv
source venv/bin/activate  # WSL/Linux
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# フロントエンド開発サーバー (新ターミナル)
cd frontend
npm install --legacy-peer-deps
npm start

# イベント抽出機（新ターミナル）
cd event-extractor
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# .envおよびcredentials.jsonの設定が必要
python main.py
```


## Synology NASへのデプロイ

### Dockerを使用したデプロイ

1. Synology NASにSSHで接続
2. プロジェクトファイルをNASにコピー
3. Docker Composeを実行

```bash
# NASで実行
cd /volume1/docker/eventer-map
docker-compose up -d --build
```

### ポートフォワーディングの設定

- ルーターで外部ポートをNASのIP:3000にフォワーディング
- またはリバースプロキシ(Nginx Proxy Managerなど)を使用

### セキュリティの推奨事項

- Google Maps APIキーにドメイン/IPの制限を設定
- HTTPSを使用 (Let's Encrypt)
- 環境変数で機密情報を管理

## Google Maps APIの最適化

自宅環境でAPIコストを最小限に抑えるための戦略:

1. **Geocoding キャッシュ**: イベント登録時に住所を座標に変換してDBに保存
2. **静的マーカー**: ランタイムでの不要なAPI呼び出しを防止
3. **地図の再利用**: 一度ロードした地図インスタンスを再利用
4. **APIキーの制限**: 特定のドメイン/IPのみを許可

## APIエンドポイント

- `POST /events`: イベントの作成
- `GET /events`: すべてのイベントの取得
- `GET /events/{id}`: 特定のイベントの取得
- `PUT /events/{id}`: イベントの修正
- `DELETE /events/{id}`: イベントの削除
- `GET /events/by-date/{date}`: 特定の日付のイベントの取得
