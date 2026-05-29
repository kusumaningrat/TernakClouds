package department

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/pkg"
)

type DepartmentHandler struct{ service *DepartmentService }

func NewDepartmentHandler(service *DepartmentService) *DepartmentHandler {
	return &DepartmentHandler{service: service}
}

// POST /api/v1/departments
func (h *DepartmentHandler) Create(c *gin.Context) {
	var input CreateDepartmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	dept, err := h.service.Create(input)
	if errors.Is(err, ErrSlugTaken) {
		pkg.RespondErr(c, http.StatusConflict, "Department name is already in use. Please choose a different name.")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to create department")
		return
	}

	pkg.RespondOK(c, http.StatusCreated, dept)
}

// GET /api/v1/departments
func (h *DepartmentHandler) List(c *gin.Context) {
	page, limit := pkg.GetPagination(c)

	depts, total, err := h.service.List(page, limit)
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to fetch departments")
		return
	}

	pkg.RespondOK(c, http.StatusOK, gin.H{
		"items": depts,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GET /api/v1/departments/:id
func (h *DepartmentHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid department id")
		return
	}

	dept, err := h.service.Get(id)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "Department not found.")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to fetch department")
		return
	}

	pkg.RespondOK(c, http.StatusOK, dept)
}

// PUT /api/v1/departments/:id
func (h *DepartmentHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid department id")
		return
	}

	var input UpdateDepartmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "Invalid request. Please check your input.")
		return
	}

	dept, err := h.service.Update(id, input)
	if errors.Is(err, ErrNotFound) {
		pkg.RespondErr(c, http.StatusNotFound, "Department not found.")
		return
	}
	if err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to update department")
		return
	}

	pkg.RespondOK(c, http.StatusOK, dept)
}

// DELETE /api/v1/departments/:id
func (h *DepartmentHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		pkg.RespondErr(c, http.StatusBadRequest, "invalid department id")
		return
	}

	if err := h.service.Delete(id); err != nil {
		pkg.RespondErr(c, http.StatusInternalServerError, "failed to delete department")
		return
	}

	pkg.RespondMessage(c, http.StatusOK, "department deleted")
}
