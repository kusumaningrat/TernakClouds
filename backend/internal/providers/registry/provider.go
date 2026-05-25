package registryprovider

import "context"

type Repo struct {
	Name string `json:"name"`
	URI  string `json:"uri,omitempty"`
}

type Tag struct {
	Name   string `json:"name"`
	Digest string `json:"digest,omitempty"`
	Size   int64  `json:"size,omitempty"`
}

type Manifest struct {
	Digest    string   `json:"digest"`
	MediaType string   `json:"media_type,omitempty"`
	Size      int64    `json:"size,omitempty"`
	Tags      []string `json:"tags,omitempty"`
}

// Provider abstracts a container registry backend.
type Provider interface {
	ValidateConnection(ctx context.Context) error
	ListRepositories(ctx context.Context) ([]Repo, error)
	ListTags(ctx context.Context, repository string) ([]Tag, error)
	GetManifest(ctx context.Context, image string) (*Manifest, error)
	ValidateImage(ctx context.Context, image string) error
}
