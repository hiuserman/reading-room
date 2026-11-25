package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type Verifier interface {
	VerifyToken(ctx context.Context, token string) (string, error)
}

func Middleware(verifier Verifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		Header := c.GetHeader("Authorization")
		parts := strings.Fields(Header)

		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "ログインが必要です",
			})
			return
		}

		userID, err := verifier.VerifyToken(c.Request.Context(), parts[1])
		if err != nil || userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "トークンが無効です",
			})
			return
		}
		c.Set("userID", userID)
		c.Next()
	}
}
