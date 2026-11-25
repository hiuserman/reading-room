package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// middlewareだけを確認するための、テスト用Verifier。
type stubVerifier struct {
	userID string
	err    error
	called bool
	token  string
}

func (v *stubVerifier) VerifyToken(
	ctx context.Context,
	token string,
) (string, error) {
	v.called = true
	v.token = token
	return v.userID, v.err
}

func TestMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		header     string
		userID     string
		err        error
		wantStatus int
		wantCalled bool
	}{
		{
			name:       "ヘッダーなし",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "別の認証方式",
			header:     "Basic test-token",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "トークンなし",
			header:     "Bearer",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "検証失敗",
			header:     "Bearer test-token",
			err:        errors.New("invalid token"),
			wantStatus: http.StatusUnauthorized,
			wantCalled: true,
		},
		{
			name:       "本人IDが空",
			header:     "Bearer test-token",
			wantStatus: http.StatusUnauthorized,
			wantCalled: true,
		},
		{
			name:       "認証成功",
			header:     "Bearer test-token",
			userID:     "user-123",
			wantStatus: http.StatusOK,
			wantCalled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			verifier := &stubVerifier{
				userID: tt.userID,
				err:    tt.err,
			}

			handlerCalled := false
			router := gin.New()

			router.GET("/protected", Middleware(verifier),
				func(c *gin.Context) {
					handlerCalled = true

					if got := c.GetString("userID"); got != tt.userID {
						t.Errorf("userID = %q, want %q", got, tt.userID)
					}

					c.Status(http.StatusOK)
				},
			)

			request := httptest.NewRequest(
				http.MethodGet,
				"/protected",
				nil,
			)
			if tt.header != "" {
				request.Header.Set("Authorization", tt.header)
			}

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d",
					response.Code, tt.wantStatus)
			}

			if verifier.called != tt.wantCalled {
				t.Errorf("verifier called = %v, want %v",
					verifier.called, tt.wantCalled)
			}

			if verifier.called && verifier.token != "test-token" {
				t.Errorf("unexpected token: %q", verifier.token)
			}

			wantHandler := tt.wantStatus == http.StatusOK
			if handlerCalled != wantHandler {
				t.Errorf("handler called = %v, want %v",
					handlerCalled, wantHandler)
			}
		})
	}
}
