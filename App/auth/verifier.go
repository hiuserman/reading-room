package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

var ErrInsufficientScope = errors.New("required scope not found")

// Cognitoのアクセストークン項目
type accessClaims struct {
	TokenUse string `json:"token_use"`
	ClientID string `json:"client_id"`
	Scope    string `json:"scope"`

	jwt.RegisteredClaims
}

// middolewareで使うためのVerifier
type CognitoVerifier struct {
	keys          keyfunc.Keyfunc
	issuer        string
	clientID      string
	requiredScope string
}

func NewCognitoVerifier(ctx context.Context, issuer, clientID, requiredScope string) (*CognitoVerifier, error) {
	issuer = strings.TrimSuffix(issuer, "/")
	clientID = strings.TrimSpace(clientID)
	requiredScope = strings.TrimSpace(requiredScope)

	if issuer == "" || clientID == "" || requiredScope == "" {
		return nil, fmt.Errorf("issuer, clientID, and requiredScope must be provided")
	}

	// issuerは信頼する環境変数から渡す。
	// リクエストや未検証のJWTから取得しない。
	jwksURL := issuer + "/.well-known/jwks.json"

	keys, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return nil, fmt.Errorf("公開鍵の初期化に失敗: %w", err)
	}

	return &CognitoVerifier{
		keys:          keys,
		issuer:        issuer,
		clientID:      clientID,
		requiredScope: requiredScope,
	}, nil
}

func (v *CognitoVerifier) VerifyToken(
	ctx context.Context,
	tokenString string,
) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := ctx.Err(); err != nil {
		return "", err
	}

	var claims accessClaims

	token, err := jwt.ParseWithClaims(
		tokenString,
		&claims,
		v.keys.KeyfuncCtx(ctx),
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithIssuer(v.issuer),
		jwt.WithExpirationRequired(),
	)

	if err != nil {
		return "", fmt.Errorf("JWT検証に失敗: %w", err)
	}

	if !token.Valid {
		return "", errors.New("無効なトークンです")
	}

	if claims.TokenUse != "access" {
		return "", errors.New("アクセストークンではありません")
	}

	if claims.ClientID != v.clientID {
		return "", errors.New("クライアントIDが一致しません")
	}

	if claims.Subject == "" {
		return "", errors.New("ユーザーIDがありません")
	}

	for _, scope := range strings.Fields(claims.Scope) {
		if scope == v.requiredScope {
			return claims.Subject, nil
		}
	}

	return "", ErrInsufficientScope
}
