package handlers

import (
	"os"
	"path/filepath"
	"runtime"
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SourceHandler struct {
	DB *gorm.DB
}

type sourceForm struct {
	Name       string `json:"name" binding:"required"`
	SourceType string `json:"source_type"`
	Path       string `json:"path"`
	Paths      string `json:"paths"`
	PackMode   string `json:"pack_mode"`
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
		"paths":       form.Paths,
		"pack_mode":   form.PackMode,
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
		"paths":       form.Paths,
		"pack_mode":   form.PackMode,
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

func listDriveRoots() []map[string]interface{} {
	var roots []map[string]interface{}
	if runtime.GOOS == "windows" {
		for _, drive := range "ABCDEFGHIJKLMNOPQRSTUVWXYZ" {
			path := string(drive) + ":\\"
			if _, err := os.ReadDir(path); err == nil {
				roots = append(roots, map[string]interface{}{
					"name":   path,
					"is_dir": true,
					"size":   0,
					"path":   path,
				})
			}
		}
	} else {
		roots = append(roots, map[string]interface{}{
			"name":   "/",
			"is_dir": true,
			"size":   0,
			"path":   "/",
		})
	}
	return roots
}

func (h *SourceHandler) Browse(c *gin.Context) {
	browsePath := c.Query("path")
	if browsePath == "" {
		utils.OK(c, listDriveRoots())
		return
	}
	entries, err := os.ReadDir(browsePath)
	if err != nil {
		utils.Fail(c, 400, "读取目录失败: "+err.Error())
		return
	}
	result := make([]map[string]interface{}, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		absPath := filepath.Join(browsePath, entry.Name())
		result = append(result, map[string]interface{}{
			"name":     entry.Name(),
			"is_dir":   entry.IsDir(),
			"size":     info.Size(),
			"mod_time": info.ModTime(),
			"path":     absPath,
		})
	}
	utils.OK(c, result)
}

func (h *SourceHandler) CheckPath(c *gin.Context) {
	p := c.Query("path")
	if p == "" {
		utils.Fail(c, 400, "path is required")
		return
	}
	st, err := os.Stat(p)
	if err != nil {
		utils.OK(c, gin.H{"exists": false, "is_dir": false})
		return
	}
	utils.OK(c, gin.H{"exists": true, "is_dir": st.IsDir()})
}
