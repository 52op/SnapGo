package handlers

import (
	"encoding/json"
	"snapgo/internal/executor"
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DestinationHandler struct {
	DB       *gorm.DB
	Executor *executor.Executor
}

type destForm struct {
	Name              string `json:"name" binding:"required"`
	DestType          string `json:"dest_type" binding:"required"`
	Config            string `json:"config"`
	StorageProviderID *int64 `json:"storage_provider_id"`
	MaxRetention      int    `json:"max_retention"`
	KeepOne           bool   `json:"keep_one"`
	Enabled           bool   `json:"enabled"`
}





func (h *DestinationHandler) List(c *gin.Context) {
	var dests []map[string]interface{}
	h.DB.Table("destinations").Order("id asc").Find(&dests)
	utils.OK(c, dests)
}

func (h *DestinationHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var dests []map[string]interface{}
	if err := h.DB.Table("destinations").Where("id = ?", id).Find(&dests).Error; err != nil || len(dests) == 0 {
		utils.Fail(c, 404, "备份目标不存在")
		return
	}
	utils.OK(c, dests[0])
}

func ensurePath(configStr, name string) string {
	if configStr == "" {
		return `{"path":"` + name + `"}`
	}
	var dc map[string]interface{}
	if err := json.Unmarshal([]byte(configStr), &dc); err != nil {
		return configStr
	}
	if p, ok := dc["path"].(string); !ok || p == "" {
		dc["path"] = name
		merged, _ := json.Marshal(dc)
		return string(merged)
	}
	return configStr
}

func (h *DestinationHandler) Create(c *gin.Context) {
	var form destForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	configStr := ensurePath(form.Config, form.Name)
	result := h.DB.Table("destinations").Create(map[string]interface{}{
		"name":                form.Name,
		"dest_type":           form.DestType,
		"config":              configStr,
		"storage_provider_id": form.StorageProviderID,
		"max_retention":       form.MaxRetention,
		"keep_one":            form.KeepOne,
		"enabled":             form.Enabled,
	})
	if result.Error != nil {
		utils.Fail(c, 500, "创建失败: "+result.Error.Error())
		return
	}
	utils.OK(c, gin.H{"id": result.RowsAffected})
}

func (h *DestinationHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var form destForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	configStr := ensurePath(form.Config, form.Name)
	result := h.DB.Table("destinations").Where("id = ?", id).Updates(map[string]interface{}{
		"name":                form.Name,
		"dest_type":           form.DestType,
		"config":              configStr,
		"storage_provider_id": form.StorageProviderID,
		"max_retention":       form.MaxRetention,
		"keep_one":            form.KeepOne,
		"enabled":             form.Enabled,
	})
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "备份目标不存在")
		return
	}
	utils.OK(c, gin.H{"updated": true})
}

func (h *DestinationHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	result := h.DB.Table("destinations").Delete(&struct{}{}, "id = ?", id)
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "备份目标不存在")
		return
	}
	utils.OK(c, gin.H{"deleted": true})
}

func (h *DestinationHandler) Test(c *gin.Context) {
	id := c.Param("id")
	var dest struct {
		ID                int64
		Name              string
		DestType          string `gorm:"column:dest_type"`
		Config            string
		StorageProviderID *int64
		MaxRetention      int
		KeepOne           bool
	}
	if err := h.DB.Table("destinations").Where("id = ?", id).First(&dest).Error; err != nil {
		utils.Fail(c, 404, "备份目标不存在")
		return
	}

	configStr := resolveDestConfig(h.DB, dest.Config, dest.StorageProviderID)

	item := executor.DestItem{
		ID:           dest.ID,
		Name:         dest.Name,
		DestType:     dest.DestType,
		Config:       configStr,
		MaxRetention: dest.MaxRetention,
		KeepOne:      dest.KeepOne,
	}

	msg, err := h.Executor.TestConnection(item)
	if err != nil {
		utils.Fail(c, 400, "连接测试失败: "+err.Error()+"\n"+msg)
		return
	}
	utils.OK(c, gin.H{"message": msg})
}
