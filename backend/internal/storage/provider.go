package storage

import (
	"context"
	"time"
)

// Provider is the interface for interacting with an object storage backend.
// All provider implementations must be safe for concurrent use.
type Provider interface {
	ListBuckets(ctx context.Context) ([]Bucket, error)
	CreateBucket(ctx context.Context, name, region string) error
	DeleteBucket(ctx context.Context, name string) error
	Ping(ctx context.Context) error
}

// Bucket is a normalized storage container (S3 bucket, GCS bucket, Azure container, etc.).
type Bucket struct {
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Region    string    `json:"region,omitempty"`
}
