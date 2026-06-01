package environment

import (
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(workspaceID uuid.UUID, input CreateEnvironmentInput) (*Environment, error) {
	slug := slugify(input.Name)
	env := &Environment{
		WorkspaceID: workspaceID,
		Name:        input.Name,
		Slug:        slug,
		Description: input.Description,
	}
	if err := s.repo.Create(env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *Service) SeedDefaults(workspaceID uuid.UUID) error {
	defaults := []struct {
		name  string
		order int
	}{
		{"dev", 1},
		{"staging", 2},
		{"production", 3},
	}
	for _, d := range defaults {
		env := &Environment{
			WorkspaceID: workspaceID,
			Name:        d.name,
			Slug:        d.name,
			Order:       d.order,
		}
		_ = s.repo.Create(env) // best-effort; ignore duplicate slug errors
	}
	return nil
}

func (s *Service) List(workspaceID uuid.UUID) ([]Environment, error) {
	return s.repo.ListByWorkspace(workspaceID)
}

func (s *Service) Get(workspaceID uuid.UUID, slug string) (*Environment, error) {
	return s.repo.FindBySlug(workspaceID, slug)
}

func (s *Service) Update(workspaceID uuid.UUID, slug string, input UpdateEnvironmentInput) (*Environment, error) {
	env, err := s.repo.FindBySlug(workspaceID, slug)
	if err != nil {
		return nil, err
	}
	if input.Name != "" {
		env.Name = input.Name
	}
	if input.Description != "" {
		env.Description = input.Description
	}
	if err := s.repo.Update(env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *Service) Delete(workspaceID uuid.UUID, slug string) error {
	env, err := s.repo.FindBySlug(workspaceID, slug)
	if err != nil {
		return err
	}
	return s.repo.Delete(env.ID)
}

func slugify(name string) string {
	s := strings.ToLower(name)
	s = strings.ReplaceAll(s, " ", "-")
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			b.WriteRune(r)
		}
	}
	return strings.Trim(b.String(), "-")
}
