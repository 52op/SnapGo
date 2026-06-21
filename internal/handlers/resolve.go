package handlers

import (
	"encoding/json"

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
