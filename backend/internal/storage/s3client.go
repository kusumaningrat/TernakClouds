package storage

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// s3Client implements Provider for all S3-compatible backends:
// MinIO, AWS S3, Google Cloud Storage (HMAC keys), Cloudflare R2, Backblaze B2.
type s3Client struct {
	mc *minio.Client
}

// newS3Client builds an S3-compatible client from an endpoint URL, optional region,
// and a credential string in the format "accessKeyID:secretAccessKey".
//
// Endpoint examples:
//   - MinIO:          https://minio.internal:9000
//   - AWS S3:         https://s3.amazonaws.com  (region must be set separately)
//   - AWS S3 region:  https://s3.us-east-1.amazonaws.com
//   - GCS (HMAC):     https://storage.googleapis.com
//   - Cloudflare R2:  https://<accountID>.r2.cloudflarestorage.com
//   - Backblaze B2:   https://s3.us-west-004.backblazeb2.com
func newS3Client(endpoint, region, credential string) (*s3Client, error) {
	parts := strings.SplitN(credential, ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return nil, fmt.Errorf("invalid credential format: expected accessKeyID:secretAccessKey")
	}
	accessKeyID := parts[0]
	secretAccessKey := parts[1]

	host, secure, err := parseEndpoint(endpoint)
	if err != nil {
		return nil, err
	}

	mc, err := minio.New(host, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKeyID, secretAccessKey, ""),
		Secure: secure,
		Region: region,
	})
	if err != nil {
		return nil, fmt.Errorf("building S3 client: %w", err)
	}
	return &s3Client{mc: mc}, nil
}

func (c *s3Client) ListBuckets(ctx context.Context) ([]Bucket, error) {
	infos, err := c.mc.ListBuckets(ctx)
	if err != nil {
		return nil, err
	}
	buckets := make([]Bucket, len(infos))
	for i, b := range infos {
		buckets[i] = Bucket{
			Name:      b.Name,
			CreatedAt: b.CreationDate,
		}
	}
	return buckets, nil
}

func (c *s3Client) CreateBucket(ctx context.Context, name, region string) error {
	return c.mc.MakeBucket(ctx, name, minio.MakeBucketOptions{Region: region})
}

func (c *s3Client) DeleteBucket(ctx context.Context, name string) error {
	return c.mc.RemoveBucket(ctx, name)
}

func (c *s3Client) Ping(ctx context.Context) error {
	_, err := c.mc.ListBuckets(ctx)
	return err
}

// parseEndpoint extracts the host and TLS flag from a provider endpoint URL.
// Accepts bare hostnames (e.g. "s3.amazonaws.com"), "host:port", or full URLs.
// Defaults to HTTPS (secure: true) when no scheme is present.
func parseEndpoint(endpoint string) (host string, secure bool, err error) {
	if endpoint == "" {
		return "", false, fmt.Errorf("endpoint must not be empty")
	}
	// Bare hostname or host:port — no scheme.
	if !strings.Contains(endpoint, "://") {
		return endpoint, true, nil
	}
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", false, fmt.Errorf("invalid endpoint URL: %w", err)
	}
	secure = u.Scheme == "https"
	host = u.Host
	if host == "" {
		return "", false, fmt.Errorf("endpoint URL has no host: %s", endpoint)
	}
	return host, secure, nil
}
