package department

import (
	"errors"
	"strings"

	"github.com/google/uuid"
)

var (
	ErrNotFound  = errors.New("department not found")
	ErrSlugTaken = errors.New("slug already in use")
)

type DepartmentService struct {
	departmentRepo *DepartmentRepository
}

func NewDepartmentService(departmentRepo *DepartmentRepository) *DepartmentService {
	return &DepartmentService{departmentRepo: departmentRepo}
}

func (s *DepartmentService) Create(input CreateDepartmentInput) (*Department, error) {
	slug := input.Slug
	if slug == "" {
		slug = toSlug(input.Name)
	}

	existing, err := s.departmentRepo.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrSlugTaken
	}

	dept := &Department{Name: input.Name, Slug: slug, Description: input.Description}
	return dept, s.departmentRepo.Create(dept)
}

func (s *DepartmentService) FindBySlug(slug string) (*Department, error) {
	return s.departmentRepo.FindBySlug(slug)
}

// FindOrCreate looks up a department by name; creates it if it doesn't exist.
func (s *DepartmentService) FindOrCreate(name string) (*Department, error) {
	slug := toSlug(name)
	dept, err := s.departmentRepo.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	if dept != nil {
		return dept, nil
	}
	return s.Create(CreateDepartmentInput{Name: name, Slug: slug})
}

func (s *DepartmentService) Get(id uuid.UUID) (*Department, error) {
	dept, err := s.departmentRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if dept == nil {
		return nil, ErrNotFound
	}
	return dept, nil
}

func (s *DepartmentService) List(page, limit int) ([]Department, int64, error) {
	return s.departmentRepo.List(page, limit)
}

func (s *DepartmentService) Update(id uuid.UUID, input UpdateDepartmentInput) (*Department, error) {
	dept, err := s.departmentRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if dept == nil {
		return nil, ErrNotFound
	}
	if input.Name != "" {
		dept.Name = input.Name
	}
	if input.Description != "" {
		dept.Description = input.Description
	}
	return dept, s.departmentRepo.Update(dept)
}

func (s *DepartmentService) Delete(id uuid.UUID) error {
	return s.departmentRepo.Delete(id)
}

func toSlug(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	return strings.ReplaceAll(slug, " ", "-")
}
