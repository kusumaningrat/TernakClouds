package generator

import (
	"bytes"
	"fmt"
	"text/template"
)

// nomad templates use [[ ]] delimiters so Consul Template {{ }} syntax
// inside vault template blocks passes through unchanged.
var nomadTemplates = map[string]*template.Template{
	"default":     loadTemplate("nomad", "with-vault.hcl", "[[", "]]"),
	"no-vault":    loadTemplate("nomad", "default.hcl", "[[", "]]"),
	"with-vault":  loadTemplate("nomad", "with-vault.hcl", "[[", "]]"),
	"with-volume": loadTemplate("nomad", "with-volume.hcl", "[[", "]]"),
}

type nomadTemplateVars struct {
	JobID            string
	ServiceName      string
	BlueprintType    string
	JobType          string
	Datacenter       string
	Namespace        string
	WorkerName       string
	ExposedPort      int
	ContainerPort    int
	CPU              int
	MemoryMB         int
	Image            string
	PortLabel        string
	Strategy         string
	HealthPath       string
	RegistryUsername string
	RegistryPassword string
	VaultRole        string
	VaultPath        string
	WorkspaceLabel   string
	EnvironmentLabel string
	// Volume fields — used by with-volume variant.
	VolumeName      string
	VolumeMountPath string
}

// GenerateNomadHCL translates a PlatformSpec into a Nomad job HCL string.
// The template variant is selected from spec.Runtime.Variant.
func GenerateNomadHCL(spec PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	if spec.Runtime.Provider != "nomad" {
		return "", fmt.Errorf("generator: expected nomad provider, got %q", spec.Runtime.Provider)
	}

	variant := spec.Runtime.Variant
	if variant == "" || variant == "v1" {
		variant = "default"
	}
	tmpl, ok := nomadTemplates[variant]
	if !ok {
		return "", fmt.Errorf("generator: unknown nomad variant %q", variant)
	}

	ns := spec.Runtime.Namespace
	if ns == "" {
		ns = "default"
	}

	jobType := "service"
	switch spec.Service.Type {
	case "cron-job":
		jobType = "batch"
	case "worker", "background-processor":
		jobType = "service"
	}

	strategy := spec.Deployment.Strategy
	if strategy == "" {
		strategy = "rolling"
	}

	healthPath := spec.Container.HealthPath
	if healthPath == "" {
		healthPath = "/health"
	}

	image := spec.Container.Image
	if spec.Container.Tag != "" {
		image = image + ":" + spec.Container.Tag
	}

	cpu := spec.Container.CPU
	if cpu <= 0 {
		cpu = 256
	}
	mem := spec.Container.MemoryMB
	if mem <= 0 {
		mem = 256
	}

	volumeName := spec.Service.Name + "-data"
	volumeMountPath := "/data"

	vars := nomadTemplateVars{
		JobID:            spec.Service.Name,
		ServiceName:      spec.Service.Name,
		BlueprintType:    spec.Service.Type,
		JobType:          jobType,
		Datacenter:       spec.Runtime.Datacenter,
		Namespace:        ns,
		WorkerName:       spec.Runtime.WorkerName,
		ExposedPort:      hostPort(spec.Container.HostPort, spec.Container.Port),
		ContainerPort:    spec.Container.Port,
		CPU:              cpu,
		MemoryMB:         mem,
		Image:            image,
		PortLabel:        "http",
		Strategy:         strategy,
		HealthPath:       healthPath,
		RegistryUsername: spec.Container.RegistryUsername,
		RegistryPassword: spec.Container.RegistryPassword,
		VaultRole:        spec.Secrets.VaultRole,
		VaultPath:        spec.Secrets.VaultPath,
		WorkspaceLabel:   workspaceSlug,
		EnvironmentLabel: envSlug,
		VolumeName:       volumeName,
		VolumeMountPath:  volumeMountPath,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, vars); err != nil {
		return "", fmt.Errorf("nomad/%s generator: %w", variant, err)
	}
	return buf.String(), nil
}

// hostPort returns the external host port. Falls back to containerPort when
// no dedicated host port is configured (hostPort == 0).
func hostPort(hostPort, containerPort int) int {
	if hostPort > 0 {
		return hostPort
	}
	return containerPort
}
