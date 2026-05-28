package blueprint

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kusumaningrat/idp-backend/pkg"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /api/v1/blueprints
func (h *Handler) List(c *gin.Context) {
	items, err := h.svc.List()
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to list blueprints")
		return
	}
	pkg.RespondOK(c, http.StatusOK, items)
}

// GET /api/v1/blueprints/:name
func (h *Handler) Get(c *gin.Context) {
	name := c.Param("name")
	b, err := h.svc.Get(name)
	if err != nil {
		if errors.Is(err, ErrBlueprintNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get blueprint")
		return
	}
	pkg.RespondOK(c, http.StatusOK, b)
}

// DELETE /api/v1/blueprints/:name
func (h *Handler) Delete(c *gin.Context) {
	name := c.Param("name")
	b, err := h.svc.Get(name)
	if err != nil {
		if errors.Is(err, ErrBlueprintNotFound) {
			pkg.RespondErr(c, http.StatusNotFound, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to get blueprint")
		return
	}
	if err := h.svc.Delete(b.ID); err != nil {
		if errors.Is(err, ErrSystemBlueprint) {
			pkg.RespondErr(c, http.StatusForbidden, err.Error())
			return
		}
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete blueprint")
		return
	}
	pkg.RespondMessage(c, http.StatusOK, "blueprint deleted")
}
