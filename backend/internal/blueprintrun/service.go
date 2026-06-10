package blueprintrun

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"text/template"
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/blueprint"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/nomad"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

type Service struct {
	repo           *Repository
	blueprintSvc   *blueprint.Service
	catalogSvc     *servicecatalog.Service
	capRepo        *capability.Repository
	nomadSvc       *nomad.Service
	vaultClient    vault.Client
}

func NewService(
	repo *Repository,
	blueprintSvc *blueprint.Service,
	catalogSvc *servicecatalog.Service,
	capRepo *capability.Repository,
	nomadSvc *nomad.Service,
	vaultClient vault.Client,
) *Service {
	return &Service{
		repo:         repo,
		blueprintSvc: blueprintSvc,
		catalogSvc:   catalogSvc,
		capRepo:      capRepo,
		nomadSvc:     nomadSvc,
		vaultClient:  vaultClient,
	}
}

// Trigger creates a BlueprintRun record and starts async execution.
func (s *Service) Trigger(
	ctx context.Context,
	workspaceID, environmentID uuid.UUID,
	environmentSlug string,
	callerID uuid.UUID,
	input TriggerInput,
) (*RunResponse, error) {
	bp, err := s.blueprintSvc.GetRaw(input.BlueprintName)
	if err != nil {
		return nil, ErrBlueprintNotFound
	}

	if input.Inputs == nil {
		input.Inputs = map[string]any{}
	}

	run := &BlueprintRun{
		BlueprintID:     bp.ID,
		BlueprintName:   bp.Name,
		WorkspaceID:     workspaceID,
		EnvironmentID:   environmentID,
		EnvironmentSlug: environmentSlug,
		TriggeredBy:     callerID,
		Status:          RunStatusPending,
		Inputs:          input.Inputs,
	}
	if err := s.repo.Create(run); err != nil {
		return nil, fmt.Errorf("create run: %w", err)
	}

	// Create step records in pending state.
	steps := make([]BlueprintRunStep, len(bp.StepsConfig))
	for i, sd := range bp.StepsConfig {
		steps[i] = BlueprintRunStep{
			RunID:    run.ID,
			StepID:   sd.ID,
			StepType: sd.Type,
			Label:    sd.Label,
			Status:   StepStatusPending,
			Output:   map[string]any{},
		}
	}
	if err := s.repo.CreateSteps(steps); err != nil {
		return nil, fmt.Errorf("create steps: %w", err)
	}

	// Reload with steps for response.
	created, err := s.repo.FindWithSteps(run.ID.String())
	if err != nil {
		return nil, err
	}

	resp := toRunResponse(*created)

	// Execute asynchronously; pass background context so the run survives the HTTP request.
	go s.execute(context.Background(), run.ID, bp, environmentSlug, callerID)

	return &resp, nil
}

// Get returns a single run with all its steps.
func (s *Service) Get(id string) (*RunResponse, error) {
	run, err := s.repo.FindWithSteps(id)
	if err != nil {
		return nil, err
	}
	resp := toRunResponse(*run)
	return &resp, nil
}

// List returns a paginated list of runs for a workspace (steps not embedded for perf).
func (s *Service) List(workspaceID uuid.UUID, page, limit int) (*RunListPage, error) {
	runs, total, err := s.repo.ListByWorkspace(workspaceID, page, limit)
	if err != nil {
		return nil, err
	}
	items := make([]RunResponse, len(runs))
	for i, r := range runs {
		items[i] = toRunResponse(r)
	}
	return &RunListPage{Items: items, Total: total, Page: page, Limit: limit}, nil
}

// ── Execution engine ──────────────────────────────────────────────────────────

func (s *Service) execute(ctx context.Context, runID uuid.UUID, bp *blueprint.Blueprint, envSlug string, callerID uuid.UUID) {
	if err := s.repo.UpdateStatus(runID.String(), RunStatusRunning); err != nil {
		slog.Error("blueprintrun: mark running", "run", runID, "err", err)
		return
	}

	steps, err := s.repo.FindStepsByRun(runID)
	if err != nil {
		slog.Error("blueprintrun: load steps", "run", runID, "err", err)
		_ = s.repo.UpdateRunCompleted(runID.String(), RunStatusFailed)
		return
	}

	// stepOutput accumulates outputs from completed steps; used for template rendering.
	stepOutput := map[string]map[string]any{}

	run, _ := s.repo.FindByID(runID.String())

	for i, step := range steps {
		stepDef := bp.StepsConfig[i]

		now := time.Now()
		step.Status = StepStatusRunning
		step.StartedAt = &now
		_ = s.repo.UpdateStep(&step)

		output, execErr := s.executeStep(ctx, stepDef, run, envSlug, callerID, stepOutput)

		done := time.Now()
		step.CompletedAt = &done
		step.Output = output

		if execErr != nil {
			slog.Error("blueprintrun: step failed", "run", runID, "step", step.StepID, "err", execErr)
			step.Status = StepStatusFailed
			step.ErrorMsg = execErr.Error()
			_ = s.repo.UpdateStep(&step)
			_ = s.repo.UpdateRunCompleted(runID.String(), RunStatusFailed)
			return
		}

		step.Status = StepStatusCompleted
		_ = s.repo.UpdateStep(&step)
		stepOutput[stepDef.ID] = output
	}

	_ = s.repo.UpdateRunCompleted(runID.String(), RunStatusCompleted)
}

func (s *Service) executeStep(
	ctx context.Context,
	stepDef blueprint.BlueprintStep,
	run *BlueprintRun,
	envSlug string,
	callerID uuid.UUID,
	previousOutputs map[string]map[string]any,
) (map[string]any, error) {
	// Build template data: inputs + workspace/env meta + previous step outputs.
	tplData := buildTemplateData(run, envSlug, previousOutputs)

	// Render all string values in step config.
	cfg, err := renderConfig(stepDef.Config, tplData)
	if err != nil {
		return nil, fmt.Errorf("render config: %w", err)
	}

	switch stepDef.Type {
	case "deploy_catalog_item":
		return s.stepDeployCatalogItem(ctx, cfg, run, envSlug, callerID)
	case "write_secret":
		return s.stepWriteSecret(ctx, cfg, run)
	case "generate_cicd":
		return s.stepGenerateCICD(cfg)
	case "generate_repository":
		return s.stepGenerateRepository(cfg)
	case "configure_environment":
		return s.stepConfigureEnvironment(cfg)
	default:
		return nil, fmt.Errorf("unknown step type: %s", stepDef.Type)
	}
}

// ── Step implementations ──────────────────────────────────────────────────────

func (s *Service) stepDeployCatalogItem(
	ctx context.Context,
	cfg map[string]any,
	run *BlueprintRun,
	envSlug string,
	callerID uuid.UUID,
) (map[string]any, error) {
	catalogName, _ := cfg["catalog_name"].(string)
	jobName, _ := cfg["job_name"].(string)
	if catalogName == "" {
		return nil, fmt.Errorf("deploy_catalog_item: catalog_name is required")
	}
	if jobName == "" {
		return nil, fmt.Errorf("deploy_catalog_item: job_name is required")
	}

	// Resolve runtime provider from environment capability bindings.
	bindings, err := s.capRepo.ListBindings(run.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("resolve capabilities: %w", err)
	}

	runtimeProvider := ""
	for _, b := range bindings {
		if b.CapabilityName == capability.CapRuntime && b.IsEnabled {
			for _, pc := range b.ProviderConfigs {
				if pc.ProviderName == "nomad" {
					runtimeProvider = "nomad"
					break
				}
				if runtimeProvider == "" {
					runtimeProvider = pc.ProviderName
				}
			}
			if runtimeProvider != "" {
				break
			}
		}
	}
	if runtimeProvider == "" {
		return nil, fmt.Errorf("no runtime provider configured for environment %s", envSlug)
	}

	// Resolve Nomad datacenter/worker/namespace.
	datacenter := strCfg(cfg, "datacenter")
	workerName := strCfg(cfg, "worker_name")
	namespace := strCfg(cfg, "namespace")
	if namespace == "" {
		namespace = "default"
	}

	if runtimeProvider == "nomad" && datacenter == "" {
		nodes, err := s.nomadSvc.ListNodes(ctx, run.EnvironmentID)
		if err == nil && len(nodes) > 0 {
			datacenter = nodes[0].Datacenter
			if workerName == "" {
				workerName = nodes[0].Name
			}
		}
	}

	exposedPort := intCfg(cfg, "exposed_port")

	input := servicecatalog.DeployInput{
		CatalogName:     catalogName,
		JobName:         jobName,
		RuntimeProvider: runtimeProvider,
		ExposedPort:     exposedPort,
		Datacenter:      datacenter,
		WorkerName:      workerName,
		Namespace:       namespace,
		HostNetwork:     "private",
	}

	deployment, err := s.catalogSvc.Deploy(ctx, run.WorkspaceID, run.EnvironmentID, callerID, input)
	if err != nil {
		return nil, fmt.Errorf("deploy catalog item %q: %w", catalogName, err)
	}

	return map[string]any{
		"deployment_id":    deployment.ID.String(),
		"job_name":         deployment.JobName,
		"runtime_provider": deployment.RuntimeProvider,
		"runtime_job_id":   deployment.RuntimeJobID,
		"status":           deployment.Status,
	}, nil
}

func (s *Service) stepWriteSecret(ctx context.Context, cfg map[string]any, run *BlueprintRun) (map[string]any, error) {
	vaultPath, _ := cfg["vault_path"].(string)
	if vaultPath == "" {
		return nil, fmt.Errorf("write_secret: vault_path is required")
	}

	values := map[string]string{}
	if raw, ok := cfg["values"]; ok {
		switch v := raw.(type) {
		case map[string]any:
			for k, val := range v {
				values[k] = fmt.Sprintf("%v", val)
			}
		case map[string]string:
			values = v
		}
	}

	if len(values) == 0 {
		return nil, fmt.Errorf("write_secret: values cannot be empty")
	}

	if err := s.vaultClient.WriteKV(ctx, vaultPath, values); err != nil {
		return nil, fmt.Errorf("write secret to %s: %w", vaultPath, err)
	}

	return map[string]any{
		"vault_path": vaultPath,
		"keys":       keysOf(values),
	}, nil
}

func (s *Service) stepGenerateCICD(cfg map[string]any) (map[string]any, error) {
	provider, _ := cfg["provider"].(string)
	repo, _ := cfg["repository"].(string)
	slog.Info("blueprintrun: generate_cicd stub", "provider", provider, "repo", repo)
	return map[string]any{
		"provider":   provider,
		"repository": repo,
		"status":     "generated",
	}, nil
}

func (s *Service) stepGenerateRepository(cfg map[string]any) (map[string]any, error) {
	name, _ := cfg["name"].(string)
	slog.Info("blueprintrun: generate_repository stub", "name", name)
	return map[string]any{
		"repository": name,
		"status":     "created",
	}, nil
}

func (s *Service) stepConfigureEnvironment(cfg map[string]any) (map[string]any, error) {
	slog.Info("blueprintrun: configure_environment stub", "cfg", cfg)
	return map[string]any{"status": "configured"}, nil
}

// ── Template helpers ──────────────────────────────────────────────────────────

func buildTemplateData(run *BlueprintRun, envSlug string, previousOutputs map[string]map[string]any) map[string]any {
	data := map[string]any{
		"workspace_id":  run.WorkspaceID.String(),
		"environment":   envSlug,
		"environment_id": run.EnvironmentID.String(),
	}
	for k, v := range run.Inputs {
		data[k] = v
	}
	// Expose previous step outputs as steps.<step_id>.<key>
	stepsMap := map[string]any{}
	for id, out := range previousOutputs {
		stepsMap[id] = out
	}
	data["steps"] = stepsMap
	return data
}

func renderConfig(cfg map[string]any, data map[string]any) (map[string]any, error) {
	out := make(map[string]any, len(cfg))
	for k, v := range cfg {
		switch val := v.(type) {
		case string:
			rendered, err := renderTemplate(val, data)
			if err != nil {
				return nil, fmt.Errorf("key %q: %w", k, err)
			}
			out[k] = rendered
		case map[string]any:
			nested, err := renderConfig(val, data)
			if err != nil {
				return nil, err
			}
			out[k] = nested
		default:
			out[k] = v
		}
	}
	return out, nil
}

func renderTemplate(tmplStr string, data map[string]any) (string, error) {
	t, err := template.New("").Option("missingkey=zero").Parse(tmplStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// ── Conversion helpers ────────────────────────────────────────────────────────

func toRunResponse(run BlueprintRun) RunResponse {
	steps := make([]StepResponse, len(run.Steps))
	for i, s := range run.Steps {
		steps[i] = toStepResponse(s)
	}
	r := RunResponse{
		ID:              run.ID.String(),
		BlueprintID:     run.BlueprintID.String(),
		BlueprintName:   run.BlueprintName,
		WorkspaceID:     run.WorkspaceID.String(),
		EnvironmentID:   run.EnvironmentID.String(),
		EnvironmentSlug: run.EnvironmentSlug,
		TriggeredBy:     run.TriggeredBy.String(),
		Status:          run.Status,
		Inputs:          run.Inputs,
		Steps:           steps,
		CreatedAt:       run.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
	if run.CompletedAt != nil {
		t := run.CompletedAt.Format("2006-01-02T15:04:05Z")
		r.CompletedAt = &t
	}
	return r
}

func toStepResponse(s BlueprintRunStep) StepResponse {
	r := StepResponse{
		ID:       s.ID.String(),
		StepID:   s.StepID,
		StepType: s.StepType,
		Label:    s.Label,
		Status:   s.Status,
		Output:   s.Output,
		Error:    s.ErrorMsg,
	}
	if s.StartedAt != nil {
		t := s.StartedAt.Format("2006-01-02T15:04:05Z")
		r.StartedAt = &t
	}
	if s.CompletedAt != nil {
		t := s.CompletedAt.Format("2006-01-02T15:04:05Z")
		r.CompletedAt = &t
	}
	return r
}

func strCfg(cfg map[string]any, key string) string {
	v, _ := cfg[key].(string)
	return v
}

func intCfg(cfg map[string]any, key string) int {
	switch v := cfg[key].(type) {
	case int:
		return v
	case float64:
		return int(v)
	}
	return 0
}

func keysOf(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
