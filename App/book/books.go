package book

import (
	"context"
	"log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

type Book struct {
	ShelfID   string   `json:"shelfId" dynamodbav:"shelfId"`
	BookID    string   `json:"bookId" dynamodbav:"bookId"`
	Title     string   `json:"title" dynamodbav:"title"`
	Authors   []string `json:"authors" dynamodbav:"authors"`
	CreatedAt string   `json:"createdAt" dynamodbav:"createdAt"`
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

func GetBooksByShelfID(shelfID string, db *dynamodb.Client) ([]Book, error) {
	result, err := db.Scan(context.TODO(), &dynamodb.ScanInput{
		TableName:        aws.String("ShelfBooks"),
		FilterExpression: aws.String("shelfId = :shelfId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":shelfId": &types.AttributeValueMemberS{Value: shelfID},
		},
	})

	if err != nil {
		log.Printf("Couldn't scan table. Here's why: %v\n", err)
		return nil, err
	}

	var books []Book

	for _, item := range result.Items {
		var book Book
		err = attributevalue.UnmarshalMap(item, &book)
		if err != nil {
			log.Printf("Couldn't unmarshal item. Here's why: %v\n", err)
			return nil, err
		}
		books = append(books, book)
	}
	return books, nil
}
