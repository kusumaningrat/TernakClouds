package generator

import (
	"bytes"
	"fmt"
	"text/template"
)

// cicdTemplates maps provider → style → parsed template.
// All variants are loaded at init time so template parse errors surface at startup.
var cicdTemplates = map[string]map[string]*template.Template{
	"github-actions": {
		"v1":      loadTemplate("github-actions", "v1.yaml", "", ""),
		"ssh":     loadTemplate("github-actions", "ssh.yaml", "", ""),
		"nomad":   loadTemplate("github-actions", "nomad.yaml", "", ""),
		"kubectl": loadTemplate("github-actions", "kubectl.yaml", "", ""),
		"helm":    loadTemplate("github-actions", "helm.yaml", "", ""),
	},
	"gitlab-ci": {
		"v1":      loadTemplate("gitlab-ci", "v1.yaml", "", ""),
		"ssh":     loadTemplate("gitlab-ci", "ssh.yaml", "", ""),
		"nomad":   loadTemplate("gitlab-ci", "nomad.yaml", "", ""),
		"kubectl": loadTemplate("gitlab-ci", "kubectl.yaml", "", ""),
		"helm":    loadTemplate("gitlab-ci", "helm.yaml", "", ""),
	},
	"jenkins": {
		"v1":      loadTemplate("jenkins", "v1.groovy", "", ""),
		"ssh":     loadTemplate("jenkins", "ssh.groovy", "", ""),
		"nomad":   loadTemplate("jenkins", "nomad.groovy", "", ""),
		"kubectl": loadTemplate("jenkins", "kubectl.groovy", "", ""),
		"helm":    loadTemplate("jenkins", "helm.groovy", "", ""),
	},
}

type cicdTemplateVars struct {
	ServiceName      string
	BlueprintType    string
	Branch           string
	RegistryEndpoint string
	ImagePath        string
	EnvironmentLabel string
	WorkspaceLabel   string
	Namespace        string // Nomad namespace (used by nomad-style templates)
	K8sNamespace     string // Kubernetes namespace (used by kubectl/helm templates)
}

// GenerateCICD generates a CI/CD workflow selected by spec.CICD.Provider and spec.CICD.Style.
func GenerateCICD(spec PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	style := spec.CICD.Style
	if style == "" {
		style = "v1"
	}

	providerMap, ok := cicdTemplates[spec.CICD.Provider]
	if !ok {
		return "", fmt.Errorf("unsupported cicd provider: %q", spec.CICD.Provider)
	}
	tmpl, ok := providerMap[style]
	if !ok {
		return "", fmt.Errorf("unsupported style %q for cicd provider %q", style, spec.CICD.Provider)
	}

	branch := spec.CICD.Branch
	if branch == "" {
		branch = "main"
	}

	ns := spec.Runtime.Namespace
	if ns == "" {
		ns = "default"
	}
	k8sNS := spec.Runtime.K8sNamespace
	if k8sNS == "" {
		k8sNS = "default"
	}

	vars := cicdTemplateVars{
		ServiceName:      spec.Service.Name,
		BlueprintType:    spec.Service.Type,
		Branch:           branch,
		RegistryEndpoint: spec.Registry.Endpoint,
		ImagePath:        spec.Registry.ImagePath,
		EnvironmentLabel: envSlug,
		WorkspaceLabel:   workspaceSlug,
		Namespace:        ns,
		K8sNamespace:     k8sNS,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, vars); err != nil {
		return "", fmt.Errorf("%s/%s generator: %w", spec.CICD.Provider, style, err)
	}
	return buf.String(), nil
}

// GenerateGitHubActions delegates to GenerateCICD for backward compatibility.
func GenerateGitHubActions(spec PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	return GenerateCICD(spec, workspaceSlug, envSlug)
}

// GenerateGitLabCI delegates to GenerateCICD for backward compatibility.
func GenerateGitLabCI(spec PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	return GenerateCICD(spec, workspaceSlug, envSlug)
}

// GenerateJenkinsfile delegates to GenerateCICD for backward compatibility.
func GenerateJenkinsfile(spec PlatformSpec, workspaceSlug, envSlug string) (string, error) {
	return GenerateCICD(spec, workspaceSlug, envSlug)
}
