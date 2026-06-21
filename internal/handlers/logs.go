package handlers

import (
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LogHandler struct {
	DB *gorm.DB
}

func (h *LogHandler) List(c *gin.Context) {
	jobID := c.Query("job_id")
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("page_size", "50")

	query := h.DB.Table("job_logs").Order("id desc")
	if jobID != "" {
		query = query.Where("job_id = ?", jobID)
	}

	var total int64
	query.Count(&total)

	var logs []map[string]interface{}
	offset := (parseInt(page) - 1) * parseInt(pageSize)
	query.Offset(offset).Limit(parseInt(pageSize)).Find(&logs)

	utils.OK(c, gin.H{
		"items": logs,
		"total": total,
		"page":  page,
	})
}

func (h *LogHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var log []map[string]interface{}
	if err := h.DB.Table("job_logs").Where("id = ?", id).Find(&log).Error; err != nil || len(log) == 0 {
		utils.Fail(c, 404, "日志不存在")
		return
	}
	utils.OK(c, log[0])
}

func (h *LogHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	result := h.DB.Table("job_logs").Delete(&struct{}{}, "id = ?", id)
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "日志不存在")
		return
	}
	utils.OK(c, gin.H{"deleted": true})
}

func parseInt(s string) int {
	i := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			i = i*10 + int(c-'0')
		} else {
			break
		}
	}
	if i < 1 {
		return 1
	}
	return i
}
