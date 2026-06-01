package kubernetes

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"

	"github.com/goccy/go-yaml"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/capability"
	"github.com/kusumaningrat/ternakclouds/internal/vault"
)

// k8sResourceHeader extracts routing info from a single YAML document.
type k8sResourceHeader struct {
	APIVersion string `yaml:"apiVersion"`
	Kind       string `yaml:"kind"`
	Metadata   struct {
		Name      string `yaml:"name"`
		Namespace string `yaml:"namespace"`
	} `yaml:"metadata"`
}

// resourceAPIPath maps apiVersion+kind to the server-side apply URL path.
func resourceAPIPath(apiVersion, kind, namespace, name string) (string, error) {
	switch {
	case apiVersion == "apps/v1" && kind == "Deployment":
		return "/apis/apps/v1/namespaces/" + namespace + "/deployments/" + name, nil
	case apiVersion == "v1" && kind == "Service":
		return "/api/v1/namespaces/" + namespace + "/services/" + name, nil
	case apiVersion == "autoscaling/v2" && kind == "HorizontalPodAutoscaler":
		return "/apis/autoscaling/v2/namespaces/" + namespace + "/horizontalpodautoscalers/" + name, nil
	case apiVersion == "networking.k8s.io/v1" && kind == "Ingress":
		return "/apis/networking.k8s.io/v1/namespaces/" + namespace + "/ingresses/" + name, nil
	case apiVersion == "v1" && kind == "PersistentVolumeClaim":
		return "/api/v1/namespaces/" + namespace + "/persistentvolumeclaims/" + name, nil
	default:
		return "", fmt.Errorf("unsupported resource: %s %s", apiVersion, kind)
	}
}

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

// DeployYAML applies a multi-document YAML manifest to the cluster via server-side apply.
// Returns "{namespace}/{name}" of the first Deployment found (used as RuntimeJobID).
func (s *Service) DeployYAML(ctx context.Context, envID uuid.UUID, yamlContent string) (string, error) {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return "", err
	}

	runtimeJobID := ""
	for _, doc := range strings.Split(yamlContent, "\n---") {
		doc = strings.TrimSpace(doc)
		if doc == "" {
			continue
		}
		var hdr k8sResourceHeader
		if err := yaml.Unmarshal([]byte(doc), &hdr); err != nil {
			return "", fmt.Errorf("parse yaml document: %w", err)
		}
		if hdr.Kind == "" {
			continue
		}
		ns := hdr.Metadata.Namespace
		if ns == "" {
			ns = "default"
		}
		apiPath, err := resourceAPIPath(hdr.APIVersion, hdr.Kind, ns, hdr.Metadata.Name)
		if err != nil {
			slog.Warn("kubernetes deploy: skipping unsupported resource", "kind", hdr.Kind)
			continue
		}
		if err := client.ApplyResource(ctx, apiPath, doc); err != nil {
			return "", fmt.Errorf("apply %s %s/%s: %w", hdr.Kind, ns, hdr.Metadata.Name, err)
		}
		if hdr.Kind == "Deployment" && runtimeJobID == "" {
			runtimeJobID = ns + "/" + hdr.Metadata.Name
		}
	}

	if runtimeJobID == "" {
		return "", fmt.Errorf("no Deployment resource found in manifest")
	}
	return runtimeJobID, nil
}

// DeleteResources deletes the Deployment and Service for the given namespace/name.
func (s *Service) DeleteResources(ctx context.Context, envID uuid.UUID, namespace, name string) error {
	client, err := s.clientForEnv(ctx, envID)
	if err != nil {
		return err
	}
	if err := client.DeleteDeployment(ctx, namespace, name); err != nil {
		return err
	}
	return client.DeleteService(ctx, namespace, name)
}
