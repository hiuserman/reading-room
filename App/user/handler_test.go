package user

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestMeRequiresAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, method := range []string{http.MethodGet, http.MethodPost} {
		t.Run(method, func(t *testing.T) {
			router := gin.New()
			handler := NewHandler(nil, "UnusedTable")

			router.GET("/api/me", handler.GetMe)
			router.POST("/api/me", handler.CreateMe)

			request := httptest.NewRequest(method, "/api/me", nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", response.Code)
			}
		})
	}
}

func TestCreateMeRejectsInvalidInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name string
		body string
		want int
	}{
		{"不正JSON", `{`, http.StatusBadRequest},
		{"名前なし", `{}`, http.StatusBadRequest},
		{"空白だけ", `{"display_name":"   "}`, http.StatusBadRequest},
		{
			"31文字",
			`{"display_name":"` + strings.Repeat("あ", 31) + `"}`,
			http.StatusBadRequest,
		},
		{
			"大きすぎるJSON",
			`{"display_name":"` + strings.Repeat("a", 5000) + `"}`,
			http.StatusRequestEntityTooLarge,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			handler := NewHandler(nil, "UnusedTable")

			// テスト内だけで認証済み状態を再現する。
			router.POST("/api/me", func(c *gin.Context) {
				c.Set("userID", "test-user")
				c.Next()
			}, handler.CreateMe)

			request := httptest.NewRequest(
				http.MethodPost,
				"/api/me",
				strings.NewReader(tt.body),
			)
			request.Header.Set("Content-Type", "application/json")

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != tt.want {
				t.Fatalf(
					"status = %d, want %d; body = %s",
					response.Code,
					tt.want,
					response.Body.String(),
				)
			}
		})
	}
}
