package generator

import (
	"bytes"
	"fmt"
	"text/template"
)

var k8sTemplates = map[string]*template.Template{
	"v1":           loadTemplate("kubernetes", "v1.yaml", "", ""),
	"with-hpa":     loadTemplate("kubernetes", "with-hpa.yaml", "", ""),
	"with-ingress": loadTemplate("kubernetes", "with-ingress.yaml", "", ""),
	"with-pvc":     loadTemplate("kubernetes", "with-pvc.yaml", "", ""),
}

type k8sTemplateVars struct {
	ServiceName      string
	BlueprintType    string
	Namespace        string
	Replicas         int
	Image            string
	ContainerPort    int
	CPURequest       int
	CPULimit         int
	MemoryMB         int
	MemoryLimitMB    int
	Strategy         string
	RegistrySecret   string
	VaultAnnotations bool
	WorkspaceLabel   string
	EnvironmentLabel string
	// HPA fields — used by with-hpa variant.
	MaxReplicas  int
	CPUThreshold int
	// Ingress fields — used by with-ingress variant.
	IngressHost  string
	IngressClass string
	// PVC fields — used by with-pvc variant.
	StorageClass string
	StorageSize  string
	PVCMountPath string
}

// GenerateKubernetesYAML translates a PlatformSpec into a Kubernetes manifest string.
// The template variant is selected from spec.Runtime.Variant.
func GenerateKubernetesYAML(spec PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	if spec.Runtime.Provider != "kubernetes" {
		return "", fmt.Errorf("generator: expected kubernetes provider, got %q", spec.Runtime.Provider)
	}

	variant := spec.Runtime.Variant
	if variant == "" {
		variant = "v1"
	}
	tmpl, ok := k8sTemplates[variant]
	if !ok {
		return "", fmt.Errorf("generator: unknown kubernetes variant %q", variant)
	}

	ns := spec.Runtime.K8sNamespace
	if ns == "" {
		ns = "default"
	}

	replicas := spec.Runtime.Replicas
	if replicas <= 0 {
		replicas = 1
	}

	strategy := spec.Deployment.Strategy
	if strategy == "" {
		strategy = "rolling"
	}

	image := spec.Container.Image
	if spec.Container.Tag != "" {
		image = image + ":" + spec.Container.Tag
	}

	cpu := spec.Container.CPU
	if cpu <= 0 {
		cpu = 250
	}
	mem := spec.Container.MemoryMB
	if mem <= 0 {
		mem = 256
	}

	maxReplicas := replicas * 3
	if maxReplicas < 3 {
		maxReplicas = 3
	}

	vars := k8sTemplateVars{
		ServiceName:      spec.Service.Name,
		BlueprintType:    spec.Service.Type,
		Namespace:        ns,
		Replicas:         replicas,
		Image:            image,
		ContainerPort:    spec.Container.Port,
		CPURequest:       cpu,
		CPULimit:         cpu * 2,
		MemoryMB:         mem,
		MemoryLimitMB:    mem * 2,
		Strategy:         strategy,
		VaultAnnotations: spec.Secrets.VaultPath != "",
		WorkspaceLabel:   workspaceSlug,
		EnvironmentLabel: envSlug,
		MaxReplicas:      maxReplicas,
		CPUThreshold:     80,
		IngressHost:      spec.Service.Name + ".example.com",
		IngressClass:     "nginx",
		StorageClass:     "standard",
		StorageSize:      "1Gi",
		PVCMountPath:     "/data",
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, vars); err != nil {
		return "", fmt.Errorf("kubernetes/%s generator: %w", variant, err)
	}
	return buf.String(), nil
}
