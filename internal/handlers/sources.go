package handlers

import (
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SourceHandler struct {
	DB *gorm.DB
}

type sourceForm struct {
	Name       string `json:"name" binding:"required"`
	SourceType string `json:"source_type" binding:"required"`
	Path       string `json:"path" binding:"required"`
	DbVacuum   bool   `json:"db_vacuum"`
	Compress   bool   `json:"compress"`
	Enabled    bool   `json:"enabled"`
	SortOrder  int    `json:"sort_order"`
}

func (h *SourceHandler) List(c *gin.Context) {
	var sources []map[string]interface{}
	h.DB.Table("sources").Order("sort_order asc, id asc").Find(&sources)
	utils.OK(c, sources)
}

func (h *SourceHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var sources []map[string]interface{}
	if err := h.DB.Table("sources").Where("id = ?", id).Find(&sources).Error; err != nil || len(sources) == 0 {
		utils.Fail(c, 404, "备份源不存在")
		return
	}
	utils.OK(c, sources[0])
}

func (h *SourceHandler) Create(c *gin.Context) {
	var form sourceForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	result := h.DB.Table("sources").Create(map[string]interface{}{
		"name":        form.Name,
		"source_type": form.SourceType,
		"path":        form.Path,
		"db_vacuum":   form.DbVacuum,
		"compress":    form.Compress,
		"enabled":     form.Enabled,
		"sort_order":  form.SortOrder,
	})
	if result.Error != nil {
		utils.Fail(c, 500, "创建失败: "+result.Error.Error())
		return
	}
	utils.OK(c, gin.H{"id": result.RowsAffected})
}

func (h *SourceHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var form sourceForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	result := h.DB.Table("sources").Where("id = ?", id).Updates(map[string]interface{}{
		"name":        form.Name,
		"source_type": form.SourceType,
		"path":        form.Path,
		"db_vacuum":   form.DbVacuum,
		"compress":    form.Compress,
		"enabled":     form.Enabled,
		"sort_order":  form.SortOrder,
	})
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "备份源不存在")
		return
	}
	utils.OK(c, gin.H{"updated": true})
}

func (h *SourceHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	result := h.DB.Table("sources").Delete(&struct{}{}, "id = ?", id)
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "备份源不存在")
		return
	}
	utils.OK(c, gin.H{"deleted": true})
}
