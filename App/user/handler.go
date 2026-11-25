package user

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	db        *dynamodb.Client
	tableName string
}

func NewHandler(db *dynamodb.Client, tableName string) *Handler {
	return &Handler{
		db:        db,
		tableName: tableName,
	}
}

func (h *Handler) GetMe(c *gin.Context) {
	// 後で認証middleware作るので、userIDからcontextに入れてもらう
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "ログインが必要です",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		c.Request.Context(),
		3*time.Second,
	)
	defer cancel()

	user, err := GetUser(ctx, h.db, userID, h.tableName)
	if err != nil {
		log.Printf("ユーザー取得に失敗: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "ユーザー情報を取得できません",
		})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "プロフィールが未登録です",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *Handler) CreateMe(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "ログインが必要です",
		})
		return
	}

	var input struct {
		DisplayName string `json:"display_name"`
	}

	// 極端に大きなリクエストを読み込まないよう制限する。
	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		4096,
	)

	if err := c.ShouldBindJSON(&input); err != nil {
		var sizeErr *http.MaxBytesError
		if errors.As(err, &sizeErr) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": "リクエストが大きすぎます",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "JSONの形式が不正です",
		})
		return
	}

	input.DisplayName = strings.TrimSpace(input.DisplayName)
	length := utf8.RuneCountInString(input.DisplayName)

	if length < 1 || length > 30 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "表示名は1〜30文字で入力してください",
		})
		return
	}

	user := User{
		UserID:      userID,
		DisplayName: input.DisplayName,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339Nano),
	}

	ctx, cancel := context.WithTimeout(
		c.Request.Context(),
		3*time.Second,
	)
	defer cancel()

	if err := CreateUser(ctx, h.db, user, h.tableName); err != nil {
		var existsErr *types.ConditionalCheckFailedException

		if errors.As(err, &existsErr) {
			c.JSON(http.StatusConflict, gin.H{
				"error": "プロフィールは登録済みです",
			})
			return
		}

		log.Printf("ユーザー登録に失敗: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "プロフィールを保存できません",
		})
		return
	}

	c.JSON(http.StatusCreated, user)
}
