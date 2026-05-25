package nomad

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /workspaces/:slug/environments/:envSlug/nomad/nodes
func (h *Handler) ListNodes(c *gin.Context) {
	envID := contextEnvironmentID(c)

	nodes, err := h.svc.ListNodes(c.Request.Context(), envID)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, nodes)
}

// GET /workspaces/:slug/environments/:envSlug/nomad/namespaces
func (h *Handler) ListNamespaces(c *gin.Context) {
	envID := contextEnvironmentID(c)

	ns, err := h.svc.ListNamespaces(c.Request.Context(), envID)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, ns)
}

// GET /workspaces/:slug/environments/:envSlug/nomad/jobs?namespace=<ns>
// namespace query param defaults to "default" when omitted.
func (h *Handler) ListJobs(c *gin.Context) {
	envID := contextEnvironmentID(c)
	namespace := c.DefaultQuery("namespace", "default")

	jobs, err := h.svc.ListJobs(c.Request.Context(), envID, namespace)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, jobs)
}

// GET .../nomad/jobs/:jobID?namespace=default
func (h *Handler) GetJob(c *gin.Context) {
	envID := contextEnvironmentID(c)
	jobID := c.Param("jobID")
	namespace := c.DefaultQuery("namespace", "default")

	job, err := h.svc.GetJob(c.Request.Context(), envID, jobID, namespace)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, job)
}

// POST .../nomad/jobs/:jobID/stop?namespace=default&purge=false
func (h *Handler) StopJob(c *gin.Context) {
	envID := contextEnvironmentID(c)
	jobID := c.Param("jobID")
	namespace := c.DefaultQuery("namespace", "default")
	purge := c.DefaultQuery("purge", "false") == "true"

	result, err := h.svc.StopJob(c.Request.Context(), envID, jobID, namespace, purge)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, result)
}

// POST .../nomad/jobs/:jobID/start?namespace=default
func (h *Handler) StartJob(c *gin.Context) {
	envID := contextEnvironmentID(c)
	jobID := c.Param("jobID")
	namespace := c.DefaultQuery("namespace", "default")

	result, err := h.svc.StartJob(c.Request.Context(), envID, jobID, namespace)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, result)
}

// GET .../nomad/jobs/:jobID/allocations?namespace=default
func (h *Handler) ListAllocations(c *gin.Context) {
	envID := contextEnvironmentID(c)
	jobID := c.Param("jobID")
	namespace := c.DefaultQuery("namespace", "default")

	allocs, err := h.svc.ListAllocations(c.Request.Context(), envID, jobID, namespace)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, allocs)
}

// GET .../nomad/allocations/:allocID/logs?task=<name>&type=stdout&follow=true&origin=start
//
// Streams log output as Server-Sent Events (text/event-stream).
//
//   - origin: "start" (default) replays existing logs then tails; "end" tails only.
//   - follow: "true" (default) keeps stream open; "false" dumps current logs and closes.
//   - type:   "stdout" (default) or "stderr".
//
// SSE event names:
//
//	"connected" — emitted immediately when the channel is ready (data: {})
//	"log"       — one decoded log line per event
//	"error"     — emitted before the stream closes on a non-EOF error
func (h *Handler) StreamLogs(c *gin.Context) {
	envID := contextEnvironmentID(c)
	allocID := c.Param("allocID")
	task := c.Query("task")
	logType := c.DefaultQuery("type", "stdout")
	follow := c.DefaultQuery("follow", "true") == "true"
	origin := c.DefaultQuery("origin", "start")

	if task == "" {
		pkg.RespondErr(c, http.StatusBadRequest, "task query param is required")
		return
	}

	reader, err := h.svc.LogStream(c.Request.Context(), envID, allocID, task, logType, follow, origin)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	defer reader.Close()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		pkg.RespondErr(c, http.StatusInternalServerError, "streaming not supported")
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)

	// Send a "connected" event immediately so the browser leaves "Connecting…"
	// before we block waiting for the first Nomad frame.
	fmt.Fprintf(c.Writer, "event: connected\ndata: {}\n\n")
	flusher.Flush()

	ctx := c.Request.Context()
	decoder := json.NewDecoder(reader)

	for {
		// Stop if the browser disconnected.
		select {
		case <-ctx.Done():
			return
		default:
		}

		var frame LogFrame
		if err := decoder.Decode(&frame); err != nil {
			// Context cancelled = client disconnected; not an error worth logging.
			if ctx.Err() != nil || errors.Is(err, io.EOF) {
				return
			}
			slog.Error("nomad log stream error", "alloc", allocID, "task", task, "err", err)
			fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", err.Error())
			flusher.Flush()
			return
		}

		if frame.Data == "" {
			continue // heartbeat frame — nothing to emit
		}

		data, err := base64.StdEncoding.DecodeString(frame.Data)
		if err != nil {
			slog.Error("nomad log base64 error", "alloc", allocID, "err", err)
			return
		}

		// Emit one SSE event per log line for clean frontend consumption.
		for _, line := range bytes.Split(data, []byte("\n")) {
			if len(line) > 0 {
				fmt.Fprintf(c.Writer, "event: log\ndata: %s\n\n", line)
			}
		}
		flusher.Flush()
	}
}

// GET .../nomad/jobs/:jobID/evaluations?namespace=default
func (h *Handler) ListEvaluations(c *gin.Context) {
	envID := contextEnvironmentID(c)
	jobID := c.Param("jobID")
	namespace := c.DefaultQuery("namespace", "default")

	evals, err := h.svc.ListEvaluations(c.Request.Context(), envID, jobID, namespace)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, evals)
}

// GET .../nomad/jobs/:jobID/deployments?namespace=default
func (h *Handler) ListDeployments(c *gin.Context) {
	envID := contextEnvironmentID(c)
	jobID := c.Param("jobID")
	namespace := c.DefaultQuery("namespace", "default")

	deployments, err := h.svc.ListDeployments(c.Request.Context(), envID, jobID, namespace)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, deployments)
}

// GET .../nomad/allocations/:allocID
func (h *Handler) GetAllocation(c *gin.Context) {
	envID := contextEnvironmentID(c)
	allocID := c.Param("allocID")

	alloc, err := h.svc.GetAllocation(c.Request.Context(), envID, allocID)
	if err != nil {
		respondNomadErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, alloc)
}

func respondNomadErr(c *gin.Context, err error) {
	if errors.Is(err, ErrNoNomadProvider) {
		pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	pkg.RespondErr(c, http.StatusBadGateway, "nomad error: "+err.Error())
}

func contextEnvironmentID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("environment_id")
	id, _ := val.(uuid.UUID)
	return id
}
