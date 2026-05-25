package kubernetes

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is a minimal Kubernetes API client.
// It authenticates using a Bearer token via the Authorization header.
// TLS verification is skipped by default to support self-signed certs common
// in self-hosted clusters; production deployments should configure proper CA certs.
type Client struct {
	address string
	token   string
	http    *http.Client
}

func NewClient(address, token string) *Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
	}
	return &Client{
		address: strings.TrimRight(address, "/"),
		token:   token,
		http:    &http.Client{Timeout: 10 * time.Second, Transport: transport},
	}
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.address+path, nil)
	if err != nil {
		return err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("kubernetes: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("kubernetes: %s %d: %s", path, resp.StatusCode, b)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// ListNodes returns all nodes in the cluster.
func (c *Client) ListNodes(ctx context.Context) ([]NodeStub, error) {
	var list k8sList[k8sNodeItem]
	if err := c.get(ctx, "/api/v1/nodes", &list); err != nil {
		return nil, err
	}
	stubs := make([]NodeStub, 0, len(list.Items))
	for _, n := range list.Items {
		stubs = append(stubs, toNodeStub(n))
	}
	return stubs, nil
}

// ListNamespaces returns all namespaces.
func (c *Client) ListNamespaces(ctx context.Context) ([]NamespaceStub, error) {
	var list k8sList[k8sNamespaceItem]
	if err := c.get(ctx, "/api/v1/namespaces", &list); err != nil {
		return nil, err
	}
	stubs := make([]NamespaceStub, 0, len(list.Items))
	for _, ns := range list.Items {
		stubs = append(stubs, NamespaceStub{Name: ns.Metadata.Name, Status: ns.Status.Phase})
	}
	return stubs, nil
}

// ListPods returns all pods in the given namespace.
// If labelSelector is non-empty, it is appended as a query parameter.
func (c *Client) ListPods(ctx context.Context, namespace string, labelSelector string) ([]PodStub, error) {
	path := "/api/v1/namespaces/" + namespace + "/pods"
	if labelSelector != "" {
		path += "?labelSelector=" + url.QueryEscape(labelSelector)
	}
	var list k8sList[k8sPodItem]
	if err := c.get(ctx, path, &list); err != nil {
		return nil, err
	}
	stubs := make([]PodStub, 0, len(list.Items))
	for _, p := range list.Items {
		stubs = append(stubs, toPodStub(p))
	}
	return stubs, nil
}

// ListDeployments returns all deployments in the given namespace.
func (c *Client) ListDeployments(ctx context.Context, namespace string) ([]DeploymentStub, error) {
	var list k8sList[k8sDeploymentItem]
	if err := c.get(ctx, "/apis/apps/v1/namespaces/"+namespace+"/deployments", &list); err != nil {
		return nil, err
	}
	stubs := make([]DeploymentStub, 0, len(list.Items))
	for _, d := range list.Items {
		stubs = append(stubs, toDeploymentStub(d))
	}
	return stubs, nil
}

// ListServices returns all services in the given namespace.
func (c *Client) ListServices(ctx context.Context, namespace string) ([]ServiceStub, error) {
	var list k8sList[k8sServiceItem]
	if err := c.get(ctx, "/api/v1/namespaces/"+namespace+"/services", &list); err != nil {
		return nil, err
	}
	stubs := make([]ServiceStub, 0, len(list.Items))
	for _, s := range list.Items {
		stubs = append(stubs, toServiceStub(s))
	}
	return stubs, nil
}

// GetDeployment returns full detail for a single deployment.
func (c *Client) GetDeployment(ctx context.Context, namespace, name string) (*DeploymentDetail, error) {
	var d k8sDeploymentDetailItem
	if err := c.get(ctx, "/apis/apps/v1/namespaces/"+namespace+"/deployments/"+name, &d); err != nil {
		return nil, err
	}
	containers := make([]ContainerSpec, 0, len(d.Spec.Template.Spec.Containers))
	for _, cs := range d.Spec.Template.Spec.Containers {
		ports := make([]ContainerPort, 0, len(cs.Ports))
		for _, p := range cs.Ports {
			ports = append(ports, ContainerPort{Name: p.Name, ContainerPort: p.ContainerPort, Protocol: p.Protocol})
		}
		containers = append(containers, ContainerSpec{Name: cs.Name, Image: cs.Image, Ports: ports})
	}
	conditions := make([]ResourceCondition, 0, len(d.Status.Conditions))
	for _, cond := range d.Status.Conditions {
		conditions = append(conditions, ResourceCondition{Type: cond.Type, Status: cond.Status, Reason: cond.Reason, Message: cond.Message})
	}
	return &DeploymentDetail{
		Name:        d.Metadata.Name,
		Namespace:   d.Metadata.Namespace,
		Desired:     d.Spec.Replicas,
		Ready:       d.Status.ReadyReplicas,
		UpToDate:    d.Status.UpdatedReplicas,
		Available:   d.Status.AvailableReplicas,
		Unavailable: d.Status.UnavailableReplicas,
		Labels:      d.Metadata.Labels,
		Selector:    d.Spec.Selector.MatchLabels,
		Containers:  containers,
		Conditions:  conditions,
		CreatedAt:   d.Metadata.CreationTimestamp,
	}, nil
}

// GetPod returns full detail for a single pod.
func (c *Client) GetPod(ctx context.Context, namespace, name string) (*PodDetail, error) {
	var p k8sPodDetailItem
	if err := c.get(ctx, "/api/v1/namespaces/"+namespace+"/pods/"+name, &p); err != nil {
		return nil, err
	}
	// Build container details by merging spec + status
	specByName := make(map[string]k8sContainerSpec, len(p.Spec.Containers))
	for _, cs := range p.Spec.Containers {
		specByName[cs.Name] = cs
	}
	containerDetails := make([]ContainerDetail, 0, len(p.Status.ContainerStatuses))
	for _, cs := range p.Status.ContainerStatuses {
		state := ContainerState{}
		if cs.State.Running != nil {
			state.Running = &ContainerStateRunning{StartedAt: cs.State.Running.StartedAt}
		} else if cs.State.Waiting != nil {
			state.Waiting = &ContainerStateWaiting{Reason: cs.State.Waiting.Reason, Message: cs.State.Waiting.Message}
		} else if cs.State.Terminated != nil {
			state.Terminated = &ContainerStateTerminated{
				ExitCode: cs.State.Terminated.ExitCode, Reason: cs.State.Terminated.Reason,
				Message: cs.State.Terminated.Message, FinishedAt: cs.State.Terminated.FinishedAt,
			}
		}
		image := cs.Image
		if spec, ok := specByName[cs.Name]; ok && image == "" {
			image = spec.Image
		}
		containerDetails = append(containerDetails, ContainerDetail{
			Name: cs.Name, Image: image, Ready: cs.Ready, RestartCount: cs.RestartCount, State: state,
		})
	}
	// Fallback: if no containerStatuses, use spec containers
	if len(containerDetails) == 0 {
		for _, cs := range p.Spec.Containers {
			containerDetails = append(containerDetails, ContainerDetail{Name: cs.Name, Image: cs.Image})
		}
	}
	conditions := make([]ResourceCondition, 0, len(p.Status.Conditions))
	for _, cond := range p.Status.Conditions {
		conditions = append(conditions, ResourceCondition{Type: cond.Type, Status: cond.Status, Reason: cond.Reason, Message: cond.Message})
	}
	return &PodDetail{
		Name: p.Metadata.Name, Namespace: p.Metadata.Namespace,
		Phase: p.Status.Phase, NodeName: p.Spec.NodeName,
		Labels: p.Metadata.Labels, Containers: containerDetails,
		Conditions: conditions, CreatedAt: p.Metadata.CreationTimestamp,
	}, nil
}

// GetService returns full detail for a single service including endpoint IPs.
func (c *Client) GetService(ctx context.Context, namespace, name string) (*ServiceDetail, error) {
	var s k8sServiceDetailItem
	if err := c.get(ctx, "/api/v1/namespaces/"+namespace+"/services/"+name, &s); err != nil {
		return nil, err
	}
	ports := make([]PortStub, 0, len(s.Spec.Ports))
	for _, p := range s.Spec.Ports {
		ports = append(ports, PortStub{Port: p.Port, Protocol: p.Protocol, NodePort: p.NodePort})
	}
	externalIPs := s.Spec.ExternalIPs
	if externalIPs == nil {
		externalIPs = []string{}
	}
	lbIPs := make([]string, 0, len(s.Status.LoadBalancer.Ingress))
	for _, ingress := range s.Status.LoadBalancer.Ingress {
		if ingress.IP != "" {
			lbIPs = append(lbIPs, ingress.IP)
		} else if ingress.Hostname != "" {
			lbIPs = append(lbIPs, ingress.Hostname)
		}
	}
	slog.Debug("kubernetes service detail", "name", name, "type", s.Spec.Type,
		"clusterIP", s.Spec.ClusterIP, "externalIPs", s.Spec.ExternalIPs, "lbIngress", lbIPs)
	// Fetch endpoints (best-effort; ignore error if not found)
	endpoints := []string{}
	var ep k8sEndpoints
	if err := c.get(ctx, "/api/v1/namespaces/"+namespace+"/endpoints/"+name, &ep); err == nil {
		for _, subset := range ep.Subsets {
			for _, addr := range subset.Addresses {
				endpoints = append(endpoints, addr.IP)
			}
		}
	}
	return &ServiceDetail{
		Name: s.Metadata.Name, Namespace: s.Metadata.Namespace,
		Type: s.Spec.Type, ClusterIP: s.Spec.ClusterIP,
		ExternalIPs: externalIPs, LoadBalancerIPs: lbIPs,
		Selector: s.Spec.Selector, Ports: ports, Endpoints: endpoints,
		CreatedAt: s.Metadata.CreationTimestamp,
	}, nil
}

// ScaleDeployment sets the replica count for a deployment.
func (c *Client) ScaleDeployment(ctx context.Context, namespace, name string, replicas int) error {
	body := fmt.Sprintf(`{"spec":{"replicas":%d}}`, replicas)
	url := c.address + "/apis/apps/v1/namespaces/" + namespace + "/deployments/" + name + "/scale"
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/strategic-merge-patch+json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("kubernetes: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("kubernetes: scale %s/%s: %d: %s", namespace, name, resp.StatusCode, b)
	}
	return nil
}

// StreamPodLogs opens a streaming connection to the pod log endpoint.
// The caller must close the returned ReadCloser when done.
func (c *Client) StreamPodLogs(ctx context.Context, namespace, podName, container string, follow bool) (io.ReadCloser, error) {
	followStr := "false"
	if follow {
		followStr = "true"
	}
	path := fmt.Sprintf("/api/v1/namespaces/%s/pods/%s/log?container=%s&follow=%s&timestamps=false",
		namespace, podName, container, followStr)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.address+path, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	// No timeout for streaming — context cancellation handles cleanup.
	streamTransport := &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}} //nolint:gosec
	streamClient := &http.Client{Transport: streamTransport}
	resp, err := streamClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("kubernetes: %w", err)
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("kubernetes: logs %s/%s: %d: %s", namespace, podName, resp.StatusCode, b)
	}
	return resp.Body, nil
}

// ── Conversion helpers ────────────────────────────────────────────────────────

func toNodeStub(n k8sNodeItem) NodeStub {
	status := "NotReady"
	for _, c := range n.Status.Conditions {
		if c.Type == "Ready" && c.Status == "True" {
			status = "Ready"
			break
		}
	}
	roles := nodeRoles(n.Metadata.Labels)
	return NodeStub{
		Name:    n.Metadata.Name,
		Status:  status,
		Roles:   roles,
		Version: n.Status.NodeInfo.KubeletVersion,
		Age:     n.Metadata.CreationTimestamp,
	}
}

func nodeRoles(labels map[string]string) []string {
	var roles []string
	for k := range labels {
		if strings.HasPrefix(k, "node-role.kubernetes.io/") {
			role := strings.TrimPrefix(k, "node-role.kubernetes.io/")
			if role != "" {
				roles = append(roles, role)
			}
		}
	}
	if len(roles) == 0 {
		roles = []string{"worker"}
	}
	return roles
}

func toPodStub(p k8sPodItem) PodStub {
	var restarts int
	var readyCount, totalCount int
	for _, cs := range p.Status.ContainerStatuses {
		restarts += cs.RestartCount
		totalCount++
		if cs.Ready {
			readyCount++
		}
	}
	containers := make([]string, 0, len(p.Spec.Containers))
	for _, c := range p.Spec.Containers {
		containers = append(containers, c.Name)
	}
	if len(containers) == 0 && totalCount > 0 {
		for _, cs := range p.Status.ContainerStatuses {
			containers = append(containers, cs.Name)
		}
	}
	return PodStub{
		Name:       p.Metadata.Name,
		Namespace:  p.Metadata.Namespace,
		Phase:      p.Status.Phase,
		Ready:      fmt.Sprintf("%d/%d", readyCount, totalCount),
		Restarts:   restarts,
		NodeName:   p.Spec.NodeName,
		Containers: containers,
		CreatedAt:  p.Metadata.CreationTimestamp,
	}
}

func toDeploymentStub(d k8sDeploymentItem) DeploymentStub {
	return DeploymentStub{
		Name:        d.Metadata.Name,
		Namespace:   d.Metadata.Namespace,
		Desired:     d.Spec.Replicas,
		Ready:       d.Status.ReadyReplicas,
		UpToDate:    d.Status.UpdatedReplicas,
		Available:   d.Status.AvailableReplicas,
		Unavailable: d.Status.UnavailableReplicas,
		CreatedAt:   d.Metadata.CreationTimestamp,
	}
}

func toServiceStub(s k8sServiceItem) ServiceStub {
	ports := make([]PortStub, 0, len(s.Spec.Ports))
	for _, p := range s.Spec.Ports {
		ports = append(ports, PortStub{Port: p.Port, Protocol: p.Protocol, NodePort: p.NodePort})
	}
	return ServiceStub{
		Name:      s.Metadata.Name,
		Namespace: s.Metadata.Namespace,
		Type:      s.Spec.Type,
		ClusterIP: s.Spec.ClusterIP,
		Ports:     ports,
		CreatedAt: s.Metadata.CreationTimestamp,
	}
}
