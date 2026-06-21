package config

import (
	"errors"
	"fmt"
	"os"

	toml "github.com/pelletier/go-toml/v2"
)

type Config struct {
	Server   ServerConfig   `toml:"server"`
	Database DatabaseConfig `toml:"database"`
	Security SecurityConfig `toml:"security"`
	Admin    AdminConfig    `toml:"admin"`
	Rclone   RcloneConfig   `toml:"rclone"`
	Log      LogConfig      `toml:"log"`
}

type ServerConfig struct {
	Address string `toml:"address"`
	AutoTLS bool   `toml:"auto_tls"`
}

type DatabaseConfig struct {
	Path string `toml:"path"`
}

type SecurityConfig struct {
	JWTSecret     string `toml:"jwt_secret"`
	EncryptionKey string `toml:"encryption_key"`
	AuthMode      string `toml:"auth_mode"`
	SSOIssuer     string `toml:"sso_issuer"`
	SSOPublicKey  string `toml:"sso_public_key"`
	SSOCookieName string `toml:"sso_cookie_name"`
}

type AdminConfig struct {
	DefaultUsername string `toml:"default_username"`
	DefaultPassword string `toml:"default_password"`
}

type RcloneConfig struct {
	BinPath        string `toml:"bin_path"`
	ConfigPath     string `toml:"config_path"`
	TimeoutSeconds int    `toml:"timeout_seconds"`
}

type LogConfig struct {
	File string `toml:"file"`
}

func Default() Config {
	return Config{
		Server: ServerConfig{
			Address: ":8081",
			AutoTLS: false,
		},
		Database: DatabaseConfig{Path: "./snapgo.db"},
		Security: SecurityConfig{
			JWTSecret:     "change-this-jwt-secret",
			EncryptionKey: "change-this-32-byte-encryption-key!!",
			AuthMode:      "standalone",
			SSOCookieName: "_goauth_token",
		},
		Admin: AdminConfig{
			DefaultUsername: "admin@snapgo.local",
			DefaultPassword: "snapgo",
		},
		Rclone: RcloneConfig{
			BinPath:        "./rclone.exe",
			ConfigPath:     "./rclone.conf",
			TimeoutSeconds: 3600,
		},
		Log: LogConfig{File: "./snapgo.log"},
	}
}

func Load(path string) (Config, error) {
	if path == "" {
		path = "config.toml"
	}
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		cfg := Default()
		if err := Save(path, cfg); err != nil {
			return Config{}, err
		}
		return cfg, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	var cfg Config
	if err := toml.Unmarshal(b, &cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func Save(path string, cfg Config) error {
	content := fmt.Sprintf(`# SnapGo 配置文件

[server]
address = "%s"
auto_tls = %t

[database]
path = "%s"

[security]
auth_mode = "%s"              # "standalone" 或 "sso"
jwt_secret = "%s"
encryption_key = "%s"
# SSO 模式配置（auth_mode = "sso" 时填写）
# sso_issuer = "https://auth.it0731.cn"
# sso_cookie_name = "_goauth_token"
# sso_public_key = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

[admin]
default_username = "%s"
default_password = "%s"

[rclone]
bin_path = "%s"
config_path = "%s"
timeout_seconds = %d

[log]
file = "%s"
`,
		cfg.Server.Address, cfg.Server.AutoTLS,
		cfg.Database.Path,
		cfg.Security.AuthMode, cfg.Security.JWTSecret, cfg.Security.EncryptionKey,
		cfg.Admin.DefaultUsername, cfg.Admin.DefaultPassword,
		cfg.Rclone.BinPath, cfg.Rclone.ConfigPath, cfg.Rclone.TimeoutSeconds,
		cfg.Log.File,
	)
	return os.WriteFile(path, []byte(content), 0644)
}
