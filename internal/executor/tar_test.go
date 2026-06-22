package executor

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"io"
	"os"
	"path/filepath"
	"testing"
)

// 模拟完整备份流程 + 验证最终上传的文件内容
func TestBackupAndVerifyUpload(t *testing.T) {
	tmpDir := t.TempDir()

	// 模拟备份源
	srcDir := filepath.Join(tmpDir, "src", "formail_web")
	structure := map[string]string{
		"app.js":                     "const app = require('./app')\napp.listen(3000)",
		"package.json":               `{"name":"formail-web"}`,
		"src/components/Header.tsx":  "export function Header() {}",
		"src/components/Footer.tsx":  "export function Footer() {}",
		"src/pages/Home.tsx":         "export default function Home() {}",
		"config/default.json":        `{"port":3000}`,
		"config/production.json":     `{"port":8080}`,
		"data/uploads/avatar.png":    string([]byte{0x89, 0x50, 0x4E, 0x47}),
		"data/uploads/document.pdf":  string(bytes.Repeat([]byte{0x25, 0x50, 0x44, 0x46}, 256)),
		"logs/app.log":               "2026-06-22 INFO started\n",
	}
	for name, content := range structure {
		p := filepath.Join(srcDir, filepath.FromSlash(name))
		os.MkdirAll(filepath.Dir(p), 0755)
		os.WriteFile(p, []byte(content), 0644)
	}

	// 模拟 separate 模式的完整流程
	// 1. copyDirRecursive
	subDir := filepath.Join(tmpDir, "formail_web_0")
	os.MkdirAll(subDir, 0755)
	totalFiles, totalBytes, err := copyDirRecursive(srcDir, subDir)
	if err != nil {
		t.Fatalf("copyDirRecursive: %v", err)
	}
	t.Logf("Step 1 - Copy: %d files, %d bytes", totalFiles, totalBytes)

	// 2. tarCompress
	tarPath := filepath.Join(tmpDir, "formail_web.tar.gz")
	err = tarCompress(subDir, tarPath)
	if err != nil {
		t.Fatalf("tarCompress: %v", err)
	}
	tarInfo, _ := os.Stat(tarPath)
	t.Logf("Step 2 - tar.gz created: %d bytes", tarInfo.Size())

	// 3. 模拟 os.Rename 到 backupDir
	backupDir := filepath.Join(tmpDir, "backup")
	os.MkdirAll(backupDir, 0755)
	err = os.Rename(tarPath, filepath.Join(backupDir, "formail_web.tar.gz"))
	if err != nil {
		t.Fatalf("rename: %v", err)
	}

	// 4. 模拟 addTimestampToFiles
	tsStr := "20260622_152528"
	oldPath := filepath.Join(backupDir, "formail_web.tar.gz")
	newPath := filepath.Join(backupDir, "formail_web_"+tsStr+".tar.gz")
	err = os.Rename(oldPath, newPath)
	if err != nil {
		t.Fatalf("timestamp rename: %v", err)
	}
	t.Logf("Step 3+4 - Renamed to: %s", filepath.Base(newPath))

	// 5. 模拟 listFiles + 读取（上传前）
	uploadedFiles := listFiles(backupDir)
	if len(uploadedFiles) == 0 {
		t.Fatal("listFiles returned empty")
	}
	for _, f := range uploadedFiles {
		t.Logf("Step 5 - Upload candidate: %s", f)
	}

	// 6. 验证: 读取要上传的文件并解压验证
	for _, f := range uploadedFiles {
		tarData, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		hash := sha256.Sum256(tarData)
		t.Logf("File SHA256: %x (size: %d)", hash, len(tarData))

		gzr, err := gzip.NewReader(bytes.NewReader(tarData))
		if err != nil {
			t.Fatalf("gzip reader for %s: %v", f, err)
		}
		tr := tar.NewReader(gzr)
		count := 0
		for {
			hdr, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				t.Fatalf("tar next: %v", err)
			}
			if hdr.Typeflag == tar.TypeReg {
				data, _ := io.ReadAll(tr)
				origPath := filepath.Join(subDir, filepath.FromSlash(hdr.Name))
				origData, _ := os.ReadFile(origPath)
				if !bytes.Equal(origData, data) {
					t.Errorf("MISMATCH: %s", hdr.Name)
				}
				count++
			}
		}
		t.Logf("Verified %d files from %s", count, filepath.Base(f))
	}
	t.Log("ALL OK")
}
