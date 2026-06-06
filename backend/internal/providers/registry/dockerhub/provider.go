package dockerhub

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	registryprovider "github.com/kusumaningrat/ternakclouds/internal/providers/registry"
)

const baseURL = "https://hub.docker.com/v2"

type Provider struct {
	namespace string
	token     string
	http      *http.Client
}

// New creates a Docker Hub registry provider.
// credentials must contain "username" and "password" (or "token") keys.
func New(credentials map[string]string) (*Provider, error) {
	username := credentials["username"]
	if username == "" {
		return nil, fmt.Errorf("dockerhub: username is required")
	}
	p := &Provider{
		namespace: username,
		http:      &http.Client{Timeout: 15 * time.Second},
	}
	// Authenticate and store the JWT token.
	token, err := p.login(credentials["username"], credentials["password"])
	if err != nil {
		return nil, fmt.Errorf("dockerhub: authentication failed: %w", err)
	}
	p.token = token
	return p, nil
}

func (p *Provider) login(username, password string) (string, error) {
	body := fmt.Sprintf(`{"username":%q,"password":%q}`, username, password)
	req, err := http.NewRequest(http.MethodPost, baseURL+"/users/login", strings.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return "", fmt.Errorf("invalid credentials")
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, b)
	}

	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.Token, nil
}

func (p *Provider) request(ctx context.Context, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	return p.http.Do(req)
}

func (p *Provider) ValidateConnection(ctx context.Context) error {
	resp, err := p.request(ctx, "/repositories/"+p.namespace+"/?page_size=1")
	if err != nil {
		return fmt.Errorf("dockerhub: connection failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("dockerhub: unexpected status %d: %s", resp.StatusCode, b)
	}
	return nil
}

func (p *Provider) ListRepositories(ctx context.Context) ([]registryprovider.Repo, error) {
	resp, err := p.request(ctx, "/repositories/"+p.namespace+"/?page_size=100")
	if err != nil {
		return nil, fmt.Errorf("dockerhub: list repositories: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dockerhub: list repositories %d: %s", resp.StatusCode, b)
	}

	var result struct {
		Results []struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dockerhub: decode repositories: %w", err)
	}

	repos := make([]registryprovider.Repo, len(result.Results))
	for i, r := range result.Results {
		repos[i] = registryprovider.Repo{
			Name: r.Namespace + "/" + r.Name,
			URI:  "docker.io/" + r.Namespace + "/" + r.Name,
		}
	}
	return repos, nil
}

func (p *Provider) ListTags(ctx context.Context, repository string) ([]registryprovider.Tag, error) {
	// repository format: "namespace/repo"
	parts := strings.SplitN(repository, "/", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("dockerhub: invalid repository format %q", repository)
	}
	resp, err := p.request(ctx, fmt.Sprintf("/repositories/%s/%s/tags?page_size=100", parts[0], parts[1]))
	if err != nil {
		return nil, fmt.Errorf("dockerhub: list tags: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dockerhub: list tags %d: %s", resp.StatusCode, b)
	}

	var result struct {
		Results []struct {
			Name   string `json:"name"`
			Digest string `json:"digest"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dockerhub: decode tags: %w", err)
	}

	tags := make([]registryprovider.Tag, len(result.Results))
	for i, t := range result.Results {
		tags[i] = registryprovider.Tag{Name: t.Name, Digest: t.Digest}
	}
	return tags, nil
}

func (p *Provider) GetManifest(ctx context.Context, image string) (*registryprovider.Manifest, error) {
	// image format: "namespace/repo:tag"
	repo, tag := splitImageRef(image)
	parts := strings.SplitN(repo, "/", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("dockerhub: invalid image format %q", image)
	}
	resp, err := p.request(ctx, fmt.Sprintf("/repositories/%s/%s/tags/%s", parts[0], parts[1], tag))
	if err != nil {
		return nil, fmt.Errorf("dockerhub: get manifest: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("dockerhub: image not found: %s", image)
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dockerhub: get manifest %d: %s", resp.StatusCode, b)
	}

	var result struct {
		Name   string `json:"name"`
		Digest string `json:"digest"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dockerhub: decode manifest: %w", err)
	}
	return &registryprovider.Manifest{
		Digest: result.Digest,
		Tags:   []string{result.Name},
	}, nil
}

func (p *Provider) ValidateImage(ctx context.Context, image string) error {
	_, err := p.GetManifest(ctx, image)
	return err
}

func splitImageRef(image string) (repo, tag string) {
	if idx := strings.LastIndex(image, ":"); idx >= 0 {
		return image[:idx], image[idx+1:]
	}
	return image, "latest"
}
