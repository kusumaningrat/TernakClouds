package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	repoprovider "github.com/kusumaningrat/ternakclouds/internal/providers/repository"
)

const apiBase = "https://api.github.com"

// Provider implements repoprovider.Provider for GitHub.
type Provider struct {
	token string
	http  *http.Client
}

// New creates a GitHub provider. credentials must contain "token" (PAT with repo scope).
func New(credentials map[string]string) (*Provider, error) {
	token := credentials["token"]
	if token == "" {
		return nil, fmt.Errorf("github: token is required")
	}
	return &Provider{
		token: token,
		http:  &http.Client{Timeout: 20 * time.Second},
	}, nil
}

func (p *Provider) Name() string { return "github" }

func (p *Provider) Capabilities() repoprovider.ProviderCapabilities {
	return repoprovider.ProviderCapabilities{PullRequests: true}
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
	req, err := http.NewRequestWithContext(ctx, method, apiBase+path, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
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
		return fmt.Errorf("github: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return nil
}

// ── Provider methods ──────────────────────────────────────────────────────────

func (p *Provider) ValidateConnection(ctx context.Context) error {
	resp, err := p.do(ctx, http.MethodGet, "/user", nil)
	if err != nil {
		return fmt.Errorf("github: connection failed: %w", err)
	}
	b, _ := readBody(resp)
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("github: invalid token")
	}
	return checkStatus(resp, b)
}

func (p *Provider) ListRepositories(ctx context.Context) ([]repoprovider.SCMRepo, error) {
	// Fine-grained PATs reject the visibility parameter; omit it and rely on the default (all).
	resp, err := p.do(ctx, http.MethodGet, "/user/repos?per_page=100", nil)
	if err != nil {
		return nil, fmt.Errorf("github: list repos: %w", err)
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return nil, err
	}

	var raw []struct {
		FullName      string `json:"full_name"`
		Name          string `json:"name"`
		Private       bool   `json:"private"`
		DefaultBranch string `json:"default_branch"`
		CloneURL      string `json:"clone_url"`
		Owner         struct {
			Login string `json:"login"`
		} `json:"owner"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, fmt.Errorf("github: decode repos: %w", err)
	}

	repos := make([]repoprovider.SCMRepo, len(raw))
	for i, r := range raw {
		vis := "public"
		if r.Private {
			vis = "private"
		}
		repos[i] = repoprovider.SCMRepo{
			Provider:      "github",
			Organization:  r.Owner.Login,
			Name:          r.Name,
			FullName:      r.FullName,
			DefaultBranch: r.DefaultBranch,
			Visibility:    vis,
			CloneURL:      r.CloneURL,
		}
	}
	return repos, nil
}

func (p *Provider) ListBranches(ctx context.Context, fullName string) ([]repoprovider.Branch, error) {
	path := fmt.Sprintf("/repos/%s/branches?per_page=100", fullName)
	resp, err := p.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("github: list branches: %w", err)
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return nil, err
	}

	var raw []struct {
		Name      string `json:"name"`
		Protected bool   `json:"protected"`
		Commit    struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, fmt.Errorf("github: decode branches: %w", err)
	}

	branches := make([]repoprovider.Branch, len(raw))
	for i, br := range raw {
		branches[i] = repoprovider.Branch{
			Name:      br.Name,
			Protected: br.Protected,
			SHA:       br.Commit.SHA,
		}
	}
	return branches, nil
}

func (p *Provider) CommitFiles(ctx context.Context, req repoprovider.CommitRequest) (*repoprovider.CommitResult, error) {
	// 1. Get or create the target branch.
	branchSHA, err := p.getBranchSHA(ctx, req.Repository, req.Branch)
	if err != nil {
		if !req.CreateBranch {
			return nil, fmt.Errorf("github: branch %q not found: %w", req.Branch, err)
		}
		branchSHA, err = p.createBranchFromDefault(ctx, req.Repository, req.Branch)
		if err != nil {
			return nil, fmt.Errorf("github: create branch: %w", err)
		}
	}

	// 2. Get the tree SHA of the current branch tip.
	treeSHA, err := p.getCommitTreeSHA(ctx, req.Repository, branchSHA)
	if err != nil {
		return nil, fmt.Errorf("github: get tree: %w", err)
	}

	// 3. Create blobs for each file.
	var treeEntries []treeEntry
	for _, f := range req.Files {
		blobSHA, err := p.createBlob(ctx, req.Repository, f.Content)
		if err != nil {
			return nil, fmt.Errorf("github: create blob for %s: %w", f.Path, err)
		}
		treeEntries = append(treeEntries, treeEntry{
			Path: f.Path,
			Mode: "100644",
			Type: "blob",
			SHA:  blobSHA,
		})
	}

	// 4. Create a new tree.
	newTreeSHA, err := p.createTree(ctx, req.Repository, treeSHA, treeEntries)
	if err != nil {
		return nil, fmt.Errorf("github: create tree: %w", err)
	}

	// 5. Create the commit.
	commitSHA, commitURL, err := p.createCommit(ctx, req.Repository, req.Message, newTreeSHA, branchSHA)
	if err != nil {
		return nil, fmt.Errorf("github: create commit: %w", err)
	}

	// 6. Update branch reference.
	if err := p.updateBranchRef(ctx, req.Repository, req.Branch, commitSHA); err != nil {
		return nil, fmt.Errorf("github: update ref: %w", err)
	}

	return &repoprovider.CommitResult{
		SHA:    commitSHA,
		Branch: req.Branch,
		URL:    commitURL,
	}, nil
}

func (p *Provider) CreatePullRequest(ctx context.Context, req repoprovider.PullRequestRequest) (*repoprovider.PullRequestResult, error) {
	path := fmt.Sprintf("/repos/%s/pulls", req.Repository)
	body := map[string]any{
		"title": req.Title,
		"body":  req.Body,
		"head":  req.Head,
		"base":  req.Base,
	}
	resp, err := p.do(ctx, http.MethodPost, path, body)
	if err != nil {
		return nil, fmt.Errorf("github: create PR: %w", err)
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return nil, err
	}

	var result struct {
		Number  int    `json:"number"`
		HTMLURL string `json:"html_url"`
		State   string `json:"state"`
	}
	if err := json.Unmarshal(b, &result); err != nil {
		return nil, fmt.Errorf("github: decode PR: %w", err)
	}

	if len(req.Reviewers) > 0 {
		revPath := fmt.Sprintf("/repos/%s/pulls/%d/requested_reviewers", req.Repository, result.Number)
		_, _ = p.do(ctx, http.MethodPost, revPath, map[string]any{"reviewers": req.Reviewers})
	}

	return &repoprovider.PullRequestResult{
		Number: result.Number,
		URL:    result.HTMLURL,
		State:  result.State,
	}, nil
}

// ── Git Data API helpers ──────────────────────────────────────────────────────

func (p *Provider) getBranchSHA(ctx context.Context, repo, branch string) (string, error) {
	path := fmt.Sprintf("/repos/%s/git/refs/heads/%s", repo, branch)
	resp, err := p.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return "", err
	}
	b, _ := readBody(resp)
	if resp.StatusCode == http.StatusNotFound {
		return "", fmt.Errorf("not found")
	}
	if err := checkStatus(resp, b); err != nil {
		return "", err
	}
	var ref struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	if err := json.Unmarshal(b, &ref); err != nil {
		return "", err
	}
	return ref.Object.SHA, nil
}

func (p *Provider) getCommitTreeSHA(ctx context.Context, repo, commitSHA string) (string, error) {
	path := fmt.Sprintf("/repos/%s/git/commits/%s", repo, commitSHA)
	resp, err := p.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return "", err
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return "", err
	}
	var commit struct {
		Tree struct {
			SHA string `json:"sha"`
		} `json:"tree"`
	}
	if err := json.Unmarshal(b, &commit); err != nil {
		return "", err
	}
	return commit.Tree.SHA, nil
}

func (p *Provider) createBlob(ctx context.Context, repo, content string) (string, error) {
	path := fmt.Sprintf("/repos/%s/git/blobs", repo)
	resp, err := p.do(ctx, http.MethodPost, path, map[string]string{
		"content":  content,
		"encoding": "utf-8",
	})
	if err != nil {
		return "", err
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return "", err
	}
	var blob struct {
		SHA string `json:"sha"`
	}
	if err := json.Unmarshal(b, &blob); err != nil {
		return "", err
	}
	return blob.SHA, nil
}

type treeEntry struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
}

func (p *Provider) createTree(ctx context.Context, repo, baseTreeSHA string, entries []treeEntry) (string, error) {
	path := fmt.Sprintf("/repos/%s/git/trees", repo)
	resp, err := p.do(ctx, http.MethodPost, path, map[string]any{
		"base_tree": baseTreeSHA,
		"tree":      entries,
	})
	if err != nil {
		return "", err
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return "", err
	}
	var tree struct {
		SHA string `json:"sha"`
	}
	if err := json.Unmarshal(b, &tree); err != nil {
		return "", err
	}
	return tree.SHA, nil
}

func (p *Provider) createCommit(ctx context.Context, repo, message, treeSHA, parentSHA string) (string, string, error) {
	path := fmt.Sprintf("/repos/%s/git/commits", repo)
	resp, err := p.do(ctx, http.MethodPost, path, map[string]any{
		"message": message,
		"tree":    treeSHA,
		"parents": []string{parentSHA},
	})
	if err != nil {
		return "", "", err
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return "", "", err
	}
	var commit struct {
		SHA     string `json:"sha"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal(b, &commit); err != nil {
		return "", "", err
	}
	return commit.SHA, commit.HTMLURL, nil
}

func (p *Provider) updateBranchRef(ctx context.Context, repo, branch, sha string) error {
	path := fmt.Sprintf("/repos/%s/git/refs/heads/%s", repo, branch)
	resp, err := p.do(ctx, http.MethodPatch, path, map[string]any{
		"sha":   sha,
		"force": false,
	})
	if err != nil {
		return err
	}
	b, _ := readBody(resp)
	return checkStatus(resp, b)
}

func (p *Provider) createBranchFromDefault(ctx context.Context, repo, branch string) (string, error) {
	resp, err := p.do(ctx, http.MethodGet, fmt.Sprintf("/repos/%s", repo), nil)
	if err != nil {
		return "", err
	}
	b, _ := readBody(resp)
	if err := checkStatus(resp, b); err != nil {
		return "", err
	}
	var repoInfo struct {
		DefaultBranch string `json:"default_branch"`
	}
	if err := json.Unmarshal(b, &repoInfo); err != nil {
		return "", err
	}

	defaultSHA, err := p.getBranchSHA(ctx, repo, repoInfo.DefaultBranch)
	if err != nil {
		return "", fmt.Errorf("get default branch SHA: %w", err)
	}

	createPath := fmt.Sprintf("/repos/%s/git/refs", repo)
	resp2, err := p.do(ctx, http.MethodPost, createPath, map[string]string{
		"ref": "refs/heads/" + branch,
		"sha": defaultSHA,
	})
	if err != nil {
		return "", err
	}
	b2, _ := readBody(resp2)
	if err := checkStatus(resp2, b2); err != nil {
		return "", err
	}
	return defaultSHA, nil
}
