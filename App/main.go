package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/gin-gonic/gin"
	"github.com/hiuserman/auth"
	"github.com/hiuserman/book"
	"github.com/hiuserman/user"
)

func main() {
	router := gin.Default()
	router.HandleMethodNotAllowed = true

	api := router.Group("/api")

	// ローカル・AWSの両方で有効
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Hello, World!",
		})
	})

	// 一旦本登録APIを有効にしない
	isLambda := os.Getenv("AWS_LAMBDA_RUNTIME_API") != ""

	if !isLambda {
		db := dynamodb.New(dynamodb.Options{
			Region:       "ap-northeast-1",
			BaseEndpoint: aws.String("http://dynamodb-local:8000"),
			Credentials: credentials.NewStaticCredentialsProvider(
				"local", "local", "",
			),
		})

		bookHandler := book.NewHandler(db)
		api.POST("/shelves/:shelfID/books", bookHandler.CreateBook)
	} else {
		// lamda用
		cfg, err := config.LoadDefaultConfig(context.Background())
		if err != nil {
			log.Fatalf("unable to load SDK config, %v", err)
		}

		db := dynamodb.NewFromConfig(cfg)

		tableName := os.Getenv("USERS_TABLE_NAME")
		if tableName == "" {
			log.Fatal("USERS_TABLE_NAME environment variable is not set")
		}

		// 公開鍵のキャッシュサーバ全体で共有
		// リクエストごとに取得しない
		authCtx, cancelAuth := context.WithCancel(context.Background())
		defer cancelAuth()

		verifier, err := auth.NewCognitoVerifier(
			authCtx,
			os.Getenv("COGNITO_ISSUER"),
			os.Getenv("COGNITO_CLIENT_ID"),
			os.Getenv("COGNITO_REQUIRED_SCOPE"),
		)
		if err != nil {
			log.Fatalf("failed to create Cognito verifier: %v", err)
		}

		userHandler := user.NewHandler(db, tableName)

		// このグループのルートは必ず認証を通る
		protected := api.Group("")
		protected.Use(auth.Middleware(verifier))

		protected.GET("/me", userHandler.GetMe)
		protected.POST("/me", userHandler.CreateMe)
	}

	log.Println("Ginサーバーをポート8080で起動します")

	if err := router.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
