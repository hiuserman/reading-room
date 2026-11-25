package shelf

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// 本棚と、その作成者の参加情報をまとめて保存する
func CreateShelfWithOwner(ctx context.Context, db *dynamodb.Client, shelvesTable string, membersTable string, shelf Shelf) error {
	// 作成者を、この本棚のownerとして登録する
	owner := Membership{
		ShelfID:  shelf.ShelfID,
		UserID:   shelf.CreatedBy,
		Role:     "owner",
		Status:   "active",
		JoinedAt: shelf.CreatedAt,
	}

	shelfItem, err := attributevalue.MarshalMap(shelf)
	if err != nil {
		return fmt.Errorf("本棚のデータ変換に失敗: %w", err)
	}

	ownerItem, err := attributevalue.MarshalMap(owner)
	if err != nil {
		return fmt.Errorf("参加情報のデータ変換に失敗: %w", err)
	}

	//本を保存
	putShelf := types.TransactWriteItem{
		Put: &types.Put{
			TableName:           aws.String(shelvesTable),
			Item:                shelfItem,
			ConditionExpression: aws.String("attribute_not_exists(shelfId)"),
		},
	}

	//参加情報を保存する
	putOwner := types.TransactWriteItem{
		Put: &types.Put{
			TableName:           aws.String(membersTable),
			Item:                ownerItem,
			ConditionExpression: aws.String("attribute_not_exists(shelfId) AND attribute_not_exists(userId)"),
		},
	}

	// トランザクションでまとめて保存する
	_, err = db.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			putShelf,
			putOwner,
		},
	})

	if err != nil {
		return fmt.Errorf("本棚と参加情報の保存に失敗: %w", err)
	}
	return nil
}

// 本棚を1件取得する
func GetShelf(ctx context.Context, db *dynamodb.Client, tableName string, shelfID string) (*Shelf, error) {
	result, err := db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(tableName),
		Key: map[string]types.AttributeValue{
			"shelfId": &types.AttributeValueMemberS{Value: shelfID},
		},
		ConsistentRead: aws.Bool(true),
	})
	if err != nil {
		return nil, fmt.Errorf("本棚の取得に失敗: %w", err)
	}

	if len(result.Item) == 0 {
		return nil, nil
	}

	var shelf Shelf
	if err := attributevalue.UnmarshalMap(result.Item, &shelf); err != nil {
		return nil, fmt.Errorf("本棚のデータ変換に失敗: %w", err)
	}

	return &shelf, nil
}

// 指定ユーザーの本棚への参加情報を取得
func GetMembership(ctx context.Context, db *dynamodb.Client, tableName string, shelfID string, userID string) (*Membership, error) {
	result, err := db.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(tableName),
		Key: map[string]types.AttributeValue{
			"shelfId": &types.AttributeValueMemberS{Value: shelfID},
			"userId":  &types.AttributeValueMemberS{Value: userID},
		},
		ConsistentRead: aws.Bool(true),
	})
	if err != nil {
		return nil, fmt.Errorf("参加情報の取得に失敗: %w", err)
	}

	if len(result.Item) == 0 {
		return nil, nil
	}

	var membership Membership
	if err := attributevalue.UnmarshalMap(result.Item, &membership); err != nil {
		return nil, fmt.Errorf("参加情報のデータ変換に失敗: %w", err)
	}

	return &membership, nil
}
