package middleware

import (
	"strings"

	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
)

func RequireAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "未授权，请先登录"})
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		claims, err := utils.ParseToken(secret, token)
		if err != nil {
			c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "登录凭证无效或已过期"})
			return
		}
		if claims.Role != "admin" {
			c.AbortWithStatusJSON(403, gin.H{"code": 403, "message": "无权访问，仅管理员可操作"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}
