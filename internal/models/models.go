package models

import (
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type User struct {
	ID           int64  `json:"id" gorm:"primaryKey"`
	Username     string `json:"username" gorm:"unique;not null"`
	PasswordHash string `json:"-"`
	Email        string `json:"email"`
	Role         string `json:"role" gorm:"default:user"`
	DisplayName  string `json:"display_name"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Source struct {
	ID         int64     `json:"id" gorm:"primaryKey"`
	Name       string    `json:"name" gorm:"not null"`
	SourceType string    `json:"source_type" gorm:"not null"`
	Path       string    `json:"path" gorm:"size:500;not null"`
	Paths      string    `json:"paths" gorm:"size:2000"`
	PackMode   string    `json:"pack_mode" gorm:"size:20;default:bundle"`
	DbVacuum   bool      `json:"db_vacuum" gorm:"default:true"`
	Compress   bool      `json:"compress" gorm:"default:true"`
	Enabled    bool      `json:"enabled" gorm:"default:true"`
	SortOrder  int       `json:"sort_order" gorm:"default:0"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type Destination struct {
	ID                int64     `json:"id" gorm:"primaryKey"`
	Name              string    `json:"name" gorm:"not null"`
	DestType          string    `json:"dest_type" gorm:"not null"`
	Config            string    `json:"config" gorm:"type:text;not null"`
	StorageProviderID *int64    `json:"storage_provider_id" gorm:"default:null"`
	MaxRetention      int       `json:"max_retention" gorm:"default:30"`
	KeepOne           bool      `json:"keep_one" gorm:"default:false"`
	Enabled           bool      `json:"enabled" gorm:"default:true"`
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type StorageProvider struct {
	ID        int64     `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:200;not null"`
	DestType  string    `json:"dest_type" gorm:"size:20;not null"`
	Config    string    `json:"config" gorm:"type:text;not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Job struct {
	ID            int64      `json:"id" gorm:"primaryKey"`
	Name          string     `json:"name" gorm:"not null"`
	CronExpr      string     `json:"cron_expr"`
	SourceIDs     string     `json:"source_ids" gorm:"type:text"`
	DestIDs       string     `json:"dest_ids" gorm:"type:text"`
	EncryptKey    string     `json:"encrypt_key" gorm:"type:text"`
	NotifyWebhook string     `json:"notify_webhook"`
	Enabled       bool       `json:"enabled" gorm:"default:true"`
	LastRunAt     *time.Time `json:"last_run_at"`
	LastStatus    string     `json:"last_status" gorm:"default:''"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type JobLog struct {
	ID        int64     `json:"id" gorm:"primaryKey"`
	JobID     int64     `json:"job_id" gorm:"index"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at"`
	Output    string    `json:"output" gorm:"type:text"`
	Error     string    `json:"error" gorm:"type:text"`
	FileCount int       `json:"file_count" gorm:"default:0"`
	SizeBytes int64     `json:"size_bytes" gorm:"default:0"`
}

func InitDB(dbPath string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&User{}, &Source{}, &Destination{}, &StorageProvider{}, &Job{}, &JobLog{}); err != nil {
		return nil, err
	}
	return db, nil
}
