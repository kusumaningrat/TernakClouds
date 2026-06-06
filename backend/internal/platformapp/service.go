package platformapp

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/blueprint"
	"github.com/kusumaningrat/ternakclouds/internal/generator"
	"github.com/kusumaningrat/ternakclouds/internal/nomad"
	"github.com/kusumaningrat/ternakclouds/internal/repository"
	"github.com/kusumaningrat/ternakclouds/internal/secret"
)

type Service struct {
	repo         *Repository
	blueprintSvc *blueprint.Service
	nomadSvc     *nomad.Service
	repoSvc      *repository.Service
	secretSvc    *secret.Service
}

func NewService(
	repo *Repository,
	blueprintSvc *blueprint.Service,
	nomadSvc *nomad.Service,
	repoSvc *repository.Service,
	secretSvc *secret.Service,
) *Service {
	return &Service{
		repo:         repo,
		blueprintSvc: blueprintSvc,
		nomadSvc:     nomadSvc,
		repoSvc:      repoSvc,
		secretSvc:    secretSvc,
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

	if spec.CICD.Enabled && spec.CICD.Provider != "" {
		cicd, cicdErr := generateCICD(spec, workspaceSlug, envSlug)
		if cicdErr == nil {
			resources.CICDWorkflow = cicd
			resources.CICDProvider = spec.CICD.Provider
		}
	}

	_ = bp
	return resources, nil
}

// Provision creates a PlatformApp record, writes initial secrets to Vault (if provided),
// deploys to the runtime, and commits generated manifests to the repository (if configured).
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

	// ── Generate runtime manifest ─────────────────────────────────────────────
	manifest, err := generateManifest(spec, workspaceSlug, envSlug)
	if err != nil {
		return nil, fmt.Errorf("generate manifest: %w", err)
	}
	if input.OverrideManifest != "" {
		manifest = input.OverrideManifest
	}

	// ── Generate CI/CD workflow (if requested) ────────────────────────────────
	var cicdWorkflow string
	if spec.CICD.Enabled && spec.CICD.Provider != "" {
		cicdWorkflow, _ = generateCICD(spec, workspaceSlug, envSlug)
		if input.OverrideCICD != "" {
			cicdWorkflow = input.OverrideCICD
		}
	}

	specJSON, err := json.Marshal(spec)
	if err != nil {
		return nil, fmt.Errorf("marshal spec: %w", err)
	}

	bpID, err := uuid.Parse(bp.ID)
	if err != nil {
		return nil, fmt.Errorf("invalid blueprint id: %w", err)
	}

	// ── Write initial secrets to Vault (before deploy so runtime can read them) ─
	if len(input.InitialSecrets) > 0 && input.SecretGrantID != "" {
		grantID, err := uuid.Parse(input.SecretGrantID)
		if err != nil {
			return nil, fmt.Errorf("invalid secret grant id: %w", err)
		}
		if err := s.secretSvc.WriteValue(ctx, envID, grantID, "", input.InitialSecrets); err != nil {
			return nil, fmt.Errorf("write initial secrets: %w", err)
		}
	}

	// ── Persist PlatformApp record ────────────────────────────────────────────
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
	if input.Repository != nil {
		baseBranch := input.Repository.BaseBranch
		if baseBranch == "" {
			baseBranch = "main"
		}
		app.RepoProviderID = input.Repository.ProviderID
		app.RepoName = input.Repository.Repository
		app.RepoBranch = baseBranch
	}

	if err := s.repo.Create(app); err != nil {
		return nil, fmt.Errorf("create app record: %w", err)
	}

	// Manifests are provisioned — CI/CD pipeline handles the actual runtime deploy.
	_ = s.repo.UpdateStatus(app.ID, StatusProvisioned, "")
	app.Status = StatusProvisioned

	// ── Commit manifests to repository ───────────────────────────────────────
	resp := toResponse(app, spec)
	if input.Repository != nil && input.Repository.ProviderID != "" {
		commitSHA, prNum, prURL, repoErr := s.commitManifestsAndPR(
			ctx,
			input.Repository,
			spec,
			manifest,
			cicdWorkflow,
		)
		app.CommitSHA = commitSHA
		app.PRNumber = prNum
		app.PRURL = prURL
		_ = s.repo.UpdateRepoInfo(app.ID, commitSHA, prURL, prNum)
		resp.CommitSHA = commitSHA
		resp.PRNumber = prNum
		resp.PRURL = prURL
		resp.RepoError = repoErr
	}

	// ── Record deployment event ───────────────────────────────────────────────
	drec := &DeploymentRecord{
		PlatformAppID: app.ID,
		TriggeredBy:   callerID,
		Status:        app.Status,
		RuntimeJobID:  app.RuntimeJobID,
		RepoName:      app.RepoName,
		RepoBranch:    app.RepoBranch,
		CommitSHA:     app.CommitSHA,
		PRNumber:      app.PRNumber,
		PRURL:         app.PRURL,
		CICDProvider:  spec.CICD.Provider,
	}
	_ = s.repo.CreateDeployment(drec) // best-effort — don't fail provision on history error

	return resp, nil
}

const defaultDeploymentLimit = 5

// ListDeployments returns a page of deployment records for a platform app, newest first.
func (s *Service) ListDeployments(appID uuid.UUID, page, limit int) (*DeploymentHistoryPage, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = defaultDeploymentLimit
	}
	offset := (page - 1) * limit

	records, total, err := s.repo.ListDeployments(appID, offset, limit)
	if err != nil {
		return nil, err
	}

	items := make([]DeploymentRecordResponse, 0, len(records))
	for _, r := range records {
		items = append(items, DeploymentRecordResponse{
			ID:            r.ID.String(),
			PlatformAppID: r.PlatformAppID.String(),
			TriggeredBy:   r.TriggeredBy.String(),
			Status:        r.Status,
			RuntimeJobID:  r.RuntimeJobID,
			RepoName:      r.RepoName,
			RepoBranch:    r.RepoBranch,
			CommitSHA:     r.CommitSHA,
			PRNumber:      r.PRNumber,
			PRURL:         r.PRURL,
			CICDProvider:  r.CICDProvider,
			Message:       r.Message,
			CreatedAt:     r.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	return &DeploymentHistoryPage{
		Items: items,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

const defaultAppLimit = 5

// List returns a page of platform apps for an environment.
func (s *Service) List(envID uuid.UUID, page, limit int) (*PlatformAppPage, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = defaultAppLimit
	}
	offset := (page - 1) * limit

	apps, total, err := s.repo.List(envID, offset, limit)
	if err != nil {
		return nil, err
	}

	items := make([]PlatformAppResponse, 0, len(apps))
	for i := range apps {
		var spec generator.PlatformSpec
		_ = json.Unmarshal([]byte(apps[i].SpecJSON), &spec)
		items = append(items, *toResponse(&apps[i], spec))
	}

	return &PlatformAppPage{
		Items: items,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
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

// commitManifestsAndPR commits the runtime manifest (and CI/CD workflow if present)
// to a new branch and opens a pull request.
// Returns (commitSHA, prNumber, prURL, repoError). repoError is non-empty if any step failed.
func (s *Service) commitManifestsAndPR(
	ctx context.Context,
	repoCfg *RepositoryProvisionConfig,
	spec generator.PlatformSpec,
	manifest string,
	cicdWorkflow string,
) (commitSHA string, prNumber int, prURL string, repoError string) {
	if s.repoSvc == nil {
		repoError = "repository service not available"
		return
	}

	providerID, err := uuid.Parse(repoCfg.ProviderID)
	if err != nil {
		repoError = fmt.Sprintf("invalid provider id: %v", err)
		return
	}

	baseBranch := repoCfg.BaseBranch
	if baseBranch == "" {
		baseBranch = "main"
	}
	headBranch := fmt.Sprintf("idp/deploy/%s-%d", spec.Service.Name, time.Now().Unix())

	// Build file list.
	files := []repository.FileEntryInput{
		{
			Path:    runtimeManifestPath(spec.Service.Name, spec.Runtime.Provider),
			Content: manifest,
		},
	}
	if cicdWorkflow != "" {
		files = append(files, repository.FileEntryInput{
			Path:    cicdWorkflowPath(spec.Service.Name, spec.CICD.Provider),
			Content: cicdWorkflow,
		})
	}

	// Commit to new branch.
	result, err := s.repoSvc.CommitFiles(ctx, providerID, repository.CommitFilesInput{
		Repository:   repoCfg.Repository,
		Branch:       headBranch,
		Message:      fmt.Sprintf("feat: provision %s via TernakClouds IDP", spec.Service.Name),
		Files:        files,
		CreateBranch: true,
	})
	if err != nil {
		repoError = fmt.Sprintf("commit failed: %v", err)
		return
	}
	if result == nil {
		repoError = "commit returned no result"
		return
	}
	commitSHA = result.SHA

	// Open pull request.
	prResult, err := s.repoSvc.CreatePullRequest(ctx, providerID, repository.PullRequestInput{
		Repository: repoCfg.Repository,
		Title:      fmt.Sprintf("feat: provision %s via TernakClouds IDP", spec.Service.Name),
		Body:       buildPRBody(spec, manifest, cicdWorkflow),
		Head:       headBranch,
		Base:       baseBranch,
	})
	if err != nil {
		repoError = fmt.Sprintf("PR creation failed (commit succeeded at %s): %v", commitSHA[:7], err)
		return
	}
	if prResult == nil {
		repoError = "PR creation returned no result"
		return
	}
	prNumber = prResult.Number
	prURL = prResult.URL
	return
}

// runtimeManifestPath returns the repo-relative path for the runtime manifest.
func runtimeManifestPath(appName, runtimeProvider string) string {
	switch runtimeProvider {
	case "nomad":
		return fmt.Sprintf("nomad/%s.hcl", appName)
	case "kubernetes":
		return fmt.Sprintf("kubernetes/%s.yaml", appName)
	default:
		return fmt.Sprintf("deployments/%s.txt", appName)
	}
}

// cicdWorkflowPath returns the repo-relative path for the CI/CD workflow file.
func cicdWorkflowPath(appName, cicdProvider string) string {
	switch cicdProvider {
	case "github-actions":
		return fmt.Sprintf(".github/workflows/%s.yml", appName)
	case "gitlab-ci":
		return fmt.Sprintf("ci/%s.gitlab-ci.yml", appName)
	case "jenkins":
		return fmt.Sprintf("jenkins/%s.groovy", appName)
	default:
		return fmt.Sprintf("ci/%s.yml", appName)
	}
}

func buildPRBody(spec generator.PlatformSpec, manifest, cicdWorkflow string) string {
	body := fmt.Sprintf("## TernakClouds IDP — %s\n\n", spec.Service.Name)
	body += fmt.Sprintf("| Field | Value |\n|---|---|\n")
	body += fmt.Sprintf("| **Blueprint** | `%s` |\n", spec.Service.Type)
	body += fmt.Sprintf("| **Runtime** | `%s` |\n", spec.Runtime.Provider)
	body += fmt.Sprintf("| **Image** | `%s:%s` |\n", spec.Container.Image, spec.Container.Tag)
	body += fmt.Sprintf("| **Strategy** | `%s` |\n\n", spec.Deployment.Strategy)
	if cicdWorkflow != "" {
		body += fmt.Sprintf("CI/CD workflow (`%s`) included.\n\n", spec.CICD.Provider)
	}
	body += "_Generated by TernakClouds IDP — merge after pipeline checks pass._\n"
	_ = manifest
	return body
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
		RepoProviderID:    app.RepoProviderID,
		RepoName:          app.RepoName,
		RepoBranch:        app.RepoBranch,
		CommitSHA:         app.CommitSHA,
		PRNumber:          app.PRNumber,
		PRURL:             app.PRURL,
		CreatedAt:         app.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:         app.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
