package handlers

import (
	"mime"
	"mime/multipart"
	"strings"
)

// uploadPath returns the client-supplied path of an uploaded file, including
// any directories.
//
// multipart.FileHeader.Filename cannot be used for this: the standard library
// passes it through filepath.Base, so "scripts/run.py" arrives as "run.py" and
// a skill with sub-folders is flattened. The raw value is read from the
// Content-Disposition header instead. It is untrusted; the service layer
// rejects absolute and parent-relative paths (sanitizeArchivePath) before
// anything is written.
func uploadPath(header *multipart.FileHeader) string {
	if header == nil {
		return ""
	}
	if _, params, err := mime.ParseMediaType(header.Header.Get("Content-Disposition")); err == nil {
		if name := strings.TrimSpace(params["filename"]); name != "" {
			return name
		}
	}
	return header.Filename
}
