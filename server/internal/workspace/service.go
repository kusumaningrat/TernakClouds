package workspace

import (
	"errors"
	"strings"

	"github.com/google/uuid"
)

// EnvironmentSeeder is satisfied by environment.Service to avoid an import cycle.
type EnvironmentSeeder interface {
	SeedDefaults(workspaceID uuid.UUID) error
}

// PermissionChecker is satisfied by role.RoleService.
type PermissionChecker interface {
	HasPermission(userID uuid.UUID, permission string) (bool, error)
}

type Service struct {
	repo    *Repository
	roleSvc PermissionChecker
	envSeed EnvironmentSeeder
}

func NewService(repo *Repository, roleSvc PermissionChecker, envSeed EnvironmentSeeder) *Service {
	return &Service{repo: repo, roleSvc: roleSvc, envSeed: envSeed}
}

func (s *Service) Create(ownerID uuid.UUID, input CreateWorkspaceInput) (*Workspace, error) {
	slug := slugify(input.Name)

	w := &Workspace{
		Name:        input.Name,
		Slug:        slug,
		Description: input.Description,
		OwnerID:     ownerID,
	}

	if err := s.repo.Create(w); err != nil {
		if errors.Is(err, ErrSlugTaken) {
			return nil, ErrSlugTaken
		}
		return nil, err
	}

	// Add owner as a member.
	member := &WorkspaceMember{
		WorkspaceID: w.ID,
		UserID:      ownerID,
		Role:        MemberRoleOwner,
	}
	if err := s.repo.AddMember(member); err != nil {
		return nil, err
	}

	// Seed default environments (best-effort).
	if s.envSeed != nil {
		_ = s.envSeed.SeedDefaults(w.ID)
	}

	return w, nil
}

func (s *Service) List(callerID uuid.UUID) ([]Workspace, error) {
	// workspaces:write is granted to admin + manager only.
	// workspaces:read is granted to all roles, so checking it here would return
	// every workspace to developers and viewers — which is not intended.
	canListAll, _ := s.roleSvc.HasPermission(callerID, "workspaces:write")
	if canListAll {
		return s.repo.ListAll()
	}
	return s.repo.ListByUserID(callerID)
}

// ListMine always returns only workspaces where the caller is a member,
// regardless of platform-admin status. Used by the /workspaces/mine endpoint
// so the frontend can determine the user's own workspaces.
func (s *Service) ListMine(callerID uuid.UUID) ([]Workspace, error) {
	return s.repo.ListByUserID(callerID)
}

func (s *Service) Get(callerID uuid.UUID, slug string) (*Workspace, error) {
	w, err := s.repo.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	if err := s.checkAccess(callerID, w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *Service) Update(callerID uuid.UUID, slug string, input UpdateWorkspaceInput) (*Workspace, error) {
	w, err := s.repo.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	if err := s.checkOwnerOrAdmin(callerID, w); err != nil {
		return nil, err
	}
	if input.Name != "" {
		w.Name = input.Name
	}
	if input.Description != "" {
		w.Description = input.Description
	}
	if err := s.repo.Update(w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *Service) Delete(callerID uuid.UUID, slug string) error {
	w, err := s.repo.FindBySlug(slug)
	if err != nil {
		return err
	}
	if err := s.checkOwnerOrAdmin(callerID, w); err != nil {
		return err
	}
	return s.repo.Delete(w.ID)
}

func (s *Service) ListMembers(callerID uuid.UUID, slug string) ([]WorkspaceMemberDetail, error) {
	w, err := s.repo.FindBySlug(slug)
	if err != nil {
		return nil, err
	}
	if err := s.checkAccess(callerID, w); err != nil {
		return nil, err
	}
	return s.repo.ListMembers(w.ID)
}

func (s *Service) AddMember(callerID uuid.UUID, slug string, targetUserID uuid.UUID) error {
	w, err := s.repo.FindBySlug(slug)
	if err != nil {
		return err
	}
	if err := s.checkOwnerOrAdmin(callerID, w); err != nil {
		return err
	}
	existing, err := s.repo.FindMember(w.ID, targetUserID)
	if err != nil {
		return err
	}
	if existing != nil {
		return ErrAlreadyMember
	}
	m := &WorkspaceMember{
		WorkspaceID: w.ID,
		UserID:      targetUserID,
		Role:        MemberRoleMember,
	}
	return s.repo.AddMember(m)
}

func (s *Service) RemoveMember(callerID uuid.UUID, slug string, targetUserID uuid.UUID) error {
	w, err := s.repo.FindBySlug(slug)
	if err != nil {
		return err
	}
	if err := s.checkOwnerOrAdmin(callerID, w); err != nil {
		return err
	}
	return s.repo.RemoveMember(w.ID, targetUserID)
}

// IsMember returns true if the user is any member of the workspace.
func (s *Service) IsMember(userID, workspaceID uuid.UUID) (bool, error) {
	m, err := s.repo.FindMember(workspaceID, userID)
	if err != nil {
		return false, err
	}
	return m != nil, nil
}

// HasWorkspaceAccess returns true if the user is a workspace member OR a platform admin.
// Use this for access-control decisions; use IsMember when you need strict membership semantics.
func (s *Service) HasWorkspaceAccess(userID, workspaceID uuid.UUID) (bool, error) {
	if s.isPlatformAdmin(userID) {
		return true, nil
	}
	return s.IsMember(userID, workspaceID)
}

// IsOwner returns true if the user is the owner member of the workspace.
func (s *Service) IsOwner(userID, workspaceID uuid.UUID) (bool, error) {
	m, err := s.repo.FindMember(workspaceID, userID)
	if err != nil {
		return false, err
	}
	return m != nil && m.Role == MemberRoleOwner, nil
}

// FindBySlug exposes FindBySlug for the workspace middleware interface.
func (s *Service) FindBySlug(slug string) (*Workspace, error) {
	return s.repo.FindBySlug(slug)
}

// AddMemberDirect adds a user as a workspace member without ownership checks.
// Used by the access request approval flow.
func (s *Service) AddMemberDirect(workspaceID, userID uuid.UUID) error {
	existing, err := s.repo.FindMember(workspaceID, userID)
	if err != nil {
		return err
	}
	if existing != nil {
		return ErrAlreadyMember
	}
	m := &WorkspaceMember{
		WorkspaceID: workspaceID,
		UserID:      userID,
		Role:        MemberRoleMember,
	}
	return s.repo.AddMember(m)
}

// Directory returns all workspaces as lightweight stubs for the access request picker.
func (s *Service) Directory() ([]DirectoryEntry, error) {
	all, err := s.repo.ListAll()
	if err != nil {
		return nil, err
	}
	out := make([]DirectoryEntry, len(all))
	for i, w := range all {
		out[i] = DirectoryEntry{
			ID:          w.ID.String(),
			Name:        w.Name,
			Slug:        w.Slug,
			Description: w.Description,
		}
	}
	return out, nil
}

// -- internal helpers --------------------------------------------------------

func (s *Service) isPlatformAdmin(userID uuid.UUID) bool {
	ok, _ := s.roleSvc.HasPermission(userID, "workspaces:write")
	return ok
}

func (s *Service) checkAccess(callerID uuid.UUID, w *Workspace) error {
	if s.isPlatformAdmin(callerID) {
		return nil
	}
	m, err := s.repo.FindMember(w.ID, callerID)
	if err != nil {
		return err
	}
	if m == nil {
		return ErrForbidden
	}
	return nil
}

func (s *Service) checkOwnerOrAdmin(callerID uuid.UUID, w *Workspace) error {
	if s.isPlatformAdmin(callerID) {
		return nil
	}
	m, err := s.repo.FindMember(w.ID, callerID)
	if err != nil {
		return err
	}
	if m == nil || m.Role != MemberRoleOwner {
		return ErrForbidden
	}
	return nil
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
