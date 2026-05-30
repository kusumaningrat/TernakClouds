package gitlab

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	repoprovider "github.com/kusumaningrat/ternakclouds/internal/providers/repository"
)

// Provider implements repoprovider.Provider for GitLab.
type Provider struct {
	baseURL string // e.g. "https://gitlab.com"
	token   string
	http    *http.Client
}

// New creates a GitLab provider.
// credentials must contain "token" (PAT with api scope).
// endpoint defaults to "https://gitlab.com" if empty.
func New(endpoint string, credentials map[string]string) (*Provider, error) {
	token := credentials["token"]
	if token == "" {
		return nil, fmt.Errorf("gitlab: token is required")
	}
	base := strings.TrimRight(endpoint, "/")
	if base == "" {
		base = "https://gitlab.com"
	}
	return &Provider{
		baseURL: base,
		token:   token,
		http:    &http.Client{Timeout: 20 * time.Second},
	}, nil
}

func (p *Provider) Name() string { return "gitlab" }

func (p *Provider) Capabilities() repoprovider.ProviderCapabilities {
	return repoprovider.ProviderCapabilities{MergeRequests: true}
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

func (p *Provider) do(ctx context.Context, method, path string, body any) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.baseURL+path, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("PRIVATE-TOKEN", p.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return p.http.Do(req)
}

func readBody(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func checkStatus(resp *http.Response, b []byte) error {
	if resp.StatusCode >= 400 {
		return fmt.Errorf("gitlab: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

func encodedPath(fullName string) string {
	return url.PathEscape(fullName)
}

// ── Provider methods ──────────────────────────────────────────────────────────

func (p *Provider) ValidateConnection(ctx context.Context) error {
	resp, err := p.do(ctx, http.MethodGet, "/api/v4/user", nil)
	if err != nil {
		return fmt.Errorf("gitlab: connection failed: %w", err)
	}
	b, _ := readBody(resp)
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("gitlab: invalid token")
	}
	return checkStatus(resp, b)
}

func (p *Provider) ListRepositories(ctx context.Context) ([]repoprovider.SCMRepo, error) {
	resp, err := p.do(ctx, http.MethodGet, "/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at", nil)
	if err != nil {
		return nil, fmt.Errorf("gitlab: list projects: %w", err)
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return nil, err
	}

	var raw []struct {
		PathWithNamespace string `json:"path_with_namespace"`
		Path              string `json:"path"`
		Visibility        string `json:"visibility"`
		DefaultBranch     string `json:"default_branch"`
		HTTPURLToRepo     string `json:"http_url_to_repo"`
		Namespace         struct {
			Path string `json:"path"`
		} `json:"namespace"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, fmt.Errorf("gitlab: decode projects: %w", err)
	}

	repos := make([]repoprovider.SCMRepo, len(raw))
	for i, r := range raw {
		repos[i] = repoprovider.SCMRepo{
			Provider:      "gitlab",
			Organization:  r.Namespace.Path,
			Name:          r.Path,
			FullName:      r.PathWithNamespace,
			DefaultBranch: r.DefaultBranch,
			Visibility:    r.Visibility,
			CloneURL:      r.HTTPURLToRepo,
		}
	}
	return repos, nil
}

func (p *Provider) ListBranches(ctx context.Context, fullName string) ([]repoprovider.Branch, error) {
	path := fmt.Sprintf("/api/v4/projects/%s/repository/branches?per_page=100", encodedPath(fullName))
	resp, err := p.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("gitlab: list branches: %w", err)
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return nil, err
	}

	var raw []struct {
		Name      string `json:"name"`
		Protected bool   `json:"protected"`
		Commit    struct {
			ID string `json:"id"`
		} `json:"commit"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, fmt.Errorf("gitlab: decode branches: %w", err)
	}

	branches := make([]repoprovider.Branch, len(raw))
	for i, br := range raw {
		branches[i] = repoprovider.Branch{
			Name:      br.Name,
			Protected: br.Protected,
			SHA:       br.Commit.ID,
		}
	}
	return branches, nil
}

func (p *Provider) CommitFiles(ctx context.Context, req repoprovider.CommitRequest) (*repoprovider.CommitResult, error) {
	if req.CreateBranch {
		if err := p.ensureBranch(ctx, req.Repository, req.Branch); err != nil {
			return nil, fmt.Errorf("gitlab: ensure branch: %w", err)
		}
	}

	type commitAction struct {
		Action   string `json:"action"`
		FilePath string `json:"file_path"`
		Content  string `json:"content"`
	}
	var actions []commitAction
	for _, f := range req.Files {
		action := "create"
		if p.fileExists(ctx, req.Repository, f.Path, req.Branch) {
			action = "update"
		}
		actions = append(actions, commitAction{
			Action:   action,
			FilePath: f.Path,
			Content:  f.Content,
		})
	}

	path := fmt.Sprintf("/api/v4/projects/%s/repository/commits", encodedPath(req.Repository))
	body := map[string]any{
		"branch":         req.Branch,
		"commit_message": req.Message,
		"actions":        actions,
	}
	resp, err := p.do(ctx, http.MethodPost, path, body)
	if err != nil {
		return nil, fmt.Errorf("gitlab: commit files: %w", err)
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return nil, err
	}

	var result struct {
		ID     string `json:"id"`
		WebURL string `json:"web_url"`
	}
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, fmt.Errorf("gitlab: decode commit: %w", err)
	}

	return &repoprovider.CommitResult{
		SHA:    result.ID,
		Branch: req.Branch,
		URL:    result.WebURL,
	}, nil
}

func (p *Provider) CreatePullRequest(ctx context.Context, req repoprovider.PullRequestRequest) (*repoprovider.PullRequestResult, error) {
	path := fmt.Sprintf("/api/v4/projects/%s/merge_requests", encodedPath(req.Repository))
	body := map[string]any{
		"title":         req.Title,
		"description":   req.Body,
		"source_branch": req.Head,
		"target_branch": req.Base,
	}
	resp, err := p.do(ctx, http.MethodPost, path, body)
	if err != nil {
		return nil, fmt.Errorf("gitlab: create MR: %w", err)
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return nil, err
	}

	var result struct {
		IID    int    `json:"iid"`
		WebURL string `json:"web_url"`
		State  string `json:"state"`
	}
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, fmt.Errorf("gitlab: decode MR: %w", err)
	}

	return &repoprovider.PullRequestResult{
		Number: result.IID,
		URL:    result.WebURL,
		State:  result.State,
	}, nil
}

// ── Internal helpers ──────────────────────────────────────────────────────────

func (p *Provider) fileExists(ctx context.Context, fullName, filePath, branch string) bool {
	encodedFile := url.QueryEscape(filePath)
	path := fmt.Sprintf("/api/v4/projects/%s/repository/files/%s?ref=%s",
		encodedPath(fullName), encodedFile, url.QueryEscape(branch))
	resp, err := p.do(ctx, http.MethodHead, path, nil)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func (p *Provider) ensureBranch(ctx context.Context, fullName, branch string) error {
	checkPath := fmt.Sprintf("/api/v4/projects/%s/repository/branches/%s",
		encodedPath(fullName), url.PathEscape(branch))
	resp, err := p.do(ctx, http.MethodGet, checkPath, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return nil
	}

	projPath := fmt.Sprintf("/api/v4/projects/%s", encodedPath(fullName))
	resp2, err := p.do(ctx, http.MethodGet, projPath, nil)
	if err != nil {
		return err
	}
	b, _ := readBody(resp2)
	if err := checkStatus(resp2, b); err != nil {
		return err
	}
	var proj struct {
		DefaultBranch string `json:"default_branch"`
	}
	if err := json.Unmarshal(b, &proj); err != nil {
		return err
	}

	createPath := fmt.Sprintf("/api/v4/projects/%s/repository/branches", encodedPath(fullName))
	resp3, err := p.do(ctx, http.MethodPost, createPath, map[string]string{
		"branch": branch,
		"ref":    proj.DefaultBranch,
	})
	if err != nil {
		return err
	}
	b3, _ := readBody(resp3)
	return checkStatus(resp3, b3)
}
