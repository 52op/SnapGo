package executor

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/jlaffaye/ftp"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type SourceItem struct {
	ID         int64
	Name       string
	SourceType string
	Path       string
	DbVacuum   bool
	Compress   bool
}

type DestItem struct {
	ID           int64
	Name         string
	DestType     string
	Config       string
	MaxRetention int
	KeepOne      bool
}

type DestConfig struct {
	Type            string `json:"type"`
	Endpoint        string `json:"endpoint"`
	Bucket          string `json:"bucket"`
	Region          string `json:"region"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	URL             string `json:"url"`
	User            string `json:"user"`
	Password        string `json:"password"`
	Path            string `json:"path"`
}

type RunResult struct {
	Output    string
	FileCount int
	SizeBytes int64
}

type Executor struct {
	Timeout time.Duration
}

func New(timeoutSec int) *Executor {
	timeout := time.Duration(timeoutSec) * time.Second
	if timeoutSec <= 0 {
		timeout = 3600 * time.Second
	}
	return &Executor{Timeout: timeout}
}

func (e *Executor) Run(jobName string, sources []SourceItem, dests []DestItem, encryptKey string) (*RunResult, error) {
	if len(sources) == 0 {
		return &RunResult{Output: "没有启用的备份源\n"}, fmt.Errorf("没有启用的备份源")
	}
	if len(dests) == 0 {
		return &RunResult{Output: "没有启用的备份目标\n"}, fmt.Errorf("没有启用的备份目标")
	}

	workDir, err := os.MkdirTemp("", "snapgo-*")
	if err != nil {
		return nil, fmt.Errorf("创建临时目录失败: %w", err)
	}
	defer os.RemoveAll(workDir)

	var outputBuf bytes.Buffer
	var totalFiles int
	var totalBytes int64

	backupDir := filepath.Join(workDir, "backup")
	os.MkdirAll(backupDir, 0755)

	outputBuf.WriteString(fmt.Sprintf("[%s] 开始备份任务: %s\n", time.Now().Format(time.RFC3339), jobName))

	for _, src := range sources {
		outputBuf.WriteString(fmt.Sprintf("处理备份源: %s (%s)\n", src.Name, src.SourceType))
		switch src.SourceType {
		case "sqlite":
			files, size, err := backupSQLite(src.Path, backupDir, src.DbVacuum)
			if err != nil {
				outputBuf.WriteString(fmt.Sprintf("  SQLite 备份失败: %v\n", err))
				continue
			}
			totalFiles += files
			totalBytes += size
			outputBuf.WriteString(fmt.Sprintf("  SQLite 备份完成: %d 文件, %d 字节\n", files, size))

		case "file":
			files, size, err := copyFile(src.Path, backupDir)
			if err != nil {
				outputBuf.WriteString(fmt.Sprintf("  文件复制失败: %v\n", err))
				continue
			}
			totalFiles += files
			totalBytes += size
			outputBuf.WriteString(fmt.Sprintf("  文件复制完成: %d 文件, %d 字节\n", files, size))

		case "directory", "glob":
			files, size, err := copyGlob(src.Path, backupDir)
			if err != nil {
				outputBuf.WriteString(fmt.Sprintf("  文件匹配失败: %v\n", err))
				continue
			}
			totalFiles += files
			totalBytes += size
			outputBuf.WriteString(fmt.Sprintf("  文件匹配完成: %d 文件, %d 字节\n", files, size))
		}

		if src.Compress {
			tarPath := filepath.Join(workDir, src.Name+".tar.gz")
			if err := tarCompress(backupDir, tarPath); err != nil {
				outputBuf.WriteString(fmt.Sprintf("  压缩失败: %v\n", err))
				continue
			}
			os.RemoveAll(backupDir)
			os.MkdirAll(backupDir, 0755)
			os.Rename(tarPath, filepath.Join(backupDir, src.Name+".tar.gz"))
			outputBuf.WriteString(fmt.Sprintf("  压缩完成: %s\n", tarPath))
		}
	}

	if encryptKey != "" {
		outputBuf.WriteString("加密备份文件...\n")
		for _, f := range listFiles(backupDir) {
			encPath := f + ".age"
			if err := encryptFile(f, encPath, encryptKey); err != nil {
				outputBuf.WriteString(fmt.Sprintf("  加密失败 %s: %v\n", f, err))
				continue
			}
			os.Remove(f)
		}
	}

	now := time.Now()
	addTimestampToFiles(backupDir, now)

	for _, dest := range dests {
		outputBuf.WriteString(fmt.Sprintf("传输到目标: %s (%s)\n", dest.Name, dest.DestType))
		if dest.KeepOne {
			outputBuf.WriteString("  清理旧备份（保持唯一）...\n")
			if err := e.CleanAllBackups(dest); err != nil {
				outputBuf.WriteString(fmt.Sprintf("  清理失败: %v\n", err))
			} else {
				outputBuf.WriteString("  清理完成\n")
			}
		}
		if err := e.upload(dest, backupDir, &outputBuf); err != nil {
			outputBuf.WriteString(fmt.Sprintf("  传输失败: %v\n", err))
			continue
		}
		outputBuf.WriteString("  传输完成\n")
		if dest.MaxRetention > 0 {
			outputBuf.WriteString("  清理过期备份...\n")
			if err := e.DeleteOldBackups(dest); err != nil {
				outputBuf.WriteString(fmt.Sprintf("  清理失败: %v\n", err))
			} else {
				outputBuf.WriteString("  清理完成\n")
			}
		}
	}

	if totalFiles == 0 {
		errMsg := "未产生任何备份文件，请检查备份源配置和日志"
		outputBuf.WriteString(fmt.Sprintf("[%s] %s\n", time.Now().Format(time.RFC3339), errMsg))
		return &RunResult{
			Output:    outputBuf.String(),
			FileCount: 0,
			SizeBytes: 0,
		}, fmt.Errorf(errMsg)
	}

	outputBuf.WriteString(fmt.Sprintf("[%s] 备份任务完成\n", time.Now().Format(time.RFC3339)))

	return &RunResult{
		Output:    outputBuf.String(),
		FileCount: totalFiles,
		SizeBytes: totalBytes,
	}, nil
}

func (e *Executor) upload(dest DestItem, srcDir string, buf *bytes.Buffer) error {
	var dc DestConfig
	if err := json.Unmarshal([]byte(dest.Config), &dc); err != nil {
		return fmt.Errorf("解析配置失败: %w", err)
	}

	files := listFiles(srcDir)
	if len(files) == 0 {
		return fmt.Errorf("没有文件需要传输")
	}

	switch dc.Type {
	case "s3":
		return e.uploadToS3(dc, files)
	case "webdav":
		return e.uploadToWebDAV(dc, files)
	case "ftp":
		return e.uploadToFTP(dc, files)
	case "sftp":
		return e.uploadToSFTP(dc, files)
	case "local":
		return e.copyToLocal(dc, files)
	default:
		return fmt.Errorf("不支持的存储类型: %s", dc.Type)
	}
}

func (e *Executor) s3Client(dc DestConfig) (*minio.Client, error) {
	ep := dc.Endpoint
	secure := false
	if strings.HasPrefix(ep, "https://") {
		secure = true
		ep = strings.TrimPrefix(ep, "https://")
	} else if strings.HasPrefix(ep, "http://") {
		ep = strings.TrimPrefix(ep, "http://")
	}
	ep = strings.TrimRight(ep, "/")
	return minio.New(ep, &minio.Options{
		Creds:  credentials.NewStaticV4(dc.AccessKeyID, dc.SecretAccessKey, ""),
		Secure: secure,
		Region: dc.Region,
	})
}

func (e *Executor) uploadToS3(dc DestConfig, files []string) error {
	ctx := context.Background()
	client, err := e.s3Client(dc)
	if err != nil {
		return fmt.Errorf("创建 S3 客户端失败: %w", err)
	}

	bucket := dc.Bucket
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return fmt.Errorf("检查 Bucket 失败: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{Region: dc.Region}); err != nil {
			return fmt.Errorf("创建 Bucket 失败: %w", err)
		}
	}

	for _, f := range files {
		remotePath := dc.Path + "/" + filepath.Base(f)
		remotePath = strings.TrimPrefix(remotePath, "/")
		_, err := client.FPutObject(ctx, bucket, remotePath, f, minio.PutObjectOptions{})
		if err != nil {
			return fmt.Errorf("上传 %s 失败: %w", f, err)
		}
	}
	return nil
}

func (e *Executor) uploadToWebDAV(dc DestConfig, files []string) error {
	client := &http.Client{Timeout: e.Timeout}
	baseURL := strings.TrimRight(dc.URL, "/")

	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			return fmt.Errorf("读取 %s 失败: %w", f, err)
		}
		remotePath := baseURL + "/" + dc.Path + "/" + filepath.Base(f)
		req, err := http.NewRequest("PUT", remotePath, bytes.NewReader(data))
		if err != nil {
			return fmt.Errorf("创建请求失败: %w", err)
		}
		req.SetBasicAuth(dc.User, dc.Password)
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("上传 %s 失败: %w", f, err)
		}
		resp.Body.Close()
		if resp.StatusCode >= 300 {
			return fmt.Errorf("上传 %s 失败: HTTP %d", f, resp.StatusCode)
		}
	}
	return nil
}

func (e *Executor) uploadToFTP(dc DestConfig, files []string) error {
	addr := dc.Endpoint
	if !strings.Contains(addr, ":") {
		addr += ":21"
	}
	client, err := ftp.Dial(addr, ftp.DialWithTimeout(e.Timeout))
	if err != nil {
		return fmt.Errorf("连接 FTP 失败: %w", err)
	}
	defer client.Quit()

	if err := client.Login(dc.User, dc.Password); err != nil {
		return fmt.Errorf("FTP 登录失败: %w", err)
	}

	remoteDir := strings.Trim(dc.Path, "/")
	if remoteDir != "" {
		parts := strings.Split(remoteDir, "/")
		for _, p := range parts {
			client.MakeDir(p)
			client.ChangeDir(p)
		}
	}

	for _, f := range files {
		rd, err := os.Open(f)
		if err != nil {
			return fmt.Errorf("打开 %s 失败: %w", f, err)
		}
		err = client.Stor(filepath.Base(f), rd)
		rd.Close()
		if err != nil {
			return fmt.Errorf("上传 %s 失败: %w", f, err)
		}
	}
	return nil
}

func (e *Executor) uploadToSFTP(dc DestConfig, files []string) error {
	addr := dc.Endpoint
	if !strings.Contains(addr, ":") {
		addr += ":22"
	}
	config := &ssh.ClientConfig{
		User:            dc.User,
		Auth:            []ssh.AuthMethod{ssh.Password(dc.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         e.Timeout,
	}
	conn, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return fmt.Errorf("SSH 连接失败: %w", err)
	}
	defer conn.Close()

	sc, err := sftp.NewClient(conn)
	if err != nil {
		return fmt.Errorf("SFTP 客户端创建失败: %w", err)
	}
	defer sc.Close()

	remoteDir := dc.Path
	if remoteDir != "" {
		parts := strings.Split(strings.Trim(path.Clean(remoteDir), "/"), "/")
		p := "/"
		for _, part := range parts {
			p = path.Join(p, part)
			sc.MkdirAll(p)
		}
	}

	for _, f := range files {
		rp := path.Join(remoteDir, filepath.Base(f))
		dst, err := sc.Create(rp)
		if err != nil {
			return fmt.Errorf("创建远程文件 %s 失败: %w", rp, err)
		}
		src, err := os.Open(f)
		if err != nil {
			dst.Close()
			return fmt.Errorf("打开本地文件 %s 失败: %w", f, err)
		}
		io.Copy(dst, src)
		src.Close()
		dst.Close()
	}
	return nil
}

func (e *Executor) copyToLocal(dc DestConfig, files []string) error {
	dstDir := dc.Path
	if dstDir == "" {
		dstDir = "."
	}
	os.MkdirAll(dstDir, 0755)
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			return fmt.Errorf("读取 %s 失败: %w", f, err)
		}
		dst := filepath.Join(dstDir, filepath.Base(f))
		if err := os.WriteFile(dst, data, 0644); err != nil {
			return fmt.Errorf("写入 %s 失败: %w", dst, err)
		}
	}
	return nil
}

func (e *Executor) TestConnection(dest DestItem) (string, error) {
	var dc DestConfig
	if err := json.Unmarshal([]byte(dest.Config), &dc); err != nil {
		return "", fmt.Errorf("解析配置失败: %w", err)
	}

	switch dc.Type {
	case "s3":
		return e.testS3(dc)
	case "webdav":
		return e.testWebDAV(dc)
	case "ftp":
		return e.testFTP(dc)
	case "sftp":
		return e.testSFTP(dc)
	case "local":
		return e.testLocal(dc)
	default:
		return "", fmt.Errorf("不支持的存储类型: %s", dc.Type)
	}
}

func (e *Executor) testS3(dc DestConfig) (string, error) {
	ctx := context.Background()
	client, err := e.s3Client(dc)
	if err != nil {
		return "", fmt.Errorf("创建 S3 客户端失败: %w", err)
	}

	if err := client.MakeBucket(ctx, dc.Bucket, minio.MakeBucketOptions{Region: dc.Region}); err != nil {
		exists, bucketErr := client.BucketExists(ctx, dc.Bucket)
		if bucketErr != nil {
			return "", fmt.Errorf("连接 S3 失败: %w", bucketErr)
		}
		if !exists {
			return "", fmt.Errorf("创建 Bucket 失败: %w", err)
		}
	}

	return fmt.Sprintf("S3 连接成功！Endpoint: %s, Bucket: %s", dc.Endpoint, dc.Bucket), nil
}

func (e *Executor) testWebDAV(dc DestConfig) (string, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	baseURL := strings.TrimRight(dc.URL, "/")
	req, err := http.NewRequest("PROPFIND", baseURL+"/", nil)
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}
	req.SetBasicAuth(dc.User, dc.Password)
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("连接 WebDAV 失败: %w", err)
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("WebDAV 返回错误: HTTP %d", resp.StatusCode)
	}
	return "WebDAV 连接成功！", nil
}

func (e *Executor) testFTP(dc DestConfig) (string, error) {
	addr := dc.Endpoint
	if !strings.Contains(addr, ":") {
		addr += ":21"
	}
	client, err := ftp.Dial(addr, ftp.DialWithTimeout(10*time.Second))
	if err != nil {
		return "", fmt.Errorf("连接 FTP 失败: %w", err)
	}
	defer client.Quit()

	if err := client.Login(dc.User, dc.Password); err != nil {
		return "", fmt.Errorf("FTP 登录失败: %w", err)
	}
	return "FTP 连接成功！", nil
}

func (e *Executor) testSFTP(dc DestConfig) (string, error) {
	addr := dc.Endpoint
	if !strings.Contains(addr, ":") {
		addr += ":22"
	}
	config := &ssh.ClientConfig{
		User:            dc.User,
		Auth:            []ssh.AuthMethod{ssh.Password(dc.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	conn, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return "", fmt.Errorf("SFTP 连接失败: %w", err)
	}
	conn.Close()
	return "SFTP 连接成功！", nil
}

func (e *Executor) testLocal(dc DestConfig) (string, error) {
	dstDir := dc.Path
	if dstDir == "" {
		dstDir = "."
	}
	info, err := os.Stat(dstDir)
	if err != nil {
		return "", fmt.Errorf("本地路径不存在: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("本地路径不是目录: %s", dstDir)
	}
	return fmt.Sprintf("本地路径可用: %s", dstDir), nil
}

func (e *Executor) CleanAllBackups(dest DestItem) error {
	var dc DestConfig
	if err := json.Unmarshal([]byte(dest.Config), &dc); err != nil {
		return err
	}
	cutoff := time.Now().Add(100 * 365 * 24 * time.Hour)
	switch dc.Type {
	case "s3":
		return e.deleteOldS3(dc, cutoff)
	case "webdav":
		return e.deleteOldWebDAV(dc, cutoff)
	case "ftp":
		return e.deleteOldFTP(dc, cutoff)
	case "sftp":
		return e.deleteOldSFTP(dc, cutoff)
	case "local":
		return e.deleteOldLocal(dc, cutoff)
	}
	return nil
}

func (e *Executor) DeleteOldBackups(dest DestItem) error {
	if dest.MaxRetention <= 0 {
		return nil
	}
	var dc DestConfig
	if err := json.Unmarshal([]byte(dest.Config), &dc); err != nil {
		return err
	}
	cutoff := time.Now().Add(-time.Duration(dest.MaxRetention) * 24 * time.Hour)
	switch dc.Type {
	case "s3":
		return e.deleteOldS3(dc, cutoff)
	case "webdav":
		return e.deleteOldWebDAV(dc, cutoff)
	case "ftp":
		return e.deleteOldFTP(dc, cutoff)
	case "sftp":
		return e.deleteOldSFTP(dc, cutoff)
	case "local":
		return e.deleteOldLocal(dc, cutoff)
	}
	return nil
}

func (e *Executor) deleteOldS3(dc DestConfig, cutoff time.Time) error {
	ctx := context.Background()
	client, err := e.s3Client(dc)
	if err != nil {
		return fmt.Errorf("创建 S3 客户端失败: %w", err)
	}
	bucket := dc.Bucket
	prefix := strings.TrimPrefix(dc.Path, "/")
	if prefix != "" {
		prefix += "/"
	}

	var objects []minio.ObjectInfo
	for obj := range client.ListObjects(ctx, bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true}) {
		if obj.Err != nil {
			return fmt.Errorf("列举文件失败: %w", obj.Err)
		}
		if obj.LastModified.Before(cutoff) {
			objects = append(objects, obj)
		}
	}
	if len(objects) == 0 {
		return nil
	}

	for _, obj := range objects {
		if err := client.RemoveObject(ctx, bucket, obj.Key, minio.RemoveObjectOptions{}); err != nil {
			return fmt.Errorf("删除 %s 失败: %w", obj.Key, err)
		}
	}
	return nil
}

func (e *Executor) deleteOldWebDAV(dc DestConfig, cutoff time.Time) error {
	client := &http.Client{Timeout: e.Timeout}
	baseURL := strings.TrimRight(dc.URL, "/")
	listURL := baseURL + "/" + strings.TrimPrefix(dc.Path, "/")

	req, err := http.NewRequest("PROPFIND", listURL, nil)
	if err != nil {
		return fmt.Errorf("创建 PROPFIND 请求失败: %w", err)
	}
	req.SetBasicAuth(dc.User, dc.Password)
	req.Header.Set("Depth", "1")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("PROPFIND 请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("PROPFIND 返回错误: HTTP %d", resp.StatusCode)
	}

	var ms multistatus
	if err := xml.NewDecoder(resp.Body).Decode(&ms); err != nil {
		return fmt.Errorf("解析 PROPFIND 响应失败: %w", err)
	}

	for _, r := range ms.Responses {
		if strings.HasSuffix(r.Href, "/") {
			continue
		}
		t, err := time.Parse(time.RFC1123, r.Propstat.Prop.GetLastModified)
		if err != nil {
			continue
		}
		if t.Before(cutoff) {
			delURL := baseURL + r.Href
			delReq, err := http.NewRequest("DELETE", delURL, nil)
			if err != nil {
				continue
			}
			delReq.SetBasicAuth(dc.User, dc.Password)
			delResp, err := client.Do(delReq)
			if err != nil {
				continue
			}
			delResp.Body.Close()
		}
	}
	return nil
}

func (e *Executor) deleteOldFTP(dc DestConfig, cutoff time.Time) error {
	addr := dc.Endpoint
	if !strings.Contains(addr, ":") {
		addr += ":21"
	}
	conn, err := ftp.Dial(addr, ftp.DialWithTimeout(e.Timeout))
	if err != nil {
		return fmt.Errorf("连接 FTP 失败: %w", err)
	}
	defer conn.Quit()

	if err := conn.Login(dc.User, dc.Password); err != nil {
		return fmt.Errorf("FTP 登录失败: %w", err)
	}

	remoteDir := strings.Trim(dc.Path, "/")
	if remoteDir != "" {
		conn.ChangeDir(remoteDir)
	}

	entries, err := conn.List("")
	if err != nil {
		return fmt.Errorf("FTP 列举文件失败: %w", err)
	}

	for _, entry := range entries {
		if entry.Type == ftp.EntryTypeFolder {
			continue
		}
		if entry.Time.Before(cutoff) {
			if err := conn.Delete(entry.Name); err != nil {
				return fmt.Errorf("FTP 删除 %s 失败: %w", entry.Name, err)
			}
		}
	}
	return nil
}

func (e *Executor) deleteOldSFTP(dc DestConfig, cutoff time.Time) error {
	addr := dc.Endpoint
	if !strings.Contains(addr, ":") {
		addr += ":22"
	}
	config := &ssh.ClientConfig{
		User:            dc.User,
		Auth:            []ssh.AuthMethod{ssh.Password(dc.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         e.Timeout,
	}
	conn, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return fmt.Errorf("SSH 连接失败: %w", err)
	}
	defer conn.Close()

	sc, err := sftp.NewClient(conn)
	if err != nil {
		return fmt.Errorf("SFTP 客户端创建失败: %w", err)
	}
	defer sc.Close()

	entries, err := sc.ReadDir(dc.Path)
	if err != nil {
		return fmt.Errorf("SFTP 列举目录失败: %w", err)
	}

	for _, info := range entries {
		if info.IsDir() {
			continue
		}
		if info.ModTime().Before(cutoff) {
			fpath := path.Join(dc.Path, info.Name())
			if err := sc.Remove(fpath); err != nil {
				return fmt.Errorf("SFTP 删除 %s 失败: %w", fpath, err)
			}
		}
	}
	return nil
}

func (e *Executor) deleteOldLocal(dc DestConfig, cutoff time.Time) error {
	dstDir := dc.Path
	if dstDir == "" {
		return nil
	}
	entries, err := os.ReadDir(dstDir)
	if err != nil {
		return fmt.Errorf("读取本地目录失败: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(filepath.Join(dstDir, entry.Name()))
		}
	}
	return nil
}

type webdavResponse struct {
	Href     string          `xml:"href"`
	Propstat webdavPropstat  `xml:"propstat"`
}

type webdavPropstat struct {
	Prop webdavProp `xml:"prop"`
}

type webdavProp struct {
	GetLastModified string `xml:"getlastmodified"`
	DisplayName     string `xml:"displayname"`
}

type multistatus struct {
	XMLName   xml.Name         `xml:"multistatus"`
	Responses []webdavResponse `xml:"response"`
}

func addTimestampToFiles(dir string, ts time.Time) {
	tsStr := ts.Format("20060102_150405")
	for _, f := range listFiles(dir) {
		name := filepath.Base(f)
		parent := filepath.Dir(f)
		dotIdx := strings.Index(name, ".")
		var newName string
		if dotIdx == -1 {
			newName = name + "_" + tsStr
		} else {
			newName = name[:dotIdx] + "_" + tsStr + name[dotIdx:]
		}
		os.Rename(f, filepath.Join(parent, newName))
	}
}

func listFiles(dir string) []string {
	var files []string
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			files = append(files, path)
		}
		return nil
	})
	return files
}

func encryptFile(src, dst, pubKey string) error {
	cmd := execFromPath("age", "-r", pubKey, "-o", dst, src)
	out, err := cmd.CombinedOutput()
	if err != nil {
		if execErr, ok := err.(*exec.Error); ok && execErr.Err == exec.ErrNotFound {
			return fmt.Errorf("age 未安装，无法加密")
		}
		return fmt.Errorf("age 加密失败: %s, %w", string(out), err)
	}
	return nil
}

func execFromPath(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	return cmd
}

func tarCompress(srcDir, tarPath string) error {
	fw, err := os.Create(tarPath)
	if err != nil {
		return fmt.Errorf("创建压缩文件失败: %w", err)
	}
	defer fw.Close()

	gzw := gzip.NewWriter(fw)
	defer gzw.Close()

	tw := tar.NewWriter(gzw)
	defer tw.Close()

	entries, err := os.ReadDir(srcDir)
	if err != nil {
		return fmt.Errorf("读取备份目录失败: %w", err)
	}

	for _, entry := range entries {
		fpath := filepath.Join(srcDir, entry.Name())
		info, err := os.Stat(fpath)
		if err != nil {
			continue
		}
		if info.IsDir() {
			continue
		}
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			continue
		}
		header.Name = entry.Name()
		if err := tw.WriteHeader(header); err != nil {
			return fmt.Errorf("写入 tar 头失败: %w", err)
		}
		data, err := os.ReadFile(fpath)
		if err != nil {
			return fmt.Errorf("读取 %s 失败: %w", fpath, err)
		}
		if _, err := tw.Write(data); err != nil {
			return fmt.Errorf("写入 tar 数据失败: %w", err)
		}
	}
	return nil
}

func copyFile(src, dstDir string) (int, int64, error) {
	info, err := os.Stat(src)
	if err != nil {
		return 0, 0, err
	}
	data, err := os.ReadFile(src)
	if err != nil {
		return 0, 0, err
	}
	dst := filepath.Join(dstDir, filepath.Base(src))
	if err := os.WriteFile(dst, data, info.Mode()); err != nil {
		return 0, 0, err
	}
	return 1, info.Size(), nil
}

func copyGlob(pattern string, dstDir string) (int, int64, error) {
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return 0, 0, err
	}
	var totalFiles int
	var totalBytes int64
	for _, m := range matches {
		f, s, err := copyFile(m, dstDir)
		if err != nil {
			continue
		}
		totalFiles += f
		totalBytes += s
	}
	if totalFiles == 0 {
		return 0, 0, fmt.Errorf("未匹配到任何文件: %s", pattern)
	}
	return totalFiles, totalBytes, nil
}

func backupSQLite(dbPath, dstDir string, vacuum bool) (int, int64, error) {
	_, err := os.Stat(dbPath)
	if err != nil {
		return 0, 0, err
	}
	basename := strings.TrimSuffix(filepath.Base(dbPath), ".db") + "_backup.db"
	dstPath := filepath.Join(dstDir, basename)

	if vacuum {
		db, err := sql.Open("sqlite", dbPath)
		if err != nil {
			return 0, 0, fmt.Errorf("打开数据库失败: %w", err)
		}
		defer db.Close()
		escapedPath := strings.ReplaceAll(dstPath, "'", "''")
		_, err = db.Exec(fmt.Sprintf("VACUUM INTO '%s'", escapedPath))
		if err != nil {
			return 0, 0, fmt.Errorf("VACUUM INTO 失败: %w", err)
		}
	} else {
		data, err := os.ReadFile(dbPath)
		if err != nil {
			return 0, 0, err
		}
		if err := os.WriteFile(dstPath, data, 0644); err != nil {
			return 0, 0, err
		}
	}

	dstInfo, _ := os.Stat(dstPath)
	return 1, dstInfo.Size(), nil
}
