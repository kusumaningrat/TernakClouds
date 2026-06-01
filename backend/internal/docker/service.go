package docker

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

var ErrNoDockerProvider = errors.New("No Docker provider is configured for this environment. Please bind a provider in the Capabilities settings.")

type Service struct {
	capRepo *capability.Repository
	vault   vault.Client
}

func NewService(capRepo *capability.Repository, vc vault.Client) *Service {
	return &Service{capRepo: capRepo, vault: vc}
}

// clientForEnv resolves a Docker client for the given environment.
//
// Resolution order:
//  1. Look up the "docker" ProviderConfig inside the "runtime" capability
//     binding for this environment; use its Endpoint and Vault-stored token.
//  2. Fall back to DOCKER_HOST / DOCKER_TOKEN environment variables.
func (s *Service) clientForEnv(ctx context.Context, envID uuid.UUID) (*Client, error) {
	binding, err := s.capRepo.FindBinding(envID, "runtime")
	if err != nil {
		return nil, err
	}
	if binding != nil {
		for _, pc := range binding.ProviderConfigs {
			if pc.ProviderName != "docker" || pc.Endpoint == "" {
				continue
			}
			token := ""
			if s.vault != nil && pc.VaultPath != "" {
				token, err = s.vault.RetrieveToken(ctx, pc.VaultPath)
				if err != nil {
					return nil, err
				}
			}
			return NewClient(pc.Endpoint, token), nil
		}
	}

	// Fallback: environment variables (DOCKER_HOST / DOCKER_TOKEN)
	host := os.Getenv("DOCKER_HOST")
	if host == "" {
		return nil, ErrNoDockerProvider
	}
	return NewClient(host, os.Getenv("DOCKER_TOKEN")), nil
}

func (s *Service) ListContainers(ctx context.Context, envID uuid.UUID) ([]ContainerStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListContainers(ctx)
}

func (s *Service) GetContainer(ctx context.Context, envID uuid.UUID, id string) (*ContainerDetail, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.GetContainer(ctx, id)
}

func (s *Service) StartContainer(ctx context.Context, envID uuid.UUID, id string) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	return client.StartContainer(ctx, id)
}

func (s *Service) StopContainer(ctx context.Context, envID uuid.UUID, id string) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	return client.StopContainer(ctx, id)
}

func (s *Service) RestartContainer(ctx context.Context, envID uuid.UUID, id string) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	return client.RestartContainer(ctx, id)
}

func (s *Service) RemoveContainer(ctx context.Context, envID uuid.UUID, id string) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	return client.RemoveContainer(ctx, id)
}

func (s *Service) StreamContainerLogs(ctx context.Context, envID uuid.UUID, id string, follow bool) (io.ReadCloser, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.StreamContainerLogs(ctx, id, follow)
}

func (s *Service) ListImages(ctx context.Context, envID uuid.UUID) ([]ImageStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListImages(ctx)
}

func (s *Service) ListNetworks(ctx context.Context, envID uuid.UUID) ([]NetworkStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListNetworks(ctx)
}

func (s *Service) ListVolumes(ctx context.Context, envID uuid.UUID) ([]VolumeStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListVolumes(ctx)
}

// RunContainer creates and immediately starts a container. Returns the short container ID.
func (s *Service) RunContainer(ctx context.Context, envID uuid.UUID, cfg ContainerRunConfig) (string, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return "", err
	}
	id, err := client.CreateContainer(ctx, cfg)
	if err != nil {
		return "", fmt.Errorf("create container: %w", err)
	}
	if err := client.StartContainer(ctx, id); err != nil {
		return "", fmt.Errorf("start container: %w", err)
	}
	if len(id) > 12 {
		id = id[:12]
	}
	return id, nil
}

// StopAndRemoveContainer stops then removes a container. Missing container is not an error.
func (s *Service) StopAndRemoveContainer(ctx context.Context, envID uuid.UUID, id string) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	_ = client.StopContainer(ctx, id)
	return client.RemoveContainer(ctx, id)
}
