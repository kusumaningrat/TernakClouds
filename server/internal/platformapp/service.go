package platformapp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/blueprint"
	"github.com/kusumaningrat/ternakclouds/internal/generator"
	"github.com/kusumaningrat/ternakclouds/internal/nomad"
)

type Service struct {
	repo         *Repository
	blueprintSvc *blueprint.Service
	nomadSvc     *nomad.Service
}

func NewService(repo *Repository, blueprintSvc *blueprint.Service, nomadSvc *nomad.Service) *Service {
	return &Service{
		repo:         repo,
		blueprintSvc: blueprintSvc,
		nomadSvc:     nomadSvc,
	}
}

// Preview generates manifests for the given spec without provisioning anything.
func (s *Service) Preview(input PreviewInput, workspaceSlug, envSlug string) (*GeneratedResources, error) {
	bp, err := s.blueprintSvc.Get(input.BlueprintName)
	if err != nil {
		return nil, err
	}

	spec := input.Spec
	resources := &GeneratedResources{
		RuntimeProvider: spec.Runtime.Provider,
	}

	manifest, err := generateManifest(spec, workspaceSlug, envSlug)
	if err != nil {
		return nil, err
	}
	resources.RuntimeManifest = manifest

	// Generate CI/CD workflow if requested.
	if spec.CICD.Enabled && spec.CICD.Provider != "" {
		cicd, cicdErr := generateCICD(spec, workspaceSlug, envSlug)
		if cicdErr == nil {
			resources.CICDWorkflow = cicd
			resources.CICDProvider = spec.CICD.Provider
		}
	}

	_ = bp // blueprint metadata available for future validation
	return resources, nil
}

// Provision creates a PlatformApp record and deploys it to the runtime.
func (s *Service) Provision(
	ctx context.Context,
	workspaceID, envID, callerID uuid.UUID,
	workspaceSlug, envSlug string,
	input ProvisionInput,
) (*PlatformAppResponse, error) {
	bp, err := s.blueprintSvc.Get(input.BlueprintName)
	if err != nil {
		return nil, err
	}

	spec := input.Spec

	manifest, err := generateManifest(spec, workspaceSlug, envSlug)
	if err != nil {
		return nil, fmt.Errorf("generate manifest: %w", err)
	}
	if input.OverrideManifest != "" {
		manifest = input.OverrideManifest
	}

	specJSON, err := json.Marshal(spec)
	if err != nil {
		return nil, fmt.Errorf("marshal spec: %w", err)
	}

	bpID, err := uuid.Parse(bp.ID)
	if err != nil {
		return nil, fmt.Errorf("invalid blueprint id: %w", err)
	}

	app := &PlatformApp{
		WorkspaceID:       workspaceID,
		EnvironmentID:     envID,
		BlueprintID:       bpID,
		BlueprintName:     input.BlueprintName,
		Name:              spec.Service.Name,
		RuntimeProvider:   spec.Runtime.Provider,
		SpecJSON:          string(specJSON),
		Status:            StatusPending,
		GeneratedManifest: manifest,
		ProvisionedBy:     callerID,
	}

	if err := s.repo.Create(app); err != nil {
		return nil, fmt.Errorf("create app record: %w", err)
	}

	// Deploy to runtime.
	runtimeJobID, deployErr := s.deploy(ctx, envID, spec, manifest)
	status := StatusProvisioned
	if deployErr != nil {
		status = StatusFailed
		runtimeJobID = ""
	}

	_ = s.repo.UpdateStatus(app.ID, status, runtimeJobID)
	app.Status = status
	app.RuntimeJobID = runtimeJobID

	return toResponse(app, spec), nil
}

// List returns all platform apps for an environment.
func (s *Service) List(envID uuid.UUID) ([]PlatformAppResponse, error) {
	apps, err := s.repo.List(envID)
	if err != nil {
		return nil, err
	}
	out := make([]PlatformAppResponse, 0, len(apps))
	for i := range apps {
		var spec generator.PlatformSpec
		_ = json.Unmarshal([]byte(apps[i].SpecJSON), &spec)
		out = append(out, *toResponse(&apps[i], spec))
	}
	return out, nil
}

// Get returns a single platform app.
func (s *Service) Get(id uuid.UUID) (*PlatformAppResponse, error) {
	app, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	var spec generator.PlatformSpec
	_ = json.Unmarshal([]byte(app.SpecJSON), &spec)
	return toResponse(app, spec), nil
}

// Delete stops the runtime job (best-effort) and removes the record.
func (s *Service) Delete(ctx context.Context, id, envID uuid.UUID) error {
	app, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if app.RuntimeJobID != "" && app.RuntimeProvider == "nomad" {
		var spec generator.PlatformSpec
		_ = json.Unmarshal([]byte(app.SpecJSON), &spec)
		ns := spec.Runtime.Namespace
		if ns == "" {
			ns = "default"
		}
		_, _ = s.nomadSvc.StopJob(ctx, envID, app.RuntimeJobID, ns, false)
	}

	return s.repo.Delete(id)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

func generateManifest(spec generator.PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	switch spec.Runtime.Provider {
	case "nomad":
		return generator.GenerateNomadHCL(spec, workspaceSlug, envSlug)
	case "kubernetes":
		return generator.GenerateKubernetesYAML(spec, workspaceSlug, envSlug)
	default:
		return "", fmt.Errorf("%w: %s", ErrUnsupportedRuntime, spec.Runtime.Provider)
	}
}

func generateCICD(spec generator.PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	return generator.GenerateCICD(spec, workspaceSlug, envSlug)
}

func (s *Service) deploy(ctx context.Context, envID uuid.UUID, spec generator.PlatformSpec, manifest string) (string, error) {
	switch spec.Runtime.Provider {
	case "nomad":
		if err := s.nomadSvc.DeployHCL(ctx, envID, manifest); err != nil {
			return "", err
		}
		// Nomad job ID is deterministic from the spec.
		return spec.Service.Name + "-bp", nil
	case "kubernetes":
		// K8s deployment is submitted via kubectl-equivalent in the k8s service.
		// For now we store the manifest; actual K8s apply is a future integration point.
		return spec.Service.Name, nil
	default:
		return "", fmt.Errorf("%w: %s", ErrUnsupportedRuntime, spec.Runtime.Provider)
	}
}

func toResponse(app *PlatformApp, spec generator.PlatformSpec) *PlatformAppResponse {
	return &PlatformAppResponse{
		ID:                app.ID.String(),
		WorkspaceID:       app.WorkspaceID.String(),
		EnvironmentID:     app.EnvironmentID.String(),
		BlueprintID:       app.BlueprintID.String(),
		BlueprintName:     app.BlueprintName,
		Name:              app.Name,
		RuntimeProvider:   app.RuntimeProvider,
		Status:            app.Status,
		GeneratedManifest: app.GeneratedManifest,
		RuntimeJobID:      app.RuntimeJobID,
		ProvisionedBy:     app.ProvisionedBy.String(),
		Spec:              spec,
		CreatedAt:         app.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:         app.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
