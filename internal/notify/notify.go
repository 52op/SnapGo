package notify

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"
)

func SendEmail(db *gorm.DB, jobName string, jobNotifyEmail bool, updates map[string]interface{}) {
	if !jobNotifyEmail {
		return
	}

	var apiKey, formailURL, siteTitle, notifyEmailAddr string
	db.Table("system_settings").Where("`key` = ?", "formail_apikey").Select("value").Row().Scan(&apiKey)
	db.Table("system_settings").Where("`key` = ?", "formail_url").Select("value").Row().Scan(&formailURL)
	db.Table("system_settings").Where("`key` = ?", "site_title").Select("value").Row().Scan(&siteTitle)
	db.Table("system_settings").Where("`key` = ?", "notify_email").Select("value").Row().Scan(&notifyEmailAddr)

	if apiKey == "" || formailURL == "" || notifyEmailAddr == "" {
		log.Printf("[邮件通知] 跳过: formail_apikey=%v, formail_url=%v, notify_email=%v", apiKey != "", formailURL != "", notifyEmailAddr != "")
		return
	}
	if siteTitle == "" {
		siteTitle = "SnapGo"
	}

	status := "成功"
	if s, ok := updates["status"].(string); ok && s == "failed" {
		status = "失败"
	}

	subject := fmt.Sprintf("[%s] 备份任务 [%s] 执行%s", siteTitle, jobName, status)
	text := fmt.Sprintf("备份任务 [%s] 已于 %s 执行%s", jobName, time.Now().Format("2006-01-02 15:04:05"), status)

	body := fmt.Sprintf(`{"to":"%s","subject":"%s","text":"%s"}`, notifyEmailAddr, subject, text)
	apiURL := strings.TrimRight(formailURL, "/") + "/v1/emails"
	log.Printf("[邮件通知] 发送到 %s, URL=%s", notifyEmailAddr, apiURL)

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(body))
	if err != nil {
		log.Printf("[邮件通知] 创建请求失败: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[邮件通知] 发送失败: %v", err)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[邮件通知] 发送成功, status=%d", resp.StatusCode)
	} else {
		log.Printf("[邮件通知] 发送失败, status=%d, body=%s", resp.StatusCode, string(respBody))
	}
}
