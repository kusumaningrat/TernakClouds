package accessrequest

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/middleware"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// POST /api/v1/access-requests
func (h *Handler) Create(c *gin.Context) {
	var input CreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	userID := middleware.GetUserID(c)
	ar, err := h.svc.Create(userID, input)
	if errors.Is(err, ErrAlreadyMember) {
		pkg.RespondErr(c, http.StatusConflict, "you are already a member of this workspace")
		return
	}
	if errors.Is(err, ErrDuplicateRequest) {
		pkg.RespondErr(c, http.StatusConflict, "a pending request already exists for this workspace")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create access request")
		return
	}

	pkg.RespondOK(c, http.StatusCreated, ar)
}

// GET /api/v1/access-requests/mine
func (h *Handler) ListMine(c *gin.Context) {
	userID := middleware.GetUserID(c)
	items, err := h.svc.ListMine(userID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list access requests")
		return
	}
	pkg.RespondOK(c, http.StatusOK, items)
}

// GET /api/v1/access-requests  (admin/manager)
func (h *Handler) ListPending(c *gin.Context) {
	items, err := h.svc.ListPending()
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list pending requests")
		return
	}
	pkg.RespondOK(c, http.StatusOK, items)
}

// PUT /api/v1/access-requests/:id/approve  (admin/manager)
func (h *Handler) Approve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid request id")
		return
	}

	var input ApproveInput
	_ = c.ShouldBindJSON(&input)

	reviewerID := middleware.GetUserID(c)
	if err := h.svc.Approve(reviewerID, id, input.Role); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "access request not found")
			return
		}
		if errors.Is(err, ErrNotPending) {
			pkg.RespondErr(c, http.StatusConflict, "request is no longer pending")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to approve request")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "request approved")
}

// PUT /api/v1/access-requests/:id/deny  (admin/manager)
func (h *Handler) Deny(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid request id")
		return
	}

	reviewerID := middleware.GetUserID(c)
	if err := h.svc.Deny(reviewerID, id); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "access request not found")
			return
		}
		if errors.Is(err, ErrNotPending) {
			pkg.RespondErr(c, http.StatusConflict, "request is no longer pending")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to deny request")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "request denied")
}
