package handlers

import (
	"encoding/json"
	"time"

	"snapgo/internal/executor"
	"snapgo/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type JobHandler struct {
	DB       *gorm.DB
	Executor *executor.Executor
}

type jobForm struct {
	Name          string  `json:"name" binding:"required"`
	CronExpr      string  `json:"cron_expr"`
	SourceIDs     []int64 `json:"source_ids"`
	DestIDs       []int64 `json:"dest_ids"`
	EncryptKey    string  `json:"encrypt_key"`
	NotifyWebhook string  `json:"notify_webhook"`
	Enabled       bool    `json:"enabled"`
}

type jobRow struct {
	ID            int64
	Name          string
	CronExpr      string
	SourceIDs     string
	DestIDs       string
	EncryptKey    string
	NotifyWebhook string
	Enabled       bool
	LastRunAt     *time.Time
	LastStatus    string
}

type sourceRow struct {
	ID         int64
	Name       string
	SourceType string
	Path       string
	Paths      string
	PackMode   string
	DbVacuum   bool
	Compress   bool
}

type destRow struct {
	ID                int64
	Name              string
	DestType          string
	Config            string
	StorageProviderID *int64
	MaxRetention      int
	KeepOne           bool
}

type logRow struct {
	ID        int64
	JobID     int64
	Status    string
	StartedAt time.Time
}

func (h *JobHandler) List(c *gin.Context) {
	var jobs []map[string]interface{}
	h.DB.Table("jobs").Order("id desc").Find(&jobs)
	utils.OK(c, jobs)
}

func (h *JobHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var jobs []map[string]interface{}
	if err := h.DB.Table("jobs").Where("id = ?", id).Find(&jobs).Error; err != nil || len(jobs) == 0 {
		utils.Fail(c, 404, "备份任务不存在")
		return
	}
	utils.OK(c, jobs[0])
}

func idsToJSON(ids []int64) string {
	b, _ := json.Marshal(ids)
	return string(b)
}

func (h *JobHandler) Create(c *gin.Context) {
	var form jobForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	result := h.DB.Table("jobs").Create(map[string]interface{}{
		"name":           form.Name,
		"cron_expr":      form.CronExpr,
		"source_ids":     idsToJSON(form.SourceIDs),
		"dest_ids":       idsToJSON(form.DestIDs),
		"encrypt_key":    form.EncryptKey,
		"notify_webhook": form.NotifyWebhook,
		"enabled":        form.Enabled,
	})
	if result.Error != nil {
		utils.Fail(c, 500, "创建失败: "+result.Error.Error())
		return
	}
	utils.OK(c, gin.H{"id": result.RowsAffected})
}

func (h *JobHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var form jobForm
	if err := c.ShouldBindJSON(&form); err != nil {
		utils.Fail(c, 400, "参数错误: "+err.Error())
		return
	}
	updates := map[string]interface{}{
		"name":           form.Name,
		"cron_expr":      form.CronExpr,
		"source_ids":     idsToJSON(form.SourceIDs),
		"dest_ids":       idsToJSON(form.DestIDs),
		"encrypt_key":    form.EncryptKey,
		"notify_webhook": form.NotifyWebhook,
		"enabled":        form.Enabled,
	}
	result := h.DB.Table("jobs").Where("id = ?", id).Updates(updates)
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "备份任务不存在")
		return
	}
	utils.OK(c, gin.H{"updated": true})
}

func (h *JobHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	result := h.DB.Table("jobs").Delete(&struct{}{}, "id = ?", id)
	if result.RowsAffected == 0 {
		utils.Fail(c, 404, "备份任务不存在")
		return
	}
	utils.OK(c, gin.H{"deleted": true})
}

func loadSources(db *gorm.DB, ids []int64) []executor.SourceItem {
	if len(ids) == 0 {
		return nil
	}
	var rows []sourceRow
	db.Table("sources").Where("id IN ? AND enabled = ?", ids, true).Find(&rows)
	var items []executor.SourceItem
	for _, r := range rows {
		items = append(items, executor.SourceItem{
			ID:         r.ID,
			Name:       r.Name,
			SourceType: r.SourceType,
			Path:       r.Path,
			Paths:      r.Paths,
			PackMode:   r.PackMode,
			DbVacuum:   r.DbVacuum,
			Compress:   r.Compress,
		})
	}
	return items
}

func loadDestinations(db *gorm.DB, ids []int64) []executor.DestItem {
	if len(ids) == 0 {
		return nil
	}
	var rows []destRow
	db.Table("destinations").Where("id IN ? AND enabled = ?", ids, true).Find(&rows)
	var items []executor.DestItem
	for _, r := range rows {
		configStr := resolveDestConfig(db, r.Config, r.StorageProviderID)
		items = append(items, executor.DestItem{
			ID:           r.ID,
			Name:         r.Name,
			DestType:     r.DestType,
			Config:       configStr,
			MaxRetention: r.MaxRetention,
			KeepOne:      r.KeepOne,
		})
	}
	return items
}

func (h *JobHandler) RunNow(c *gin.Context) {
	id := c.Param("id")
	var job jobRow
	if err := h.DB.Table("jobs").Where("id = ?", id).First(&job).Error; err != nil {
		utils.Fail(c, 404, "备份任务不存在")
		return
	}

	var sourceIDs, destIDs []int64
	json.Unmarshal([]byte(job.SourceIDs), &sourceIDs)
	json.Unmarshal([]byte(job.DestIDs), &destIDs)

	sources := loadSources(h.DB, sourceIDs)
	dests := loadDestinations(h.DB, destIDs)

	var logEntry logRow
	logEntry.JobID = job.ID
	logEntry.Status = "running"
	logEntry.StartedAt = time.Now()

	if err := h.DB.Table("job_logs").Create(&logEntry).Error; err != nil {
		utils.Fail(c, 500, "创建日志失败")
		return
	}

	go func(logID int64) {
		result, err := h.Executor.Run(job.Name, sources, dests, job.EncryptKey)
		updates := map[string]interface{}{
			"ended_at":   time.Now(),
			"file_count": 0,
			"size_bytes": 0,
		}
		if result != nil {
			updates["output"] = result.Output
			updates["file_count"] = result.FileCount
			updates["size_bytes"] = result.SizeBytes
		}
		if err != nil {
			updates["status"] = "failed"
			updates["error"] = err.Error()
			h.DB.Table("jobs").Where("id = ?", job.ID).Updates(map[string]interface{}{
				"last_status": "failed",
				"last_run_at": time.Now(),
			})
		} else {
			updates["status"] = "success"
			if result == nil {
				updates["status"] = "failed"
				updates["error"] = "执行返回空结果"
			}
			h.DB.Table("jobs").Where("id = ?", job.ID).Updates(map[string]interface{}{
				"last_status": updates["status"],
				"last_run_at": time.Now(),
			})
		}
		h.DB.Table("job_logs").Where("id = ?", logID).Updates(updates)
	}(logEntry.ID)

	utils.OK(c, gin.H{"message": "备份任务已启动", "log_id": logEntry.ID})
}
