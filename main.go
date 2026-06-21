package main

import (
	"embed"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"snapgo/internal/config"
	"snapgo/internal/executor"
	"snapgo/internal/handlers"
	"snapgo/internal/middleware"
	"snapgo/internal/models"
	"snapgo/internal/scheduler"

	"github.com/gin-gonic/gin"
)

//go:embed web/dist/*
var webFS embed.FS

func detectContentType(path string, data []byte) string {
	ext := filepath.Ext(path)
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".svg":
		return "image/svg+xml"
	case ".ico":
		return "image/x-icon"
	case ".woff2":
		return "font/woff2"
	case ".woff":
		return "font/woff"
	case ".ttf":
		return "font/ttf"
	}
	ct := mime.TypeByExtension(ext)
	if ct != "" {
		return ct
	}
	return http.DetectContentType(data)
}

func main() {
	cfg, err := config.Load("")
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	db, err := models.InitDB(cfg.Database.Path)
	if err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}

	handlers.InitAdmin(db, &cfg)

	exec := executor.New(cfg.Rclone.TimeoutSeconds)

	sched := scheduler.New(db, exec)

	r := gin.Default()

	var mw gin.HandlerFunc
	if cfg.Security.AuthMode == "sso" {
		pub, err := middleware.ParseRSAPublicKey(cfg.Security.SSOPublicKey)
		if err != nil {
			log.Fatalf("解析 SSO 公钥失败: %v", err)
		}
		mw = middleware.RequireAuthSSO(db, pub, cfg.Security.SSOCookieName, cfg.Security.SSOIssuer)
	} else {
		mw = middleware.RequireAuth(cfg.Security.JWTSecret)
	}

	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Status(http.StatusNotFound)
			return
		}
		staticFS, err := fs.Sub(webFS, "web/dist")
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		path := c.Request.URL.Path
		if path == "" || path == "/" {
			path = "index.html"
		}
		path = strings.TrimPrefix(path, "/")
		data, err := fs.ReadFile(staticFS, path)
		if err != nil {
			data, err = fs.ReadFile(staticFS, "index.html")
			if err != nil {
				c.Status(http.StatusNotFound)
				return
			}
		}
		ctype := detectContentType(path, data)
		c.Data(http.StatusOK, ctype, data)
	})

	authHandler := &handlers.AuthHandler{DB: db, Cfg: &cfg}

	api := r.Group("/api")
	api.GET("/app-config", authHandler.AppConfig)
	api.POST("/auth/login", authHandler.Login)
	if cfg.Security.AuthMode == "sso" {
		api.GET("/auth/sso/callback", authHandler.SSOCallback)
	}

	protected := api.Group("")
	protected.Use(mw)

	protected.GET("/auth/me", authHandler.Me)

	jh := &handlers.JobHandler{DB: db, Executor: exec}
	sh := &handlers.SourceHandler{DB: db}
	dh := &handlers.DestinationHandler{DB: db, Executor: exec}
	ph := &handlers.ProviderHandler{DB: db, Executor: exec}
	lh := &handlers.LogHandler{DB: db}
	dash := &handlers.DashboardHandler{DB: db}

	protected.GET("/dashboard/stats", dash.Stats)

	protected.GET("/sources", sh.List)
	protected.GET("/sources/:id", sh.Get)
	protected.POST("/sources", sh.Create)
	protected.PUT("/sources/:id", sh.Update)
	protected.DELETE("/sources/:id", sh.Delete)
	protected.GET("/browse", sh.Browse)

	protected.GET("/destinations", dh.List)
	protected.GET("/destinations/:id", dh.Get)
	protected.POST("/destinations", dh.Create)
	protected.PUT("/destinations/:id", dh.Update)
	protected.DELETE("/destinations/:id", dh.Delete)
	protected.POST("/destinations/:id/test", dh.Test)

	protected.GET("/providers", ph.List)
	protected.GET("/providers/:id", ph.Get)
	protected.POST("/providers", ph.Create)
	protected.PUT("/providers/:id", ph.Update)
	protected.DELETE("/providers/:id", ph.Delete)
	protected.POST("/providers/test", ph.Test)

	protected.GET("/jobs", jh.List)
	protected.GET("/jobs/:id", jh.Get)
	protected.POST("/jobs", jh.Create)
	protected.PUT("/jobs/:id", jh.Update)
	protected.DELETE("/jobs/:id", jh.Delete)
	protected.POST("/jobs/:id/run", jh.RunNow)

	protected.GET("/logs", lh.List)
	protected.GET("/logs/:id", lh.Get)
	protected.DELETE("/logs/:id", lh.Delete)

	sched.Start()

	log.Printf("SnapGo 启动完成, 监听 %s", cfg.Server.Address)
	if err := r.Run(cfg.Server.Address); err != nil {
		log.Fatalf("启动失败: %v", err)
	}
}
