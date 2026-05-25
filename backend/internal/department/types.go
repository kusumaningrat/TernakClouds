package department

type CreateDepartmentInput struct {
	Name        string `json:"name"        binding:"required"`
	Slug        string `json:"slug"        binding:"required"`
	Description string `json:"description"`
}

type UpdateDepartmentInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}
