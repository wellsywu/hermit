package handlers

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func parseUpload(t *testing.T, filename string) *multipart.FileHeader {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, err := w.CreateFormFile("files", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte("content")); err != nil {
		t.Fatalf("write part: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	req := httptest.NewRequest("POST", "/api/v1/skills", &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if err := req.ParseMultipartForm(1 << 20); err != nil {
		t.Fatalf("parse multipart: %v", err)
	}
	headers := req.MultipartForm.File["files"]
	if len(headers) != 1 {
		t.Fatalf("got %d file headers, want 1", len(headers))
	}
	return headers[0]
}

func TestUploadPathKeepsDirectories(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		filename string
		want     string
	}{
		{"top level", "SKILL.md", "SKILL.md"},
		{"nested", "scripts/lib/diff.py", "scripts/lib/diff.py"},
		{"single folder", "references/checklist.md", "references/checklist.md"},
		// Returned untouched on purpose: rejecting it is the service layer's job.
		{"traversal is passed through for the service to reject", "../evil.sh", "../evil.sh"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			header := parseUpload(t, tt.filename)
			if got := uploadPath(header); got != tt.want {
				t.Errorf("uploadPath() = %q, want %q", got, tt.want)
			}
		})
	}
}

// Documents why uploadPath exists: the stdlib field drops the directories.
func TestFileHeaderFilenameDropsDirectories(t *testing.T) {
	t.Parallel()
	header := parseUpload(t, "scripts/lib/diff.py")
	if header.Filename != "diff.py" {
		t.Skipf("stdlib no longer strips directories (got %q)", header.Filename)
	}
}

func TestUploadPathFallsBackToFilename(t *testing.T) {
	t.Parallel()
	header := &multipart.FileHeader{Filename: "plain.txt"}
	if got := uploadPath(header); got != "plain.txt" {
		t.Errorf("uploadPath() = %q, want %q", got, "plain.txt")
	}
	if got := uploadPath(nil); got != "" {
		t.Errorf("uploadPath(nil) = %q, want empty", got)
	}
}
