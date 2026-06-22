package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"snapgo/internal/models"
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SettingsHandler struct {
	DB *gorm.DB
}

func (h *SettingsHandler) Get(c *gin.Context) {
	var settings []models.SystemSetting
	h.DB.Find(&settings)

	result := map[string]string{}
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	utils.OK(c, result)
}

func (h *SettingsHandler) Update(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Fail(c, 400, "请求格式无效")
		return
	}

	for key, value := range req {
		h.DB.Where("key = ?", key).Assign(models.SystemSetting{Key: key, Value: value}).FirstOrCreate(&models.SystemSetting{})
	}

	utils.OK(c, gin.H{"updated": true})
}

func (h *SettingsHandler) TestFormail(c *gin.Context) {
	var req struct {
		FormailURL string `json:"formail_url"`
		APIKey     string `json:"apikey"`
		Email      string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Fail(c, 400, "参数错误")
		return
	}

	if req.FormailURL == "" || req.APIKey == "" || req.Email == "" {
		utils.Fail(c, 400, "请填写完整的 Formail 地址、API Key 和测试邮箱")
		return
	}

	apiURL := strings.TrimRight(req.FormailURL, "/") + "/v1/emails"
	body := fmt.Sprintf(`{"to":"%s","subject":"[SnapGo] 测试邮件通知","text":"这是一封测试邮件，如果您收到此邮件，说明 Formail 邮件通知配置正确。\\n\\n发送时间: %s"}`,
		req.Email, time.Now().Format("2006-01-02 15:04:05"))

	httpReq, err := http.NewRequest("POST", apiURL, strings.NewReader(body))
	if err != nil {
		utils.Fail(c, 500, "创建请求失败: "+err.Error())
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		utils.Fail(c, 500, "连接 Formail 失败: "+err.Error())
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		utils.OK(c, gin.H{"message": "测试邮件已发送，请检查收件箱"})
	} else {
		utils.Fail(c, 500, fmt.Sprintf("Formail 返回错误 (HTTP %d): %s", resp.StatusCode, string(respBody)))
	}
}
