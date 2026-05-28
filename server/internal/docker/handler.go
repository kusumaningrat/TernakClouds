package docker

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

// GET /workspaces/:slug/environments/:envSlug/docker/containers
func (h *Handler) ListContainers(c *gin.Context) {
	containers, err := h.svc.ListContainers(c.Request.Context(), contextEnvironmentID(c))
	if err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, containers)
}

// GET /workspaces/:slug/environments/:envSlug/docker/containers/:id
func (h *Handler) GetContainer(c *gin.Context) {
	id := c.Param("id")
	detail, err := h.svc.GetContainer(c.Request.Context(), contextEnvironmentID(c), id)
	if err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, detail)
}

// POST /workspaces/:slug/environments/:envSlug/docker/containers/:id/start
func (h *Handler) StartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.StartContainer(c.Request.Context(), contextEnvironmentID(c), id); err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "started")
}

// POST /workspaces/:slug/environments/:envSlug/docker/containers/:id/stop
func (h *Handler) StopContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.StopContainer(c.Request.Context(), contextEnvironmentID(c), id); err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "stopped")
}

// POST /workspaces/:slug/environments/:envSlug/docker/containers/:id/restart
func (h *Handler) RestartContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.RestartContainer(c.Request.Context(), contextEnvironmentID(c), id); err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "restarted")
}

// DELETE /workspaces/:slug/environments/:envSlug/docker/containers/:id
func (h *Handler) RemoveContainer(c *gin.Context) {
	id := c.Param("id")
	if err := h.svc.RemoveContainer(c.Request.Context(), contextEnvironmentID(c), id); err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "removed")
}

// GET /workspaces/:slug/environments/:envSlug/docker/containers/:id/logs?follow=true
//
// Streams container log output as Server-Sent Events (text/event-stream).
// Docker's multiplexed frame headers are stripped by the client before reaching here.
func (h *Handler) StreamContainerLogs(c *gin.Context) {
	id := c.Param("id")
	follow := c.DefaultQuery("follow", "true") == "true"

	reader, err := h.svc.StreamContainerLogs(c.Request.Context(), contextEnvironmentID(c), id, follow)
	if err != nil {
		respondDockerErr(c, err)
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
		if line := scanner.Text(); line != "" {
			fmt.Fprintf(c.Writer, "event: log\ndata: %s\n\n", line)
			flusher.Flush()
		}
	}

	if err := scanner.Err(); err != nil {
		if ctx.Err() != nil || errors.Is(err, io.EOF) {
			return
		}
		slog.Error("docker log stream error", "container", id, "err", err)
		fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
	}
}

// GET /workspaces/:slug/environments/:envSlug/docker/images
func (h *Handler) ListImages(c *gin.Context) {
	images, err := h.svc.ListImages(c.Request.Context(), contextEnvironmentID(c))
	if err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, images)
}

// GET /workspaces/:slug/environments/:envSlug/docker/networks
func (h *Handler) ListNetworks(c *gin.Context) {
	networks, err := h.svc.ListNetworks(c.Request.Context(), contextEnvironmentID(c))
	if err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, networks)
}

// GET /workspaces/:slug/environments/:envSlug/docker/volumes
func (h *Handler) ListVolumes(c *gin.Context) {
	volumes, err := h.svc.ListVolumes(c.Request.Context(), contextEnvironmentID(c))
	if err != nil {
		respondDockerErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, volumes)
}

func respondDockerErr(c *gin.Context, err error) {
	if errors.Is(err, ErrNoDockerProvider) {
		pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	slog.Error("docker upstream error", "path", c.Request.URL.Path, "err", err)
	pkg.RespondErr(c, http.StatusBadGateway, "docker error: "+err.Error())
}

func contextEnvironmentID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("environment_id")
	id, _ := val.(uuid.UUID)
	return id
}
