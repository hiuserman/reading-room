# Goの公式イメージをベースにする
FROM golang:1.27-alpine

# コンテナ内の作業ディレクトリを作成する
WORKDIR /app

# モジュール定義ファイルを先にコピーする
#COPY go.mod go.sum ./

# 依存パッケージをダウンロードする
#RUN go mod download

# アプリケーションの全ソースコードをコピーする
COPY . .

# サーバーを起動する
CMD ["go", "run", "."]