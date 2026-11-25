package shelf

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateShelf(c *gin.Context) {
	// auth.Middlewareが設定した本人IDを使う。
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "ログインが必要です",
		})
		return
	}

	var input struct {
		Name string `json:"name"`
	}

	// 読み込むJSONを4KiBまでに制限する。
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

	ctx, cancel := context.WithTimeout(
		c.Request.Context(),
		3*time.Second,
	)
	defer cancel()

	created, err := h.service.CreateShelf(ctx, userID, input.Name)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidShelfName):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "本棚名は1〜60文字で入力してください",
			})
		case errors.Is(err, ErrUnauthorized):
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "ログインが必要です",
			})
		case errors.Is(err, ErrProfileRequired):
			c.JSON(http.StatusForbidden, gin.H{
				"error": "先にプロフィールを登録してください",
			})
		default:
			log.Printf("本棚作成エラー: %v", err)
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "本棚の保存結果を確認できませんでした",
			})
		}
		return
	}

	c.JSON(http.StatusCreated, created)
}
