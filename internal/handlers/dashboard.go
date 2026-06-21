package handlers

import (
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	DB *gorm.DB
}

func (h *DashboardHandler) Stats(c *gin.Context) {
	var jobCount, sourceCount, destCount, logCount int64
	var recentLogs []map[string]interface{}

	h.DB.Table("jobs").Count(&jobCount)
	h.DB.Table("sources").Count(&sourceCount)
	h.DB.Table("destinations").Count(&destCount)
	h.DB.Table("job_logs").Order("id desc").Limit(10).Find(&recentLogs)

	utils.OK(c, gin.H{
		"job_count":         jobCount,
		"source_count":      sourceCount,
		"dest_count":        destCount,
		"total_logs":        logCount,
		"recent_executions": recentLogs,
	})
}
