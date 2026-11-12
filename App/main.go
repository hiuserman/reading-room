package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/hiuserman/book"
)

func main() {
	db := dynamodb.New(dynamodb.Options{
		Region:       "ap-northeast-1",
		BaseEndpoint: aws.String("http://dynamodb-local:8000"),
		Credentials:  credentials.NewStaticCredentialsProvider("local", "local", ""),
	})

	http.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		_, err := db.ListTables(ctx, &dynamodb.ListTablesInput{Limit: aws.Int32(1)})
		if err != nil {
			log.Printf("DynamoDB 接続失敗: %v", err)
			w.WriteHeader(http.StatusServiceUnavailable)
			io.WriteString(w, `{"status":"unavailable"}`)
			return
		}

		io.WriteString(w, `{"status":"ok"}`)
	})

	http.HandleFunc(
		"GET /api/shelvs/{shelfID}/books",
		func(w http.ResponseWriter, r *http.Request) {
			var test book.Book
			/*err := json.NewDecoder(r.Body).Decode(&test)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				io.WriteString(w, `{"error":"Invalid request body"}`)
				return
			}*/
			test.ShelfID = "shelf1"
			test.BookID = "book1"
			err := book.CreateBook(test, db)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				io.WriteString(w, `{"error":"Failed to create book"}`)
				return
			}
			w.WriteHeader(http.StatusCreated)
			io.WriteString(w, `{"message":"Book created successfully"}`)
		})
	log.Fatal(http.ListenAndServe(":8080", nil))
}
