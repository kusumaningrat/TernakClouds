package docker

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client is a minimal Docker Engine REST API client.
// It communicates with a Docker daemon exposed over HTTP/HTTPS (TCP socket).
// TLS verification is skipped to support self-signed certificates common in
// self-hosted Docker deployments; production deployments should configure proper CA certs.
type Client struct {
	address string
	token   string
	http    *http.Client
}

func NewClient(address, token string) *Client {
	address = strings.TrimRight(address, "/")
	// Docker daemon TCP endpoints are plain HTTP. Users sometimes write tcp://
	// (which is the Docker CLI convention) but Go's net/http only understands
	// http:// and https://.
	address = strings.Replace(address, "tcp://", "http://", 1)

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
	}
	return &Client{
		address: address,
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
		return fmt.Errorf("docker: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker: %s %d: %s", path, resp.StatusCode, b)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// postJSON sends a POST with a JSON body and optionally decodes the response into out.
func (c *Client) postJSON(ctx context.Context, path string, body any, out any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.address+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("docker: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b2, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker: %s %d: %s", path, resp.StatusCode, b2)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

// ContainerRunConfig describes the desired state for a new managed container.
type ContainerRunConfig struct {
	Image         string
	Name          string
	ContainerPort int
	HostPort      int
	CPU           int      // millicores
	MemoryMB      int      // megabytes
	Env           []string // "KEY=VALUE"
	Labels        map[string]string
}

// CreateContainer creates a container and returns its full ID (not started yet).
func (c *Client) CreateContainer(ctx context.Context, cfg ContainerRunConfig) (string, error) {
	if cfg.ContainerPort <= 0 {
		cfg.HostPort = 0
	}

	labels := make(map[string]string, len(cfg.Labels)+1)
	for k, v := range cfg.Labels {
		labels[k] = v
	}
	labels["managed-by"] = "ternak-idp"

	env := cfg.Env
	if env == nil {
		env = []string{}
	}

	hostConfig := map[string]any{
		"NanoCpus":      int64(cfg.CPU) * 1_000_000,
		"Memory":        int64(cfg.MemoryMB) * 1024 * 1024,
		"RestartPolicy": map[string]any{"Name": "unless-stopped"},
	}

	if cfg.ContainerPort > 0 && cfg.HostPort > 0 {
		portKey := fmt.Sprintf("%d/tcp", cfg.ContainerPort)
		hostConfig["PortBindings"] = map[string]any{
			portKey: []map[string]string{{"HostPort": fmt.Sprintf("%d", cfg.HostPort)}},
		}
	}

	body := map[string]any{
		"Image":      cfg.Image,
		"Env":        env,
		"Labels":     labels,
		"HostConfig": hostConfig,
	}

	if cfg.ContainerPort > 0 {
		body["ExposedPorts"] = map[string]any{
			fmt.Sprintf("%d/tcp", cfg.ContainerPort): struct{}{},
		}
	}

	path := "/containers/create"
	if cfg.Name != "" {
		path += "?name=" + cfg.Name
	}
	var result struct {
		ID string `json:"Id"`
	}
	if err := c.postJSON(ctx, path, body, &result); err != nil {
		if isDockerConflict(err) {
			return "", ErrContainerNameConflict
		}
		return "", err
	}
	return result.ID, nil
}

func isDockerConflict(err error) bool {
	return err != nil && strings.Contains(err.Error(), " 409:")
}

// post sends a POST with no body. Docker action endpoints return 204 on success
// or 304 Not Modified when the container is already in the desired state.
func (c *Client) post(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.address+path, nil)
	if err != nil {
		return err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("docker: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode != 304 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker: %s %d: %s", path, resp.StatusCode, b)
	}
	return nil
}

func (c *Client) del(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.address+path, nil)
	if err != nil {
		return err
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("docker: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker: %s %d: %s", path, resp.StatusCode, b)
	}
	return nil
}

// ListContainers returns all containers (running and stopped).
func (c *Client) ListContainers(ctx context.Context) ([]ContainerStub, error) {
	var items []dockerContainerListItem
	if err := c.get(ctx, "/containers/json?all=1", &items); err != nil {
		return nil, err
	}
	stubs := make([]ContainerStub, 0, len(items))
	for _, item := range items {
		name := ""
		if len(item.Names) > 0 {
			name = strings.TrimPrefix(item.Names[0], "/")
		}
		ports := make([]PortBinding, 0, len(item.Ports))
		for _, p := range item.Ports {
			ports = append(ports, PortBinding{
				IP:          p.IP,
				PrivatePort: p.PrivatePort,
				PublicPort:  p.PublicPort,
				Type:        p.Type,
			})
		}
		labels := item.Labels
		if labels == nil {
			labels = map[string]string{}
		}
		idLen := len(item.ID)
		if idLen > 12 {
			idLen = 12
		}
		stubs = append(stubs, ContainerStub{
			ID:      item.ID[:idLen],
			Name:    name,
			Image:   item.Image,
			State:   item.State,
			Status:  item.Status,
			Created: item.Created,
			Ports:   ports,
			Labels:  labels,
		})
	}
	return stubs, nil
}

// GetContainer returns full detail for a single container.
func (c *Client) GetContainer(ctx context.Context, id string) (*ContainerDetail, error) {
	var raw dockerContainerInspect
	if err := c.get(ctx, "/containers/"+id+"/json", &raw); err != nil {
		return nil, err
	}

	networks := make([]ContainerNetwork, 0, len(raw.NetworkSettings.Networks))
	for name, n := range raw.NetworkSettings.Networks {
		networks = append(networks, ContainerNetwork{
			Name:      name,
			IPAddress: n.IPAddress,
			Gateway:   n.Gateway,
		})
	}

	ports := make([]BoundPort, 0, len(raw.HostConfig.PortBindings))
	for privatePort, bindings := range raw.HostConfig.PortBindings {
		for _, b := range bindings {
			ports = append(ports, BoundPort{
				PrivatePort: privatePort,
				HostIP:      b.HostIP,
				HostPort:    b.HostPort,
			})
		}
	}

	mounts := make([]ContainerMount, 0, len(raw.Mounts))
	for _, m := range raw.Mounts {
		mounts = append(mounts, ContainerMount{
			Type:        m.Type,
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        m.Mode,
		})
	}

	idLen := len(raw.ID)
	if idLen > 12 {
		idLen = 12
	}
	return &ContainerDetail{
		ID:      raw.ID[:idLen],
		Name:    strings.TrimPrefix(raw.Name, "/"),
		Image:   raw.Config.Image,
		ImageID: raw.Image,
		Created: raw.Created,
		State: ContainerState{
			Status:     raw.State.Status,
			Running:    raw.State.Running,
			Paused:     raw.State.Paused,
			Restarting: raw.State.Restarting,
			ExitCode:   raw.State.ExitCode,
			StartedAt:  raw.State.StartedAt,
			FinishedAt: raw.State.FinishedAt,
			Error:      raw.State.Error,
		},
		Config: ContainerConfig{
			Image:  raw.Config.Image,
			Cmd:    raw.Config.Cmd,
			Env:    raw.Config.Env,
			Labels: raw.Config.Labels,
		},
		Networks:      networks,
		Ports:         ports,
		Mounts:        mounts,
		RestartPolicy: raw.HostConfig.RestartPolicy.Name,
	}, nil
}

// StartContainer starts a stopped container.
func (c *Client) StartContainer(ctx context.Context, id string) error {
	return c.post(ctx, "/containers/"+id+"/start")
}

// StopContainer stops a running container.
func (c *Client) StopContainer(ctx context.Context, id string) error {
	return c.post(ctx, "/containers/"+id+"/stop")
}

// RestartContainer restarts a container.
func (c *Client) RestartContainer(ctx context.Context, id string) error {
	return c.post(ctx, "/containers/"+id+"/restart")
}

// RemoveContainer removes a container. The container must be stopped first.
func (c *Client) RemoveContainer(ctx context.Context, id string) error {
	return c.del(ctx, "/containers/"+id)
}

// StreamContainerLogs opens a streaming connection to the container log endpoint.
// Docker's multiplexed log frame headers (8 bytes each) are stripped so the returned
// ReadCloser emits plain-text log lines. Use bufio.Scanner to consume lines.
func (c *Client) StreamContainerLogs(ctx context.Context, id string, follow bool) (io.ReadCloser, error) {
	followStr := "false"
	if follow {
		followStr = "true"
	}
	path := fmt.Sprintf("/containers/%s/logs?stdout=true&stderr=true&follow=%s&timestamps=false", id, followStr)

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
		return nil, fmt.Errorf("docker: %w", err)
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("docker: logs %s: %d: %s", id, resp.StatusCode, b)
	}
	return &dockerLogFrameReader{r: resp.Body, closer: resp.Body}, nil
}

// ListImages returns all local Docker images.
func (c *Client) ListImages(ctx context.Context) ([]ImageStub, error) {
	var items []dockerImageListItem
	if err := c.get(ctx, "/images/json", &items); err != nil {
		return nil, err
	}
	stubs := make([]ImageStub, 0, len(items))
	for _, item := range items {
		tags := item.RepoTags
		if tags == nil {
			tags = []string{}
		}
		shortID := item.ID
		if len(shortID) > 7 && shortID[:7] == "sha256:" {
			end := len(shortID)
			if end > 19 {
				end = 19
			}
			shortID = shortID[7:end]
		}
		stubs = append(stubs, ImageStub{
			ID:      shortID,
			Tags:    tags,
			Size:    item.Size,
			Created: item.Created,
		})
	}
	return stubs, nil
}

// ListNetworks returns all Docker networks.
func (c *Client) ListNetworks(ctx context.Context) ([]NetworkStub, error) {
	var items []dockerNetworkListItem
	if err := c.get(ctx, "/networks", &items); err != nil {
		return nil, err
	}
	stubs := make([]NetworkStub, 0, len(items))
	for _, item := range items {
		subnet := ""
		if len(item.IPAM.Config) > 0 {
			subnet = item.IPAM.Config[0].Subnet
		}
		idLen := len(item.ID)
		if idLen > 12 {
			idLen = 12
		}
		stubs = append(stubs, NetworkStub{
			ID:     item.ID[:idLen],
			Name:   item.Name,
			Driver: item.Driver,
			Scope:  item.Scope,
			Subnet: subnet,
		})
	}
	return stubs, nil
}

// ListVolumes returns all Docker volumes.
func (c *Client) ListVolumes(ctx context.Context) ([]VolumeStub, error) {
	var resp dockerVolumeListResponse
	if err := c.get(ctx, "/volumes", &resp); err != nil {
		return nil, err
	}
	stubs := make([]VolumeStub, 0, len(resp.Volumes))
	for _, v := range resp.Volumes {
		stubs = append(stubs, VolumeStub{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			Scope:      v.Scope,
		})
	}
	return stubs, nil
}

// ── dockerLogFrameReader ──────────────────────────────────────────────────────

// dockerLogFrameReader strips Docker's 8-byte multiplexed log frame headers and
// exposes the payload as a plain byte stream. Each frame has the format:
//
//	[stream_type: 1 byte][padding: 3 bytes][frame_size: 4 bytes big-endian][data: frame_size bytes]
type dockerLogFrameReader struct {
	r      io.Reader
	closer io.Closer
	buf    bytes.Buffer
}

func (r *dockerLogFrameReader) Read(p []byte) (int, error) {
	if r.buf.Len() > 0 {
		return r.buf.Read(p)
	}
	var header [8]byte
	if _, err := io.ReadFull(r.r, header[:]); err != nil {
		return 0, err
	}
	size := binary.BigEndian.Uint32(header[4:8])
	if size == 0 {
		return r.Read(p)
	}
	frame := make([]byte, size)
	if _, err := io.ReadFull(r.r, frame); err != nil {
		return 0, err
	}
	r.buf.Write(frame)
	return r.buf.Read(p)
}

func (r *dockerLogFrameReader) Close() error {
	return r.closer.Close()
}
