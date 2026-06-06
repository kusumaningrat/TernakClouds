package harbor

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

type Provider struct {
	endpoint string
	username string
	password string
	http     *http.Client
}

// New creates a Harbor registry provider.
// credentials must contain "username" and "password" keys.
func New(endpoint string, credentials map[string]string) (*Provider, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("harbor: endpoint is required")
	}
	return &Provider{
		endpoint: strings.TrimRight(endpoint, "/"),
		username: credentials["username"],
		password: credentials["password"],
		http:     &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (p *Provider) request(ctx context.Context, method, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, p.endpoint+path, nil)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(p.username, p.password)
	req.Header.Set("Accept", "application/json")
	return p.http.Do(req)
}

func (p *Provider) ValidateConnection(ctx context.Context) error {
	resp, err := p.request(ctx, http.MethodGet, "/api/v2.0/systeminfo")
	if err != nil {
		return fmt.Errorf("harbor: connection failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("harbor: invalid credentials")
	}
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("harbor: unexpected status %d: %s", resp.StatusCode, body)
	}
	return nil
}

func (p *Provider) ListRepositories(ctx context.Context) ([]registryprovider.Repo, error) {
	resp, err := p.request(ctx, http.MethodGet, "/api/v2.0/repositories?page=1&page_size=100")
	if err != nil {
		return nil, fmt.Errorf("harbor: list repositories: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("harbor: list repositories %d: %s", resp.StatusCode, body)
	}

	var raw []struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("harbor: decode repositories: %w", err)
	}

	repos := make([]registryprovider.Repo, len(raw))
	for i, r := range raw {
		repos[i] = registryprovider.Repo{
			Name: r.Name,
			URI:  p.endpoint + "/" + r.Name,
		}
	}
	return repos, nil
}

// ListTags lists tags for a repository. repository format: "project/repo-name".
func (p *Provider) ListTags(ctx context.Context, repository string) ([]registryprovider.Tag, error) {
	project, repo, err := splitRepo(repository)
	if err != nil {
		return nil, err
	}

	path := fmt.Sprintf("/api/v2.0/projects/%s/repositories/%s/artifacts?with_tag=true&page_size=100",
		project, repo)
	resp, err := p.request(ctx, http.MethodGet, path)
	if err != nil {
		return nil, fmt.Errorf("harbor: list tags: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("harbor: list tags %d: %s", resp.StatusCode, body)
	}

	var artifacts []struct {
		Digest string `json:"digest"`
		Size   int64  `json:"size"`
		Tags   []struct {
			Name string `json:"name"`
		} `json:"tags"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&artifacts); err != nil {
		return nil, fmt.Errorf("harbor: decode artifacts: %w", err)
	}

	var tags []registryprovider.Tag
	for _, a := range artifacts {
		for _, t := range a.Tags {
			tags = append(tags, registryprovider.Tag{
				Name:   t.Name,
				Digest: a.Digest,
				Size:   a.Size,
			})
		}
	}
	return tags, nil
}

// GetManifest retrieves artifact metadata. image format: "project/repo:tag" or "project/repo@sha256:...".
func (p *Provider) GetManifest(ctx context.Context, image string) (*registryprovider.Manifest, error) {
	project, repoRef, err := splitRepo(image)
	if err != nil {
		return nil, err
	}
	// repoRef may be "repo:tag" or "repo@sha256:digest"
	repo, reference := splitReference(repoRef)

	path := fmt.Sprintf("/api/v2.0/projects/%s/repositories/%s/artifacts/%s", project, repo, reference)
	resp, err := p.request(ctx, http.MethodGet, path)
	if err != nil {
		return nil, fmt.Errorf("harbor: get manifest: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("harbor: image not found: %s", image)
	}
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("harbor: get manifest %d: %s", resp.StatusCode, body)
	}

	var artifact struct {
		Digest    string `json:"digest"`
		MediaType string `json:"media_type"`
		Size      int64  `json:"size"`
		Tags      []struct {
			Name string `json:"name"`
		} `json:"tags"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&artifact); err != nil {
		return nil, fmt.Errorf("harbor: decode manifest: %w", err)
	}

	tagNames := make([]string, len(artifact.Tags))
	for i, t := range artifact.Tags {
		tagNames[i] = t.Name
	}
	return &registryprovider.Manifest{
		Digest:    artifact.Digest,
		MediaType: artifact.MediaType,
		Size:      artifact.Size,
		Tags:      tagNames,
	}, nil
}

func (p *Provider) ValidateImage(ctx context.Context, image string) error {
	_, err := p.GetManifest(ctx, image)
	return err
}

// splitRepo splits "project/repo" → ("project", "repo", nil).
func splitRepo(repository string) (project, repo string, err error) {
	idx := strings.Index(repository, "/")
	if idx < 0 {
		return "", "", fmt.Errorf("harbor: invalid repository format %q (expected project/repo)", repository)
	}
	return repository[:idx], repository[idx+1:], nil
}

// splitReference splits "repo:tag" → ("repo", "tag") or "repo" → ("repo", "latest").
func splitReference(repoRef string) (repo, reference string) {
	if idx := strings.Index(repoRef, "@"); idx >= 0 {
		return repoRef[:idx], repoRef[idx+1:]
	}
	if idx := strings.LastIndex(repoRef, ":"); idx >= 0 {
		return repoRef[:idx], repoRef[idx+1:]
	}
	return repoRef, "latest"
}
