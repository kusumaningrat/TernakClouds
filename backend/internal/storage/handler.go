package storage

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /storage/provider
func (h *Handler) GetProvider(c *gin.Context) {
	envID := contextEnvironmentID(c)
	info, err := h.svc.GetProviderInfo(c.Request.Context(), envID)
	if err != nil {
		respondStorageErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, info)
}

// GET /storage/buckets
func (h *Handler) ListBuckets(c *gin.Context) {
	envID := contextEnvironmentID(c)
	buckets, err := h.svc.ListBuckets(c.Request.Context(), envID)
	if err != nil {
		respondStorageErr(c, err)
		return
	}
	pkg.RespondOK(c, http.StatusOK, buckets)
}

// POST /storage/buckets
func (h *Handler) CreateBucket(c *gin.Context) {
	envID := contextEnvironmentID(c)

	var input struct {
		Name   string `json:"name"   binding:"required"`
		Region string `json:"region"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "name is required")
		return
	}

	if err := h.svc.CreateBucket(c.Request.Context(), envID, input.Name, input.Region); err != nil {
		respondStorageErr(c, err)
		return
	}
	pkg.RespondMessage(c, http.StatusCreated, "bucket created")
}

// DELETE /storage/buckets/:name
func (h *Handler) DeleteBucket(c *gin.Context) {
	envID := contextEnvironmentID(c)
	name := c.Param("name")

	if err := h.svc.DeleteBucket(c.Request.Context(), envID, name); err != nil {
		respondStorageErr(c, err)
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "bucket deleted")
}

func respondStorageErr(c *gin.Context, err error) {
	if errors.Is(err, ErrNoStorageProvider) {
		pkg.RespondErr(c, http.StatusServiceUnavailable, err.Error())
		return
	}
	pkg.RespondErr(c, http.StatusBadGateway, "Storage provider error: "+err.Error())
}

func contextEnvironmentID(c *gin.Context) uuid.UUID {
	val, _ := c.Get("environment_id")
	id, _ := val.(uuid.UUID)
	return id
}
