package handlers

import (
	"log"

	"snapgo/internal/config"
	"snapgo/internal/middleware"
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	DB  *gorm.DB
	Cfg *config.Config
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) AppConfig(c *gin.Context) {
	utils.OK(c, gin.H{
		"auth_mode": h.Cfg.Security.AuthMode,
		"sso_url":   h.Cfg.Security.SSOIssuer,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	if h.Cfg.Security.AuthMode == "sso" {
		utils.Fail(c, 400, "当前为 SSO 模式，请通过 GoAuth 登录")
		return
	}
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Fail(c, 400, "请输入用户名和密码")
		return
	}
	var user struct {
		ID           int64
		Username     string
		PasswordHash string
		Role         string
		DisplayName  string
	}
	if err := h.DB.Raw(`SELECT id, username, password_hash, role, display_name FROM users WHERE username = ? OR email = ?`, req.Username, req.Username).Scan(&user).Error; err != nil {
		utils.Fail(c, 500, "数据库错误")
		return
	}
	if user.ID == 0 {
		utils.Fail(c, 401, "用户名或密码错误")
		return
	}
	if user.PasswordHash == "sso" {
		utils.Fail(c, 401, "该账户为 SSO 账户，请通过 GoAuth 登录")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		utils.Fail(c, 401, "用户名或密码错误")
		return
	}
	token, err := utils.GenerateToken(h.Cfg.Security.JWTSecret, user.ID, user.Username, user.Role)
	if err != nil {
		utils.Fail(c, 500, "令牌生成失败")
		return
	}
	utils.OK(c, gin.H{
		"token": token,
		"user": gin.H{
			"id":           user.ID,
			"username":     user.Username,
			"role":         user.Role,
			"display_name": user.DisplayName,
		},
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.GetInt64("user_id")
	username, _ := c.Get("username")
	email, _ := c.Get("email")
	role, _ := c.Get("role")
	usernameStr, _ := username.(string)
	emailStr, _ := email.(string)
	roleStr, _ := role.(string)
	if usernameStr == "" {
		usernameStr = "unknown"
	}
	if roleStr == "" {
		roleStr = "user"
	}
	utils.OK(c, gin.H{
		"id":           userID,
		"username":     usernameStr,
		"email":        emailStr,
		"role":         roleStr,
		"display_name": usernameStr,
	})
}

func (h *AuthHandler) SSOCallback(c *gin.Context) {
	if h.Cfg.Security.AuthMode != "sso" {
		utils.Fail(c, 400, "当前不是 SSO 模式")
		return
	}
	tokenStr := c.Query("token")
	if tokenStr == "" {
		utils.Fail(c, 400, "缺少 token 参数")
		return
	}
	claims, err := middleware.VerifyRS256TokenForCallback(tokenStr, h.Cfg.Security.SSOIssuer)
	if err != nil {
		utils.Fail(c, 401, "token 验证失败: "+err.Error())
		return
	}
	c.Set("user_id", claims.UserID)
	c.Set("username", claims.Username)
	c.Set("role", claims.Role)
	utils.OK(c, gin.H{"token": tokenStr})
}

func InitAdmin(db *gorm.DB, cfg *config.Config) {
	var count int64
	db.Model(&struct{}{}).Table("users").Count(&count)
	if count > 0 {
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.Admin.DefaultPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("生成管理员密码哈希失败: %v", err)
	}
	email := cfg.Admin.DefaultUsername
	if email == "" {
		email = "admin@snapgo.local"
	}
	if err := db.Exec(
		`INSERT INTO users(username, password_hash, email, role, display_name) VALUES(?,?,?,?,?)`,
		email, string(hash), email, "admin", "Administrator",
	).Error; err != nil {
		log.Fatalf("创建默认管理员失败: %v", err)
	}
	log.Printf("已创建默认管理员: %s", email)
}
