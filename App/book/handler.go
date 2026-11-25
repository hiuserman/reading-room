package book

import (
	"net/http"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DBクライアント
type Handler struct {
	db *dynamodb.Client
}

// main.goから呼び出されるハンドラ関数
func NewHandler(db *dynamodb.Client) *Handler {
	return &Handler{db: db}
}

func (h *Handler) CreateBook(c *gin.Context) {
	var input struct {
		Title   string   `json:"title"`
		Authors []string `json:"authors"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newBook := Book{
		ShelfID:   c.Param("shelfID"),
		BookID:    uuid.New().String(),
		Title:     input.Title,
		Authors:   input.Authors,
		CreatedAt: "2023-01-01T00:00:00Z",
	}

	if err := CreateBook(newBook, h.db); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create book"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Book created successfully"})
}
