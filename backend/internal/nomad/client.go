package nomad

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Client is a minimal Nomad HTTP API client.
// It authenticates using the X-Nomad-Token header.
type Client struct {
	address string
	token   string
	http    *http.Client
}

func NewClient(address, token string) *Client {
	return &Client{
		address: strings.TrimRight(address, "/"),
		token:   token,
		http:    &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.address+path, nil)
	if err != nil {
		return err
	}
	if c.token != "" {
		req.Header.Set("X-Nomad-Token", c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("nomad: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("nomad: %s %d: %s", path, resp.StatusCode, b)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// ListNodes returns all nodes registered in the cluster (worker discovery).
func (c *Client) ListNodes(ctx context.Context) ([]NodeStub, error) {
	var nodes []NodeStub
	return nodes, c.get(ctx, "/v1/nodes", &nodes)
}

// ListNamespaces returns all namespaces visible to the token.
func (c *Client) ListNamespaces(ctx context.Context) ([]Namespace, error) {
	var ns []Namespace
	return ns, c.get(ctx, "/v1/namespaces", &ns)
}

// ListJobs returns all jobs in the given namespace.
// Pass namespace="" to use the Nomad server default (usually "default").
func (c *Client) ListJobs(ctx context.Context, namespace string) ([]JobListStub, error) {
	path := "/v1/jobs"
	if namespace != "" {
		path += "?namespace=" + namespace
	}
	var jobs []JobListStub
	return jobs, c.get(ctx, path, &jobs)
}

// GetJob returns the full specification of a single job.
// The raw Nomad job object is returned as-is so callers receive every field.
func (c *Client) GetJob(ctx context.Context, jobID, namespace string) (map[string]any, error) {
	path := "/v1/job/" + jobID
	if namespace != "" {
		path += "?namespace=" + namespace
	}
	var job map[string]any
	return job, c.get(ctx, path, &job)
}

// StopJob deregisters a job.
// Set purge=true to fully erase the job definition from state.
func (c *Client) StopJob(ctx context.Context, jobID, namespace string, purge bool) (*JobActionResponse, error) {
	parts := []string{}
	if namespace != "" {
		parts = append(parts, "namespace="+namespace)
	}
	if purge {
		parts = append(parts, "purge=true")
	}
	path := "/v1/job/" + jobID
	if len(parts) > 0 {
		path += "?" + strings.Join(parts, "&")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, c.address+path, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("X-Nomad-Token", c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("nomad: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("nomad: stop %s: %d: %s", jobID, resp.StatusCode, b)
	}
	var out JobActionResponse
	return &out, json.NewDecoder(resp.Body).Decode(&out)
}

// ListAllocations returns all allocations for a job (across all versions).
func (c *Client) ListAllocations(ctx context.Context, jobID, namespace string) ([]AllocationStub, error) {
	path := "/v1/job/" + jobID + "/allocations"
	if namespace != "" {
		path += "?namespace=" + namespace
	}
	var allocs []AllocationStub
	return allocs, c.get(ctx, path, &allocs)
}

// LogStream opens a streaming connection to the Nomad log endpoint for an
// allocation task. The caller must close the returned ReadCloser when done.
//
// follow=true keeps the connection open for live tailing.
// origin is "start" or "end"; use "end" for tail behaviour.
func (c *Client) LogStream(ctx context.Context, allocID, task, logType string, follow bool, origin string) (io.ReadCloser, error) {
	params := url.Values{}
	params.Set("task", task)
	params.Set("type", logType)
	params.Set("follow", strconv.FormatBool(follow))
	params.Set("origin", origin)
	params.Set("offset", "0")

	path := fmt.Sprintf("/v1/client/fs/logs/%s?%s", allocID, params.Encode())

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.address+path, nil)
	if err != nil {
		return nil, err
	}
	if c.token != "" {
		req.Header.Set("X-Nomad-Token", c.token)
	}

	// Streaming needs no timeout — context cancellation handles cleanup.
	streamClient := &http.Client{}
	resp, err := streamClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("nomad: %w", err)
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("nomad: logs %s: %d: %s", allocID, resp.StatusCode, b)
	}
	return resp.Body, nil
}

// ListEvaluations returns all evaluations for a job.
func (c *Client) ListEvaluations(ctx context.Context, jobID, namespace string) ([]EvalStub, error) {
	path := "/v1/job/" + jobID + "/evaluations"
	if namespace != "" {
		path += "?namespace=" + namespace
	}
	var evals []EvalStub
	return evals, c.get(ctx, path, &evals)
}

// ListDeployments returns all deployments for a job (service type only).
func (c *Client) ListDeployments(ctx context.Context, jobID, namespace string) ([]DeploymentStub, error) {
	path := "/v1/job/" + jobID + "/deployments"
	if namespace != "" {
		path += "?namespace=" + namespace
	}
	var deployments []DeploymentStub
	return deployments, c.get(ctx, path, &deployments)
}

// GetAllocation returns the full allocation details including per-task event history.
func (c *Client) GetAllocation(ctx context.Context, allocID string) (*AllocationDetail, error) {
	var alloc AllocationDetail
	return &alloc, c.get(ctx, "/v1/allocation/"+allocID, &alloc)
}

// post is a generic helper for JSON POST requests to the Nomad API.
func (c *Client) post(ctx context.Context, path string, body any, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.address+path, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("X-Nomad-Token", c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("nomad: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("nomad: %s %d: %s", path, resp.StatusCode, b)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

// ParseHCL submits raw HCL to the Nomad parse endpoint and returns the
// canonical JSON job spec. This is required before submitting a new job.
func (c *Client) ParseHCL(ctx context.Context, hcl string) (map[string]any, error) {
	var spec map[string]any
	err := c.post(ctx, "/v1/jobs/parse",
		map[string]any{"JobHCL": hcl, "Canonicalize": true},
		&spec,
	)
	return spec, err
}

// SubmitJob registers a new (or updated) job from a parsed JSON spec.
// When hclSource is non-empty it is attached as a Submission (Nomad 1.6+) so
// that the Nomad UI's Definition tab displays the original HCL instead of JSON.
// Older Nomad versions ignore the Submission field without error.
func (c *Client) SubmitJob(ctx context.Context, jobSpec map[string]any, hclSource string) (*JobActionResponse, error) {
	body := map[string]any{"Job": jobSpec}
	if hclSource != "" {
		body["Submission"] = map[string]any{
			"Source": hclSource,
			"Format": "hcl2",
		}
	}
	var out JobActionResponse
	return &out, c.post(ctx, "/v1/jobs", body, &out)
}

// StartJob re-registers a stopped job by reading its current spec from Nomad,
// clearing the Stop flag, and re-submitting it.
func (c *Client) StartJob(ctx context.Context, jobID, namespace string) (*JobActionResponse, error) {
	spec, err := c.GetJob(ctx, jobID, namespace)
	if err != nil {
		return nil, fmt.Errorf("nomad: start: read spec: %w", err)
	}

	spec["Stop"] = false

	payload, err := json.Marshal(map[string]any{"Job": spec})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.address+"/v1/jobs", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("X-Nomad-Token", c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("nomad: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("nomad: start %s: %d: %s", jobID, resp.StatusCode, b)
	}
	var out JobActionResponse
	return &out, json.NewDecoder(resp.Body).Decode(&out)
}
