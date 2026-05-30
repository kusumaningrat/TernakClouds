package repoprovider

import "context"

// SCMRepo is a normalized source-code repository returned by any provider.
type SCMRepo struct {
	Provider      string `json:"provider"`
	Organization  string `json:"organization"`
	Name          string `json:"name"`
	FullName      string `json:"full_name"` // "org/name"
	DefaultBranch string `json:"default_branch,omitempty"`
	Visibility    string `json:"visibility,omitempty"` // "public" | "private"
	CloneURL      string `json:"clone_url,omitempty"`
}

// Branch is a normalized SCM branch.
type Branch struct {
	Name      string `json:"name"`
	Protected bool   `json:"protected"`
	SHA       string `json:"sha,omitempty"`
}

// FileEntry is a single file to be committed.
type FileEntry struct {
	Path    string `json:"path"`    // repo-relative path, e.g. ".github/workflows/deploy.yml"
	Content string `json:"content"` // plain text content
}

// CommitRequest describes a multi-file commit operation.
type CommitRequest struct {
	Repository   string      `json:"repository"`    // "org/repo"
	Branch       string      `json:"branch"`        // target branch
	Message      string      `json:"message"`       // commit message
	Files        []FileEntry `json:"files"`
	CreateBranch bool        `json:"create_branch"` // create branch from default if absent
}

// CommitResult carries the outcome of a commit operation.
type CommitResult struct {
	SHA    string `json:"sha"`
	Branch string `json:"branch"`
	URL    string `json:"url,omitempty"`
}

// PullRequestRequest describes a PR/MR creation.
type PullRequestRequest struct {
	Repository string   `json:"repository"`
	Title      string   `json:"title"`
	Body       string   `json:"body"`
	Head       string   `json:"head"` // source branch
	Base       string   `json:"base"` // target branch
	Reviewers  []string `json:"reviewers,omitempty"`
}

// PullRequestResult carries the outcome of a PR/MR creation.
type PullRequestResult struct {
	Number int    `json:"number"`
	URL    string `json:"url"`
	State  string `json:"state"`
}

// ContentEntry is a file or directory inside a repository tree.
type ContentEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"` // "dir" | "file"
}

// ProviderCapabilities declares what a provider supports.
type ProviderCapabilities struct {
	PullRequests     bool `json:"pull_requests"`
	MergeRequests    bool `json:"merge_requests"`
	BranchProtection bool `json:"branch_protection"`
}

// Provider abstracts an SCM backend (GitHub, GitLab, …).
type Provider interface {
	Name() string
	ValidateConnection(ctx context.Context) error
	ListRepositories(ctx context.Context) ([]SCMRepo, error)
	ListBranches(ctx context.Context, fullName string) ([]Branch, error)
	// ListContents returns the entries at path inside fullName at the given branch.
	// Pass path="" and branch="" for the repo root at the default branch.
	ListContents(ctx context.Context, fullName, path, branch string) ([]ContentEntry, error)
	CommitFiles(ctx context.Context, req CommitRequest) (*CommitResult, error)
	CreatePullRequest(ctx context.Context, req PullRequestRequest) (*PullRequestResult, error)
	Capabilities() ProviderCapabilities
}
