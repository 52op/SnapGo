package middleware

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type ssoClaims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func ParseRSAPublicKey(pemStr string) (*rsa.PublicKey, error) {
	pemStr = strings.ReplaceAll(pemStr, `\n`, "\n")
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not an RSA public key")
	}
	return rsaPub, nil
}

func verifyRS256Token(tokenStr string, pub *rsa.PublicKey, issuer string) (*ssoClaims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &ssoClaims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		return pub, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*ssoClaims)
	if !ok || !t.Valid {
		return nil, errors.New("invalid token")
	}
	if claims.ExpiresAt != nil && claims.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("token expired")
	}
	if issuer != "" && claims.Issuer != issuer {
		return nil, errors.New("invalid issuer")
	}
	return claims, nil
}

func extractBearerToken(c *gin.Context, cookieName string) string {
	if auth := c.GetHeader("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	}
	if cookieName != "" {
		if val, err := c.Cookie(cookieName); err == nil {
			return val
		}
	}
	return ""
}

func ensureSSOUser(db *gorm.DB, claims *ssoClaims) error {
	var count int64
	db.Model(&struct{}{}).Table("users").Where("id = ?", claims.UserID).Count(&count)
	if count > 0 {
		return nil
	}
	username := claims.Username
	if username == "" {
		username = claims.Email
	}
	if username == "" {
		username = "sso_user"
	}
	role := claims.Role
	if role != "admin" {
		role = "user"
	}
	return db.Exec(
		`INSERT INTO users(id, username, password_hash, role, display_name, email) VALUES(?,?,?,?,?,?)`,
		claims.UserID, username, "sso", role, username, claims.Email,
	).Error
}

func RequireAuthSSO(db *gorm.DB, pub *rsa.PublicKey, cookieName string, issuer string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractBearerToken(c, cookieName)
		if tokenStr == "" {
			c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "未授权，请先登录"})
			return
		}
		claims, err := verifyRS256Token(tokenStr, pub, issuer)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "登录凭证无效或已过期"})
			return
		}
		if claims.Role != "admin" {
			c.AbortWithStatusJSON(403, gin.H{"code": 403, "message": "无权访问，仅管理员可操作"})
			return
		}
		if err := ensureSSOUser(db, claims); err != nil {
			c.AbortWithStatusJSON(500, gin.H{"code": 500, "message": "用户同步失败: " + err.Error()})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Next()
	}
}
