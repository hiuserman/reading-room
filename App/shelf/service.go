package shelf

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/google/uuid"
	"github.com/hiuserman/user"
)

// ハンドラー側のエラー判定用
var (
	ErrInvalidShelfName = errors.New("本棚名はは1-60文字で指定してください")
	ErrUnauthorized     = errors.New("本棚の操作権限がありません")
	ErrProfileRequired  = errors.New("先にプロフィールを登録してください")
)

// 本棚に関するビジネスロジック
type Service struct {
	db           *dynamodb.Client
	shelvesTable string
	membersTable string
	usersTable   string
}

// Serviceのコンストラクタ
func NewService(db *dynamodb.Client, shelvesTable string, membersTable string, usersTable string) *Service {
	return &Service{
		db:           db,
		shelvesTable: shelvesTable,
		membersTable: membersTable,
		usersTable:   usersTable,
	}
}

// 本棚を作成する
func (s *Service) CreateShelf(ctx context.Context, userID string, name string) (*ShelfDetailResponse, error) {
	if userID == "" {
		return nil, ErrUnauthorized
	}
	// 空白削除
	name = strings.TrimSpace(name)

	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 60 {
		return nil, ErrInvalidShelfName
	}

	// JWTの本人IDで、登録済みプロフィールを取得する。
	profile, err := user.GetUser(ctx, s.db, userID, s.usersTable)
	if err != nil {
		return nil, fmt.Errorf("プロフィール取得に失敗: %w", err)
	}
	if profile == nil {
		return nil, ErrProfileRequired
	}

	shelf := Shelf{
		ShelfID:   uuid.NewString(),
		Name:      name,
		CreatedBy: userID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}

	if err := CreateShelfWithOwner(
		ctx,
		s.db,
		s.shelvesTable,
		s.membersTable,
		shelf,
	); err != nil {
		return nil, fmt.Errorf("本棚の作成に失敗: %w", err)
	}

	// 保存に成功したら整形して返す
	response := ShelfDetailResponse{
		ShelfID: shelf.ShelfID,
		Name:    shelf.Name,
		Members: []MemberResponse{
			{
				UserID:      profile.UserID,
				DisplayName: profile.DisplayName,
			},
		},
	}

	return &response, nil
}
