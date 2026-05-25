package workspace

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/middleware"
	"github.com/kusumaningrat/idp-backend/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// POST /api/v1/workspaces
func (h *Handler) Create(c *gin.Context) {
	var input CreateWorkspaceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	callerID := middleware.GetUserID(c)
	w, err := h.svc.Create(callerID, input)
	if errors.Is(err, ErrSlugTaken) {
		pkg.RespondErr(c, http.StatusConflict, "workspace slug already taken")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create workspace")
		return
	}

	pkg.RespondOK(c, http.StatusCreated, toWorkspaceResponse(w))
}

// GET /api/v1/workspaces
func (h *Handler) List(c *gin.Context) {
	callerID := middleware.GetUserID(c)
	workspaces, err := h.svc.List(callerID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list workspaces")
		return
	}

	resp := make([]WorkspaceResponse, len(workspaces))
	for i, w := range workspaces {
		resp[i] = toWorkspaceResponse(&w)
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

// GET /api/v1/workspaces/directory — lightweight list of all workspaces for the access request picker.
func (h *Handler) Directory(c *gin.Context) {
	entries, err := h.svc.Directory()
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list workspaces")
		return
	}
	pkg.RespondOK(c, http.StatusOK, entries)
}

// GET /api/v1/workspaces/mine — always returns only the caller's member workspaces.
func (h *Handler) Mine(c *gin.Context) {
	callerID := middleware.GetUserID(c)
	workspaces, err := h.svc.ListMine(callerID)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list workspaces")
		return
	}

	resp := make([]WorkspaceResponse, len(workspaces))
	for i, w := range workspaces {
		resp[i] = toWorkspaceResponse(&w)
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

// GET /api/v1/workspaces/:slug
func (h *Handler) Get(c *gin.Context) {
	slug := c.Param("slug")
	callerID := middleware.GetUserID(c)

	w, err := h.svc.Get(callerID, slug)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "workspace not found")
		return
	}
	if errors.Is(err, ErrForbidden) {
		pkg.RespondErr(c, http.StatusForbidden, "access denied")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get workspace")
		return
	}

	pkg.RespondOK(c, http.StatusOK, toWorkspaceResponse(w))
}

// PUT /api/v1/workspaces/:slug
func (h *Handler) Update(c *gin.Context) {
	slug := c.Param("slug")
	callerID := middleware.GetUserID(c)

	var input UpdateWorkspaceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	w, err := h.svc.Update(callerID, slug, input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "workspace not found")
		return
	}
	if errors.Is(err, ErrForbidden) {
		pkg.RespondErr(c, http.StatusForbidden, "only owners or admins can update a workspace")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to update workspace")
		return
	}

	pkg.RespondOK(c, http.StatusOK, toWorkspaceResponse(w))
}

// DELETE /api/v1/workspaces/:slug
func (h *Handler) Delete(c *gin.Context) {
	slug := c.Param("slug")
	callerID := middleware.GetUserID(c)

	err := h.svc.Delete(callerID, slug)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "workspace not found")
		return
	}
	if errors.Is(err, ErrForbidden) {
		pkg.RespondErr(c, http.StatusForbidden, "only owners or admins can delete a workspace")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete workspace")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "workspace deleted")
}

// GET /api/v1/workspaces/:slug/members
func (h *Handler) ListMembers(c *gin.Context) {
	slug := c.Param("slug")
	callerID := middleware.GetUserID(c)

	members, err := h.svc.ListMembers(callerID, slug)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "workspace not found")
		return
	}
	if errors.Is(err, ErrForbidden) {
		pkg.RespondErr(c, http.StatusForbidden, "access denied")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list members")
		return
	}

	resp := make([]MemberResponse, len(members))
	for i := range members {
		resp[i] = toMemberResponse(&members[i])
	}
	pkg.RespondOK(c, http.StatusOK, resp)
}

// POST /api/v1/workspaces/:slug/members
func (h *Handler) AddMember(c *gin.Context) {
	slug := c.Param("slug")
	callerID := middleware.GetUserID(c)

	var input AddMemberInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, err.Error())
		return
	}

	targetID, err := uuid.Parse(input.UserID)
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid user_id")
		return
	}

	if err := h.svc.AddMember(callerID, slug, targetID); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "workspace not found")
			return
		}
		if errors.Is(err, ErrForbidden) {
			pkg.RespondErr(c, http.StatusForbidden, "only owners or admins can add members")
			return
		}
		if errors.Is(err, ErrAlreadyMember) {
			pkg.RespondErr(c, http.StatusConflict, "user is already a member")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to add member")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "member added")
}

// DELETE /api/v1/workspaces/:slug/members/:userId
func (h *Handler) RemoveMember(c *gin.Context) {
	slug := c.Param("slug")
	callerID := middleware.GetUserID(c)

	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := h.svc.RemoveMember(callerID, slug, targetID); err != nil {
		if errors.Is(err, ErrNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "workspace not found")
			return
		}
		if errors.Is(err, ErrForbidden) {
			pkg.RespondErr(c, http.StatusForbidden, "only owners or admins can remove members")
			return
		}
		if errors.Is(err, ErrMemberNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, "member not found")
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to remove member")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "member removed")
}

// -- response helpers --------------------------------------------------------

func toWorkspaceResponse(w *Workspace) WorkspaceResponse {
	return WorkspaceResponse{
		ID:          w.ID.String(),
		Name:        w.Name,
		Slug:        w.Slug,
		Description: w.Description,
		OwnerID:     w.OwnerID.String(),
		CreatedAt:   w.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

func toMemberResponse(m *WorkspaceMemberDetail) MemberResponse {
	return MemberResponse{
		WorkspaceID: m.WorkspaceID.String(),
		UserID:      m.UserID.String(),
		FirstName:   m.FirstName,
		LastName:    m.LastName,
		Role:        m.Role,
		JoinedAt:    m.JoinedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}
