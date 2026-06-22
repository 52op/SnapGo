package handlers

import (
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
