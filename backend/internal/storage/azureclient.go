package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// azureClient implements Provider for Azure Blob Storage using Shared Key auth.
// No Azure SDK required — only stdlib.
type azureClient struct {
	accountName string
	accountKey  []byte
	httpClient  *http.Client
}

// newAzureClient creates an Azure Blob Storage client.
// credential format: "accountName:accountKey"
// accountKey must be the base64-encoded storage account key (as shown in the Azure portal).
func newAzureClient(credential string) (*azureClient, error) {
	parts := strings.SplitN(credential, ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return nil, fmt.Errorf("invalid credential format: expected accountName:base64AccountKey")
	}
	accountName := parts[0]
	key, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid account key (expected base64-encoded): %w", err)
	}
	return &azureClient{
		accountName: accountName,
		accountKey:  key,
		httpClient:  &http.Client{Timeout: 15 * time.Second},
	}, nil
}

// ListBuckets lists Azure Blob Storage containers (equivalent to S3 buckets).
func (c *azureClient) ListBuckets(ctx context.Context) ([]Bucket, error) {
	rawURL := fmt.Sprintf("https://%s.blob.core.windows.net/?comp=list", c.accountName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	c.sign(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("azure list containers returned status %d", resp.StatusCode)
	}

	var result struct {
		Containers []struct {
			Name       string `xml:"Name"`
			Properties struct {
				LastModified string `xml:"Last-Modified"`
			} `xml:"Properties"`
		} `xml:"Containers>Container"`
	}
	if err := xml.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("parsing azure list containers response: %w", err)
	}

	buckets := make([]Bucket, 0, len(result.Containers))
	for _, cont := range result.Containers {
		t, _ := time.Parse(time.RFC1123, cont.Properties.LastModified)
		buckets = append(buckets, Bucket{Name: cont.Name, CreatedAt: t})
	}
	return buckets, nil
}

// CreateBucket creates an Azure Blob Storage container.
func (c *azureClient) CreateBucket(ctx context.Context, name, _ string) error {
	rawURL := fmt.Sprintf("https://%s.blob.core.windows.net/%s?restype=container", c.accountName, name)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, rawURL, nil)
	if err != nil {
		return err
	}
	c.sign(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("azure create container returned status %d", resp.StatusCode)
	}
	return nil
}

// DeleteBucket deletes an Azure Blob Storage container.
func (c *azureClient) DeleteBucket(ctx context.Context, name string) error {
	rawURL := fmt.Sprintf("https://%s.blob.core.windows.net/%s?restype=container", c.accountName, name)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, rawURL, nil)
	if err != nil {
		return err
	}
	c.sign(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); resp.Body.Close() }()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("azure delete container returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *azureClient) Ping(ctx context.Context) error {
	_, err := c.ListBuckets(ctx)
	return err
}

// sign adds the SharedKey authorization header to an Azure Blob Storage request.
// Implements the Shared Key Lite signing scheme documented at:
// https://docs.microsoft.com/en-us/rest/api/storageservices/authorize-with-shared-key
func (c *azureClient) sign(req *http.Request) {
	date := time.Now().UTC().Format(http.TimeFormat)
	req.Header.Set("x-ms-date", date)
	req.Header.Set("x-ms-version", "2020-10-02")

	// Canonicalized headers: all x-ms-* headers, sorted lexicographically.
	var msHeaders []string
	for k, vs := range req.Header {
		lk := strings.ToLower(k)
		if strings.HasPrefix(lk, "x-ms-") {
			msHeaders = append(msHeaders, lk+":"+strings.Join(vs, ","))
		}
	}
	sort.Strings(msHeaders)
	canonHeaders := strings.Join(msHeaders, "\n") + "\n"

	// Canonicalized resource: /{account}{path}\n{sorted query params}
	canonResource := "/" + c.accountName + req.URL.Path
	q := req.URL.Query()
	if len(q) > 0 {
		keys := make([]string, 0, len(q))
		for k := range q {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			canonResource += "\n" + strings.ToLower(k) + ":" + strings.Join(q[k], ",")
		}
	}

	stringToSign := req.Method + "\n" + // Verb
		"\n" + // Content-Encoding
		"\n" + // Content-Language
		"\n" + // Content-Length
		"\n" + // Content-MD5
		"\n" + // Content-Type
		"\n" + // Date (empty; x-ms-date used instead)
		"\n" + // If-Modified-Since
		"\n" + // If-Match
		"\n" + // If-None-Match
		"\n" + // If-Unmodified-Since
		"\n" + // Range
		canonHeaders +
		canonResource

	mac := hmac.New(sha256.New, c.accountKey)
	mac.Write([]byte(stringToSign))
	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	req.Header.Set("Authorization", "SharedKey "+c.accountName+":"+sig)
}
