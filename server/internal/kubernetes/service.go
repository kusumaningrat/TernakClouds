package kubernetes

import (
	"context"
	"errors"
	"io"
	"os"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

var ErrNoK8sProvider = errors.New("No Kubernetes provider is configured for this environment. Please bind a provider in the Capabilities settings.")

type Service struct {
	capRepo *capability.Repository
	vault   vault.Client
}

func NewService(capRepo *capability.Repository, vc vault.Client) *Service {
	return &Service{capRepo: capRepo, vault: vc}
}

// clientForEnv resolves a Kubernetes client for the given environment.
//
// Resolution order:
//  1. Look up the "kubernetes" ProviderConfig inside the "runtime" capability
//     binding for this environment; use its Endpoint and Vault-stored token.
//  2. Fall back to KUBE_HOST / KUBE_TOKEN environment variables.
func (s *Service) clientForEnv(ctx context.Context, envID uuid.UUID) (*Client, error) {
	binding, err := s.capRepo.FindBinding(envID, "runtime")
	if err != nil {
		return nil, err
	}
	if binding != nil {
		for _, pc := range binding.ProviderConfigs {
			if pc.ProviderName != "kubernetes" || pc.Endpoint == "" {
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

	// Fallback: environment variables (KUBE_HOST / KUBE_TOKEN)
	host := os.Getenv("KUBE_HOST")
	if host == "" {
		return nil, ErrNoK8sProvider
	}
	return NewClient(host, os.Getenv("KUBE_TOKEN")), nil
}

func (s *Service) ListNodes(ctx context.Context, envID uuid.UUID) ([]NodeStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListNodes(ctx)
}

func (s *Service) ListNamespaces(ctx context.Context, envID uuid.UUID) ([]NamespaceStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListNamespaces(ctx)
}

func (s *Service) ListPods(ctx context.Context, envID uuid.UUID, namespace string) ([]PodStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListPods(ctx, namespace, "")
}

func (s *Service) ListDeployments(ctx context.Context, envID uuid.UUID, namespace string) ([]DeploymentStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListDeployments(ctx, namespace)
}

func (s *Service) ListServices(ctx context.Context, envID uuid.UUID, namespace string) ([]ServiceStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListServices(ctx, namespace)
}

func (s *Service) StreamPodLogs(ctx context.Context, envID uuid.UUID, namespace, podName, container string, follow bool) (io.ReadCloser, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.StreamPodLogs(ctx, namespace, podName, container, follow)
}

func (s *Service) GetDeployment(ctx context.Context, envID uuid.UUID, namespace, name string) (*DeploymentDetail, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.GetDeployment(ctx, namespace, name)
}

func (s *Service) GetPod(ctx context.Context, envID uuid.UUID, namespace, name string) (*PodDetail, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.GetPod(ctx, namespace, name)
}

func (s *Service) GetService(ctx context.Context, envID uuid.UUID, namespace, name string) (*ServiceDetail, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.GetService(ctx, namespace, name)
}

func (s *Service) ScaleDeployment(ctx context.Context, envID uuid.UUID, namespace, name string, replicas int) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	return client.ScaleDeployment(ctx, namespace, name, replicas)
}

func (s *Service) ListPodsBySelector(ctx context.Context, envID uuid.UUID, namespace, labelSelector string) ([]PodStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListPods(ctx, namespace, labelSelector)
}
