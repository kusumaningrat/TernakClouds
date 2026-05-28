package blueprint

import "strings"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List() ([]BlueprintResponse, error) {
	items, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	out := make([]BlueprintResponse, len(items))
	for i, b := range items {
		out[i] = toResponse(b)
	}
	return out, nil
}

func (s *Service) Get(name string) (*BlueprintResponse, error) {
	b, err := s.repo.FindByName(name)
	if err != nil {
		return nil, err
	}
	r := toResponse(*b)
	return &r, nil
}

func (s *Service) GetByID(id string) (*BlueprintResponse, error) {
	b, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	r := toResponse(*b)
	return &r, nil
}

func (s *Service) Delete(id string) error {
	b, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	if b.IsSystem {
		return ErrSystemBlueprint
	}
	return s.repo.Delete(id)
}

func toResponse(b Blueprint) BlueprintResponse {
	runtimes := strings.Split(b.SupportedRuntimes, ",")
	clean := make([]string, 0, len(runtimes))
	for _, r := range runtimes {
		if t := strings.TrimSpace(r); t != "" {
			clean = append(clean, t)
		}
	}
	return BlueprintResponse{
		ID:                b.ID.String(),
		Name:              b.Name,
		DisplayName:       b.DisplayName,
		Description:       b.Description,
		Category:          b.Category,
		Version:           b.Version,
		SupportedRuntimes: clean,
		IsPublic:          b.IsPublic,
		IsSystem:          b.IsSystem,
		Icon:              b.Icon,
		CreatedAt:         b.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
