package db

import (
	"strings"
	"testing"
	"testing/fstest"
)

func TestLoadMigrations_Embedded(t *testing.T) {
	t.Parallel()
	ms, err := loadMigrations(migrationFS)
	if err != nil {
		t.Fatalf("loadMigrations() error = %v", err)
	}
	if len(ms) < 2 {
		t.Fatalf("want at least 2 migrations, got %d", len(ms))
	}
	if ms[0].Version != "001" {
		t.Fatalf("first migration = %s, want 001", ms[0].Version)
	}
	for i := 1; i < len(ms); i++ {
		if ms[i-1].Version >= ms[i].Version {
			t.Fatalf("migrations not strictly ordered: %s then %s", ms[i-1].Name, ms[i].Name)
		}
	}
	for _, m := range ms {
		if strings.TrimSpace(m.SQL) == "" {
			t.Fatalf("migration %s is empty", m.Name)
		}
	}
}

func TestLoadMigrations_SortsAndValidates(t *testing.T) {
	t.Parallel()
	fsys := fstest.MapFS{
		"migrations/010_b.sql": {Data: []byte("SELECT 2;")},
		"migrations/002_a.sql": {Data: []byte("SELECT 1;")},
	}
	ms, err := loadMigrations(fsys)
	if err != nil {
		t.Fatalf("loadMigrations() error = %v", err)
	}
	if ms[0].Name != "002_a.sql" || ms[1].Name != "010_b.sql" {
		t.Fatalf("unexpected order: %s, %s", ms[0].Name, ms[1].Name)
	}
}

func TestLoadMigrations_Rejects(t *testing.T) {
	t.Parallel()
	tests := map[string]fstest.MapFS{
		"bad name": {"migrations/init.sql": {Data: []byte("x")}},
		"duplicate version": {
			"migrations/003_a.sql": {Data: []byte("x")},
			"migrations/003_b.sql": {Data: []byte("y")},
		},
	}
	for name, fsys := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			if _, err := loadMigrations(fsys); err == nil {
				t.Fatal("want error, got nil")
			}
		})
	}
}
