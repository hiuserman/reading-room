package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestVerifyToken(t *testing.T) {
	// 正規の署名鍵。テスト終了後には残さない。
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	// 偽の署名を作るための別の鍵。
	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	// RSA公開鍵をJWKS形式で返す。
	jwks := map[string]any{
		"keys": []map[string]string{
			{
				"kty": "RSA",
				"kid": "test-key",
				"use": "sig",
				"alg": "RS256",
				"n": base64.RawURLEncoding.EncodeToString(
					privateKey.PublicKey.N.Bytes(),
				),
				"e": base64.RawURLEncoding.EncodeToString(
					big.NewInt(int64(privateKey.PublicKey.E)).Bytes(),
				),
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/.well-known/jwks.json" {
				http.NotFound(w, r)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			if err := json.NewEncoder(w).Encode(jwks); err != nil {
				t.Errorf("JWKS送信失敗: %v", err)
			}
		},
	))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	verifier, err := NewCognitoVerifier(
		ctx,
		server.URL,
		"test-client",
		"reading-room/access",
	)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name         string
		change       func(*accessClaims)
		wrongKey     bool
		wantOK       bool
		wantScopeErr bool
	}{
		{
			name:   "正常",
			wantOK: true,
		},
		{
			name: "期限切れ",
			change: func(c *accessClaims) {
				c.ExpiresAt = jwt.NewNumericDate(
					time.Now().Add(-time.Hour),
				)
			},
		},
		{
			name: "有効期限なし",
			change: func(c *accessClaims) {
				c.ExpiresAt = nil
			},
		},
		{
			name: "発行元が違う",
			change: func(c *accessClaims) {
				c.Issuer = "https://other.example"
			},
		},
		{
			name: "クライアントが違う",
			change: func(c *accessClaims) {
				c.ClientID = "other-client"
			},
		},
		{
			name: "IDトークン",
			change: func(c *accessClaims) {
				c.TokenUse = "id"
			},
		},
		{
			name: "本人IDなし",
			change: func(c *accessClaims) {
				c.Subject = ""
			},
		},
		{
			name: "必要な権限なし",
			change: func(c *accessClaims) {
				c.Scope = "openid email"
			},
			wantScopeErr: true,
		},
		{
			name:     "別の鍵で署名",
			wrongKey: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims := accessClaims{
				TokenUse: "access",
				ClientID: "test-client",
				Scope:    "openid email reading-room/access",
				RegisteredClaims: jwt.RegisteredClaims{
					Issuer:  server.URL,
					Subject: "user-123",
					ExpiresAt: jwt.NewNumericDate(
						time.Now().Add(time.Hour),
					),
				},
			}

			if tt.change != nil {
				tt.change(&claims)
			}

			token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
			token.Header["kid"] = "test-key"

			signingKey := privateKey
			if tt.wrongKey {
				signingKey = otherKey
			}

			signed, err := token.SignedString(signingKey)
			if err != nil {
				t.Fatal(err)
			}

			userID, err := verifier.VerifyToken(ctx, signed)

			if tt.wantOK {
				if err != nil {
					t.Fatalf("正常なトークンが拒否された: %v", err)
				}
				if userID != "user-123" {
					t.Fatalf("userID = %q, want user-123", userID)
				}
				return
			}

			if err == nil {
				t.Fatal("不正なトークンが受け入れられた")
			}
			if userID != "" {
				t.Fatalf("失敗時に本人IDを返している: %q", userID)
			}
			if tt.wantScopeErr &&
				!errors.Is(err, ErrInsufficientScope) {
				t.Fatalf("想定と違うエラー: %v", err)
			}
		})
	}
}
