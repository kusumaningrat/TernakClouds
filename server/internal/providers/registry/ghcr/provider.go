package ghcr

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	registryprovider "github.com/kusumaningrat/idp-backend/internal/providers/registry"
)

const apiBase = "https://api.github.com"

type Provider struct {
	username string
	token    string
	http     *http.Client
}

// New creates a GitHub Container Registry provider.
// credentials must contain "username" and "token" (GitHub PAT with packages:read scope).
func New(credentials map[string]string) (*Provider, error) {
	token := credentials["token"]
	if token == "" {
		return nil, fmt.Errorf("ghcr: token is required")
	}
	return &Provider{
		username: credentials["username"],
		token:    token,
		http:     &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (p *Provider) request(ctx context.Context, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiBase+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	return p.http.Do(req)
}

func (p *Provider) ValidateConnection(ctx context.Context) error {
	resp, err := p.request(ctx, "/user")
	if err != nil {
		return fmt.Errorf("ghcr: connection failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("ghcr: invalid token")
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ghcr: unexpected status %d: %s", resp.StatusCode, b)
	}
	return nil
}

func (p *Provider) ListRepositories(ctx context.Context) ([]registryprovider.Repo, error) {
	resp, err := p.request(ctx, "/user/packages?package_type=container&per_page=100")
	if err != nil {
		return nil, fmt.Errorf("ghcr: list packages: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ghcr: list packages %d: %s", resp.StatusCode, b)
	}

	var packages []struct {
		Name  string `json:"name"`
		Owner struct {
			Login string `json:"login"`
		} `json:"owner"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&packages); err != nil {
		return nil, fmt.Errorf("ghcr: decode packages: %w", err)
	}

	repos := make([]registryprovider.Repo, len(packages))
	for i, pkg := range packages {
		repos[i] = registryprovider.Repo{
			Name: pkg.Owner.Login + "/" + pkg.Name,
			URI:  "ghcr.io/" + pkg.Owner.Login + "/" + pkg.Name,
		}
	}
	return repos, nil
}

func (p *Provider) ListTags(ctx context.Context, repository string) ([]registryprovider.Tag, error) {
	// repository format: "owner/package-name"
	parts := strings.SplitN(repository, "/", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("ghcr: invalid repository format %q", repository)
	}
	path := fmt.Sprintf("/users/%s/packages/container/%s/versions?per_page=100", parts[0], parts[1])
	resp, err := p.request(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("ghcr: list versions: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ghcr: list versions %d: %s", resp.StatusCode, b)
	}

	var versions []struct {
		Name     string   `json:"name"`
		Metadata struct {
			Container struct {
				Tags []string `json:"tags"`
			} `json:"container"`
		} `json:"metadata"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&versions); err != nil {
		return nil, fmt.Errorf("ghcr: decode versions: %w", err)
	}

	var tags []registryprovider.Tag
	for _, v := range versions {
		for _, t := range v.Metadata.Container.Tags {
			tags = append(tags, registryprovider.Tag{Name: t, Digest: v.Name})
		}
	}
	return tags, nil
}

func (p *Provider) GetManifest(ctx context.Context, image string) (*registryprovider.Manifest, error) {
	return nil, fmt.Errorf("ghcr: GetManifest not yet implemented")
}

func (p *Provider) ValidateImage(ctx context.Context, image string) error {
	return fmt.Errorf("ghcr: ValidateImage not yet implemented")
}
