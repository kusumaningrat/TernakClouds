package vault

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// TreeEntry is a single resolved secret path and its key-value data.
// Path is relative to the grant's vault_path; empty means the grant path itself.
type TreeEntry struct {
	Path string
	Data map[string]string
}

// Client stores and retrieves tokens from Vault KV v2.
// All methods use the client_token obtained at construction time.
type Client interface {
	StoreToken(ctx context.Context, path, token string) error
	RetrieveToken(ctx context.Context, path string) (string, error)
	DeleteToken(ctx context.Context, path string) error
	ReadKV(ctx context.Context, path string) (map[string]string, error)
	// WriteKV writes data as a new KV v2 version at path.
	WriteKV(ctx context.Context, path string, data map[string]string) error
	// ListKV returns the immediate children of path (directory keys end with /).
	ListKV(ctx context.Context, path string) ([]string, error)
	// ReadKVTree resolves all secrets at and under path, recursively.
	ReadKVTree(ctx context.Context, path string) ([]TreeEntry, error)
}

type httpClient struct {
	address     string
	kvMount     string
	clientToken string
	http        *http.Client
}

// NewFromToken creates a Client using an existing Vault token directly.
func NewFromToken(address, token, kvMount string) Client {
	return &httpClient{
		address:     strings.TrimRight(address, "/"),
		kvMount:     kvMount,
		clientToken: token,
		http:        &http.Client{Timeout: 10 * time.Second},
	}
}

// NewFromAppRole authenticates with Vault using AppRole and returns a ready Client.
func NewFromAppRole(address, roleID, secretID, kvMount string) (Client, error) {
	c := &httpClient{
		address: strings.TrimRight(address, "/"),
		kvMount: kvMount,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
	token, err := c.appRoleLogin(roleID, secretID)
	if err != nil {
		return nil, fmt.Errorf("approle login: %w", err)
	}
	c.clientToken = token
	return c, nil
}

func (c *httpClient) appRoleLogin(roleID, secretID string) (string, error) {
	body, _ := json.Marshal(map[string]string{
		"role_id":   roleID,
		"secret_id": secretID,
	})

	resp, err := c.http.Post(
		c.address+"/v1/auth/approle/login",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Auth struct {
			ClientToken string `json:"client_token"`
		} `json:"auth"`
		Errors []string `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Errors) > 0 {
		return "", fmt.Errorf("%s", strings.Join(result.Errors, "; "))
	}
	if result.Auth.ClientToken == "" {
		return "", fmt.Errorf("empty client_token in approle response")
	}
	return result.Auth.ClientToken, nil
}

// StoreToken writes {"data": {"token": token}} to KV v2 at path.
func (c *httpClient) StoreToken(ctx context.Context, path, token string) error {
	payload, _ := json.Marshal(map[string]any{
		"data": map[string]string{"token": token},
	})

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost,
		fmt.Sprintf("%s/v1/%s/data/%s", c.address, c.kvMount, path),
		bytes.NewReader(payload),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Vault-Token", c.clientToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vault write %s: %d: %s", path, resp.StatusCode, b)
	}
	return nil
}

// RetrieveToken reads the "token" key from KV v2 at path.
func (c *httpClient) RetrieveToken(ctx context.Context, path string) (string, error) {
	req, err := http.NewRequestWithContext(
		ctx, http.MethodGet,
		fmt.Sprintf("%s/v1/%s/data/%s", c.address, c.kvMount, path),
		nil,
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-Vault-Token", c.clientToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "", fmt.Errorf("vault: secret not found at %s", path)
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("vault read %s: %d: %s", path, resp.StatusCode, b)
	}

	var result struct {
		Data struct {
			Data map[string]string `json:"data"`
		} `json:"data"`
		Errors []string `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Errors) > 0 {
		return "", fmt.Errorf("vault: %s", strings.Join(result.Errors, "; "))
	}
	t, ok := result.Data.Data["token"]
	if !ok {
		return "", fmt.Errorf("vault: key 'token' not found at %s", path)
	}
	return t, nil
}

// ReadKV reads all key-value pairs from KV v2 at path.
func (c *httpClient) ReadKV(ctx context.Context, path string) (map[string]string, error) {
	req, err := http.NewRequestWithContext(
		ctx, http.MethodGet,
		fmt.Sprintf("%s/v1/%s/data/%s", c.address, c.kvMount, path),
		nil,
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Vault-Token", c.clientToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("vault: secret not found at %s", path)
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("vault read %s: %d: %s", path, resp.StatusCode, b)
	}

	var result struct {
		Data struct {
			Data map[string]string `json:"data"`
		} `json:"data"`
		Errors []string `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if len(result.Errors) > 0 {
		return nil, fmt.Errorf("vault: %s", strings.Join(result.Errors, "; "))
	}
	return result.Data.Data, nil
}

// WriteKV writes data as a new KV v2 version at path.
func (c *httpClient) WriteKV(ctx context.Context, path string, data map[string]string) error {
	payload, _ := json.Marshal(map[string]any{"data": data})

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost,
		fmt.Sprintf("%s/v1/%s/data/%s", c.address, c.kvMount, path),
		bytes.NewReader(payload),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Vault-Token", c.clientToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vault write %s: %d: %s", path, resp.StatusCode, b)
	}
	return nil
}

// ListKV returns the immediate children of path using Vault's metadata LIST endpoint.
// Keys ending in "/" are sub-directories. Returns nil, nil when the path has no children.
func (c *httpClient) ListKV(ctx context.Context, path string) ([]string, error) {
	req, err := http.NewRequestWithContext(
		ctx, "LIST",
		fmt.Sprintf("%s/v1/%s/metadata/%s", c.address, c.kvMount, strings.TrimRight(path, "/")),
		nil,
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Vault-Token", c.clientToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusMethodNotAllowed {
		return nil, nil
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("vault list %s: %d: %s", path, resp.StatusCode, b)
	}

	var result struct {
		Data struct {
			Keys []string `json:"keys"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Data.Keys, nil
}

// ReadKVTree resolves all secrets at and under path, up to 5 levels deep.
// It first tries a direct read, then lists children recursively.
func (c *httpClient) ReadKVTree(ctx context.Context, path string) ([]TreeEntry, error) {
	entries, err := c.readKVTreeDepth(ctx, path, "", 0)
	if err != nil {
		return nil, err
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("vault: no secrets found at %s", path)
	}
	return entries, nil
}

func (c *httpClient) readKVTreeDepth(ctx context.Context, fullPath, relBase string, depth int) ([]TreeEntry, error) {
	if depth > 5 {
		return nil, nil
	}

	var result []TreeEntry

	// Try a direct read at this exact path.
	data, directErr := c.ReadKV(ctx, fullPath)
	if directErr == nil && len(data) > 0 {
		result = append(result, TreeEntry{Path: relBase, Data: data})
	}

	// List children regardless of whether a direct secret exists here.
	keys, listErr := c.ListKV(ctx, fullPath)
	if listErr != nil {
		// If direct read succeeded, return that; otherwise surface the list error.
		if len(result) > 0 {
			return result, nil
		}
		if directErr != nil {
			return nil, directErr
		}
		return nil, listErr
	}

	for _, key := range keys {
		stripped := strings.TrimRight(key, "/")
		childFull := fullPath + "/" + stripped
		childRel := stripped
		if relBase != "" {
			childRel = relBase + "/" + stripped
		}

		if strings.HasSuffix(key, "/") {
			// Sub-directory — recurse.
			sub, err := c.readKVTreeDepth(ctx, childFull, childRel, depth+1)
			if err == nil {
				result = append(result, sub...)
			}
		} else {
			// Leaf secret.
			leafData, err := c.ReadKV(ctx, childFull)
			if err == nil {
				result = append(result, TreeEntry{Path: childRel, Data: leafData})
			}
		}
	}

	return result, nil
}

// DeleteToken removes all versions of the secret at path via the metadata endpoint.
func (c *httpClient) DeleteToken(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(
		ctx, http.MethodDelete,
		fmt.Sprintf("%s/v1/%s/metadata/%s", c.address, c.kvMount, path),
		nil,
	)
	if err != nil {
		return err
	}
	req.Header.Set("X-Vault-Token", c.clientToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vault delete %s: %d: %s", path, resp.StatusCode, b)
	}
	return nil
}
