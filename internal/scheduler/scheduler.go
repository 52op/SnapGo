package scheduler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"snapgo/internal/executor"
	"snapgo/internal/notify"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

func resolveDestConfig(db *gorm.DB, configStr string, providerID *int64) string {
	if providerID == nil {
		return configStr
	}
	if configStr == "" {
		configStr = `{"path":""}`
	}
	var dc map[string]interface{}
	json.Unmarshal([]byte(configStr), &dc)

	var row struct {
		Config string
	}
	if err := db.Table("storage_providers").Where("id = ?", *providerID).First(&row).Error; err != nil {
		return configStr
	}
	var pc map[string]interface{}
	json.Unmarshal([]byte(row.Config), &pc)
	for k, v := range pc {
		dc[k] = v
	}
	merged, _ := json.Marshal(dc)
	return string(merged)
}

type Scheduler struct {
	cron     *cron.Cron
	db       *gorm.DB
	executor *executor.Executor
	entries  map[int64]cron.EntryID
}

type jobRow struct {
	ID            int64
	Name          string
	CronExpr      string
	SourceIDs     string
	DestIDs       string
	EncryptKey    string
	NotifyWebhook string
	NotifyEmail   bool
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

func New(db *gorm.DB, exec *executor.Executor) *Scheduler {
	return &Scheduler{
		cron:     cron.New(cron.WithLocation(time.Local)),
		db:       db,
		executor: exec,
		entries:  make(map[int64]cron.EntryID),
	}
}

func (s *Scheduler) Start() {
	s.LoadJobs()
	s.cron.Start()
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
}

func (s *Scheduler) LoadJobs() {
	var jobs []jobRow
	s.db.Table("jobs").Find(&jobs)

	for _, j := range jobs {
		if !j.Enabled || j.CronExpr == "" {
			continue
		}
		if _, err := cron.ParseStandard(j.CronExpr); err != nil {
			continue
		}
		job := j
		entryID, err := s.cron.AddFunc(job.CronExpr, func() {
			s.runJob(job)
		})
		if err == nil {
			s.entries[job.ID] = entryID
		}
	}
}

func (s *Scheduler) AddJob(jobID int64, cronExpr string) {
	if _, exists := s.entries[jobID]; exists {
		s.RemoveJob(jobID)
	}
	entryID, err := s.cron.AddFunc(cronExpr, func() {
		var job jobRow
		if err := s.db.Table("jobs").Where("id = ?", jobID).First(&job).Error; err != nil {
			return
		}
		s.runJob(job)
	})
	if err == nil {
		s.entries[jobID] = entryID
	}
}

func (s *Scheduler) RemoveJob(jobID int64) {
	if entryID, ok := s.entries[jobID]; ok {
		s.cron.Remove(entryID)
		delete(s.entries, jobID)
	}
}

func (s *Scheduler) runJob(job jobRow) {
	var sourceIDs, destIDs []int64
	json.Unmarshal([]byte(job.SourceIDs), &sourceIDs)
	json.Unmarshal([]byte(job.DestIDs), &destIDs)

	var sources []executor.SourceItem
	if len(sourceIDs) > 0 {
		var srcRows []sourceRow
		s.db.Table("sources").Where("id IN ? AND enabled = ?", sourceIDs, true).Find(&srcRows)
		for _, r := range srcRows {
			sources = append(sources, executor.SourceItem{
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
	}

	var dests []executor.DestItem
	if len(destIDs) > 0 {
		var dstRows []destRow
		s.db.Table("destinations").Where("id IN ? AND enabled = ?", destIDs, true).Find(&dstRows)
		for _, r := range dstRows {
			configStr := resolveDestConfig(s.db, r.Config, r.StorageProviderID)
			dests = append(dests, executor.DestItem{
				ID:           r.ID,
				Name:         r.Name,
				DestType:     r.DestType,
				Config:       configStr,
				MaxRetention: r.MaxRetention,
				KeepOne:      r.KeepOne,
			})
		}
	}

	var logEntry logRow
	logEntry.JobID = job.ID
	logEntry.Status = "running"
	logEntry.StartedAt = time.Now()
	s.db.Table("job_logs").Create(&logEntry)

	result, err := s.executor.Run(job.Name, sources, dests, job.EncryptKey)

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
		s.db.Table("jobs").Where("id = ?", job.ID).Updates(map[string]interface{}{
			"last_status": "failed",
			"last_run_at": time.Now(),
		})
	} else {
		updates["status"] = "success"
		s.db.Table("jobs").Where("id = ?", job.ID).Updates(map[string]interface{}{
			"last_status": "success",
			"last_run_at": time.Now(),
		})
	}
	s.db.Table("job_logs").Where("id = ?", logEntry.ID).Updates(updates)

	if job.NotifyWebhook != "" {
		notifyWebhook(job, updates)
	}

	if job.NotifyEmail {
		go notify.SendEmail(s.db, job.Name, job.NotifyEmail, updates)
	}
}

func notifyWebhook(job jobRow, updates map[string]interface{}) {
	status := "success"
	if s, ok := updates["status"].(string); ok {
		status = s
	}
	msg := fmt.Sprintf("备份任务 [%s] 执行%s", job.Name, status)
	notifyURL := job.NotifyWebhook + "?msg=" + msg
	http.Get(notifyURL)
}
