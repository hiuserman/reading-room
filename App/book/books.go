package book

import (
	"context"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

type Book struct {
	ShelfID string `json:"shelfId" dynamodbav:"shelfId"`
	BookID  string `json:"bookId" dynamodbav:"bookId"`
}

func CreateBook(book Book, db *dynamodb.Client) error {
	item, err := attributevalue.MarshalMap(book)
	if err != nil {
		panic(err)
	}
	_, err = db.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName: aws.String("ShelfBooks"), Item: item,
	})
	if err != nil {
		log.Printf("Couldn't add item to table. Here's why: %v\n", err)
	}
	return err
}
