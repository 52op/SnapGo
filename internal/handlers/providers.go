package handlers

import (
	"encoding/json"
	"fmt"
	"snapgo/internal/executor"
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProviderHandler struct {
	DB       *gorm.DB
	Executor *executor.Executor
}

type providerForm struct {
	Name     string `json:"name" binding:"required"`
	DestType string `json:"dest_type" binding:"required"`
	Config   string `json:"config" binding:"required"`
}

func (h *ProviderHandler) List(c *gin.Context) {
	var providers []map[string]interface{}
	h.DB.Table("storage_providers").Order("id asc").Find(&providers)
	utils.OK(c, providers)
}

func (h *ProviderHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var providers []map[string]interface{}
	if err := h.DB.Table("storage_providers").Where("id = ?", id).Find(&providers).Error; err != nil || len(providers) == 0 {
		utils.Fail(c, 404, "存储提供商不存在")
		return
	}
	utils.OK(c, providers[0])
}

func (h *ProviderHandler) Create(c *gin.Context) {
	var form providerForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	var dc map[string]interface{}
	if err := json.Unmarshal([]byte(form.Config), &dc); err != nil {
		utils.Fail(c, 400, "配置格式错误")
		return
	}
	dc["type"] = form.DestType
	merged, _ := json.Marshal(dc)
	result := h.DB.Table("storage_providers").Create(map[string]interface{}{
		"name":      form.Name,
		"dest_type": form.DestType,
		"config":    string(merged),
	})
	if result.Error != nil {
		utils.Fail(c, 500, "创建失败: "+result.Error.Error())
		return
	}
	utils.OK(c, gin.H{"id": result.RowsAffected})
}

func (h *ProviderHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var form providerForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	var dc map[string]interface{}
	if err := json.Unmarshal([]byte(form.Config), &dc); err != nil {
		utils.Fail(c, 400, "配置格式错误")
		return
	}
	dc["type"] = form.DestType
	merged, _ := json.Marshal(dc)
	result := h.DB.Table("storage_providers").Where("id = ?", id).Updates(map[string]interface{}{
		"name":      form.Name,
		"dest_type": form.DestType,
		"config":    string(merged),
	})
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "存储提供商不存在")
		return
	}
	utils.OK(c, gin.H{"updated": true})
}

func (h *ProviderHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	var count int64
	h.DB.Table("destinations").Where("storage_provider_id = ?", id).Count(&count)
	if count > 0 {
		utils.Fail(c, 400, fmt.Sprintf("该提供商正被 %d 个备份目标引用，请先删除或修改那些备份目标", count))
		return
	}
	result := h.DB.Table("storage_providers").Delete(&struct{}{}, "id = ?", id)
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "存储提供商不存在")
		return
	}
	utils.OK(c, gin.H{"deleted": true})
}

func (h *ProviderHandler) Test(c *gin.Context) {
	var form struct {
		DestType string `json:"dest_type" binding:"required"`
		Config   string `json:"config" binding:"required"`
	}
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	item := executor.DestItem{
		Name:     "test",
		DestType: form.DestType,
		Config:   form.Config,
	}
	msg, err := h.Executor.TestConnection(item)
	if err != nil {
		utils.Fail(c, 400, "连接测试失败: "+err.Error()+"\n"+msg)
		return
	}
	utils.OK(c, gin.H{"message": msg})
}
