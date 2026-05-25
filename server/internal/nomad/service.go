package nomad

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/capability"
	"github.com/kusumaningrat/idp-backend/internal/vault"
)

var ErrNoNomadProvider = errors.New("no nomad provider configured for this environment; set NOMAD_ADDR or bind a nomad provider via capabilities")

type Service struct {
	capRepo *capability.Repository
	vault   vault.Client
}

func NewService(capRepo *capability.Repository, vc vault.Client) *Service {
	return &Service{capRepo: capRepo, vault: vc}
}

// clientForEnv resolves a Nomad client for the given environment.
//
// Resolution order:
//  1. Look up the "nomad" ProviderConfig inside the "runtime" capability
//     binding for this environment; use its Endpoint and Vault-stored token.
//  2. Fall back to NOMAD_ADDR / NOMAD_TOKEN environment variables.
func (s *Service) clientForEnv(ctx context.Context, envID uuid.UUID) (*Client, error) {
	binding, err := s.capRepo.FindBinding(envID, "runtime")
	if err != nil {
		return nil, err
	}
	if binding != nil {
		for _, pc := range binding.ProviderConfigs {
			if pc.ProviderName != "nomad" || pc.Endpoint == "" {
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

	// Fallback: environment variables (NOMAD_ADDR / NOMAD_TOKEN)
	addr := os.Getenv("NOMAD_ADDR")
	if addr == "" {
		return nil, ErrNoNomadProvider
	}
	return NewClient(addr, os.Getenv("NOMAD_TOKEN")), nil
}

// ListNodes returns all nodes in the cluster — useful for worker/node discovery.
func (s *Service) ListNodes(ctx context.Context, envID uuid.UUID) ([]NodeStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListNodes(ctx)
}

// ListNamespaces returns all namespaces visible to the configured token.
func (s *Service) ListNamespaces(ctx context.Context, envID uuid.UUID) ([]Namespace, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListNamespaces(ctx)
}

// ListJobs returns all jobs in the given namespace.
func (s *Service) ListJobs(ctx context.Context, envID uuid.UUID, namespace string) ([]JobListStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListJobs(ctx, namespace)
}

// ListAllocations returns all allocations for a job.
func (s *Service) ListAllocations(ctx context.Context, envID uuid.UUID, jobID, namespace string) ([]AllocationStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListAllocations(ctx, jobID, namespace)
}

// LogStream opens a Nomad log stream for an allocation task.
// The caller must close the returned ReadCloser.
func (s *Service) LogStream(ctx context.Context, envID uuid.UUID, allocID, task, logType string, follow bool, origin string) (io.ReadCloser, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.LogStream(ctx, allocID, task, logType, follow, origin)
}

// GetJob returns the full specification and current status of a single job.
func (s *Service) GetJob(ctx context.Context, envID uuid.UUID, jobID, namespace string) (map[string]any, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.GetJob(ctx, jobID, namespace)
}

// StopJob deregisters a job. purge=true fully removes it from Nomad state.
func (s *Service) StopJob(ctx context.Context, envID uuid.UUID, jobID, namespace string, purge bool) (*JobActionResponse, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.StopJob(ctx, jobID, namespace, purge)
}

// ListEvaluations returns all evaluations for a job.
func (s *Service) ListEvaluations(ctx context.Context, envID uuid.UUID, jobID, namespace string) ([]EvalStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListEvaluations(ctx, jobID, namespace)
}

// ListDeployments returns all deployments for a job.
func (s *Service) ListDeployments(ctx context.Context, envID uuid.UUID, jobID, namespace string) ([]DeploymentStub, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.ListDeployments(ctx, jobID, namespace)
}

// GetAllocation returns the full allocation details including per-task event history.
func (s *Service) GetAllocation(ctx context.Context, envID uuid.UUID, allocID string) (*AllocationDetail, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.GetAllocation(ctx, allocID)
}

// DeployHCL parses raw HCL, then submits the job to the Nomad cluster bound to
// the given environment. The original HCL is passed as a Submission so the
// Nomad UI's Definition tab shows HCL instead of JSON (requires Nomad 1.6+;
// older versions silently ignore the Submission field).
func (s *Service) DeployHCL(ctx context.Context, envID uuid.UUID, hcl string) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	spec, err := client.ParseHCL(ctx, hcl)
	if err != nil {
		return fmt.Errorf("parse hcl: %w", err)
	}
	_, err = client.SubmitJob(ctx, spec, hcl)
	return err
}

// StartJob re-registers a stopped (but not purged) job.
func (s *Service) StartJob(ctx context.Context, envID uuid.UUID, jobID, namespace string) (*JobActionResponse, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return nil, err
	}
	return client.StartJob(ctx, jobID, namespace)
}
