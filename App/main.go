package main

import (
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/gin-gonic/gin"
	"github.com/hiuserman/book"
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
	}

	log.Println("Ginサーバーをポート8080で起動します")

	if err := router.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
