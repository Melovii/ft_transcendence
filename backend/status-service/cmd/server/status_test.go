package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// The age must track the newest file at any depth — the Elasticsearch
// snapshot repository nests directories.
func TestNewestArtifactAgeFindsNewestAtAnyDepth(t *testing.T) {
	dir := t.TempDir()

	if age, err := newestArtifactAge(dir); err != nil {
		t.Fatalf("empty directory errored: %v", err)
	} else if age != -1 {
		t.Errorf("empty directory age = %v, want -1 (none exists)", age)
	}

	old := filepath.Join(dir, "old.dump")
	if err := os.WriteFile(old, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(old, time.Now().Add(-3*time.Hour), time.Now().Add(-3*time.Hour)); err != nil {
		t.Fatal(err)
	}
	nested := filepath.Join(dir, "sub", "deeper", "new.dump")
	if err := os.MkdirAll(filepath.Dir(nested), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(nested, []byte("y"), 0o600); err != nil {
		t.Fatal(err)
	}

	age, err := newestArtifactAge(dir)
	if err != nil {
		t.Fatal(err)
	}
	if age < 0 || age > 2 {
		t.Errorf("age = %v seconds, want between 0 and 2", age)
	}
}

func TestNewestArtifactAgeMissingDirectory(t *testing.T) {
	if _, err := newestArtifactAge(filepath.Join(t.TempDir(), "nope")); err == nil {
		t.Fatal("missing directory must be an error, not a silent -1")
	}
}