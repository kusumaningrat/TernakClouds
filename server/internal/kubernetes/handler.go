package kubernetes

import (
	"bufio"
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

// GET /workspaces/:slug/environments/:envSlug/kubernetes/nodes
func (h *Handler) ListNodes(c *gin.Context) {
	nodes, err := h.svc.ListNodes(c.Request.Context(), contextEnvironmentID(c))
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, nodes)
}

// GET /workspaces/:slug/environments/:envSlug/kubernetes/namespaces
func (h *Handler) ListNamespaces(c *gin.Context) {
	ns, err := h.svc.ListNamespaces(c.Request.Context(), contextEnvironmentID(c))
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, ns)
}

// GET .../kubernetes/pods?namespace=default&labelSelector=...
func (h *Handler) ListPods(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")
	labelSelector := c.Query("labelSelector")
	var pods []PodStub
	var err error
	if labelSelector != "" {
		pods, err = h.svc.ListPodsBySelector(c.Request.Context(), contextEnvironmentID(c), namespace, labelSelector)
	} else {
		pods, err = h.svc.ListPods(c.Request.Context(), contextEnvironmentID(c), namespace)
	}
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, pods)
}

// GET .../kubernetes/deployments?namespace=default
func (h *Handler) ListDeployments(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")
	deployments, err := h.svc.ListDeployments(c.Request.Context(), contextEnvironmentID(c), namespace)
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, deployments)
}

// GET .../kubernetes/services?namespace=default
func (h *Handler) ListServices(c *gin.Context) {
	namespace := c.DefaultQuery("namespace", "default")
	services, err := h.svc.ListServices(c.Request.Context(), contextEnvironmentID(c), namespace)
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, services)
}

// GET .../kubernetes/deployments/:namespace/:name
func (h *Handler) GetDeployment(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")
	detail, err := h.svc.GetDeployment(c.Request.Context(), contextEnvironmentID(c), namespace, name)
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, detail)
}

// GET .../kubernetes/pods/:namespace/:name
func (h *Handler) GetPod(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")
	detail, err := h.svc.GetPod(c.Request.Context(), contextEnvironmentID(c), namespace, name)
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, detail)
}

// GET .../kubernetes/services/:namespace/:name
func (h *Handler) GetService(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")
	detail, err := h.svc.GetService(c.Request.Context(), contextEnvironmentID(c), namespace, name)
	if err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, detail)
}

// PATCH .../kubernetes/deployments/:namespace/:name/scale
func (h *Handler) ScaleDeployment(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")
	var input ScaleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.svc.ScaleDeployment(c.Request.Context(), contextEnvironmentID(c), namespace, name, *input.Replicas); err != nil {
		respondK8sErr(c, err)
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "scaled")
}

// GET .../kubernetes/pods/:namespace/:podName/logs?container=<name>&follow=true
//
// Streams pod log output as Server-Sent Events (text/event-stream).
// K8s returns plain-text log lines (unlike Nomad's JSON frames), so each line
// is emitted directly as an SSE "log" event.
func (h *Handler) StreamPodLogs(c *gin.Context) {
	podName := c.Param("name")
	namespace := c.Param("namespace")
	container := c.Query("container")
	follow := c.DefaultQuery("follow", "true") == "true"

	if container == "" {
		pkg.RespondErr(c, http.StatusBadRequest, "container query param is required")
		return
	}

	reader, err := h.svc.StreamPodLogs(c.Request.Context(), contextEnvironmentID(c), namespace, podName, container, follow)
	if err != nil {
		respondK8sErr(c, err)
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

	fmt.Fprintf(c.Writer, "event: connected\ndata: {}\n\n")
	flusher.Flush()

	ctx := c.Request.Context()
	scanner := bufio.NewScanner(reader)

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()
		if line != "" {
			fmt.Fprintf(c.Writer, "event: log\ndata: %s\n\n", line)
			flusher.Flush()
		}
	}

	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil || errors.Is(err, io.EOF) {
			return
		}
		slog.Error("kubernetes log stream error", "pod", podName, "container", container, "err", err)
		fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
	}
}

func respondK8sErr(c *gin.Context, err error) {
	if errors.Is(err, ErrNoK8sProvider) {
		pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	slog.Error("kubernetes upstream error", "path", c.Request.URL.Path, "err", err)
	pkg.RespondErr(c, http.StatusBadGateway, "kubernetes error: "+err.Error())
}

func contextEnvironmentID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("environment_id")
	id, _ := val.(uuid.UUID)
	return id
}
