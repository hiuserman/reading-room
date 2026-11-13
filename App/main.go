package main

import (
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hiuserman/book"
)

func main() {
	router := gin.Default()
	router.HandleMethodNotAllowed = true
	db := dynamodb.New(dynamodb.Options{
		Region:       "ap-northeast-1",
		BaseEndpoint: aws.String("http://dynamodb-local:8000"),
		Credentials:  credentials.NewStaticCredentialsProvider("local", "local", ""),
	})

	api := router.Group("/api")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "ok",
				"message": "Hello, World!",
			})
		})
		api.POST("/shelves/:shelfID/books", func(c *gin.Context) {

			var input struct {
				Title   string   `json:"title"`
				Authors []string `json:"authors"`
			}

			bookID := uuid.New().String()

			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			test := book.Book{
				ShelfID:   c.Param("shelfID"),
				BookID:    bookID,
				Title:     input.Title,
				Authors:   input.Authors,
				CreatedAt: "2023-01-01T00:00:00Z",
			}

			if err := book.CreateBook(test, db); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create book"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "Book created successfully"})
		})

	}
	// Ginサーバーをポート8080で起動する
	log.Println("Ginサーバーをポート8080で起動します")
	router.Run(":8080")
}
