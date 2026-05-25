package accessrequest

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrAlreadyMember    = errors.New("user is already a workspace member")
	ErrDuplicateRequest = errors.New("a pending request already exists for this workspace")
	ErrNotPending       = errors.New("request is no longer pending")
)

// WorkspaceAccess is satisfied by workspace.Service.
type WorkspaceAccess interface {
	IsMember(userID, workspaceID uuid.UUID) (bool, error)
	AddMemberDirect(workspaceID, userID uuid.UUID) error
}

type Service struct {
	repo  *Repository
	wsSvc WorkspaceAccess
}

func NewService(repo *Repository, wsSvc WorkspaceAccess) *Service {
	return &Service{repo: repo, wsSvc: wsSvc}
}

func (s *Service) Create(userID uuid.UUID, input CreateInput) (*AccessRequest, error) {
	isMember, err := s.wsSvc.IsMember(userID, input.WorkspaceID)
	if err != nil {
		return nil, err
	}
	if isMember {
		return nil, ErrAlreadyMember
	}

	dup, err := s.repo.HasPendingRequest(userID, input.WorkspaceID)
	if err != nil {
		return nil, err
	}
	if dup {
		return nil, ErrDuplicateRequest
	}

	ar := &AccessRequest{
		UserID:        userID,
		WorkspaceID:   input.WorkspaceID,
		RequestedRole: input.RequestedRole,
		Reason:        input.Reason,
		Status:        StatusPending,
	}
	if err := s.repo.Create(ar); err != nil {
		return nil, err
	}
	return ar, nil
}

func (s *Service) ListPending() ([]AccessRequestDetail, error) {
	return s.repo.ListByStatus(StatusPending)
}

func (s *Service) ListMine(userID uuid.UUID) ([]AccessRequestDetail, error) {
	return s.repo.ListByUser(userID)
}

func (s *Service) Approve(reviewerID, requestID uuid.UUID, roleOverride string) error {
	ar, err := s.repo.FindByID(requestID)
	if err != nil {
		return err
	}
	if ar.Status != StatusPending {
		return ErrNotPending
	}

	if err := s.wsSvc.AddMemberDirect(ar.WorkspaceID, ar.UserID); err != nil {
		return err
	}

	if roleOverride != "" {
		ar.RequestedRole = roleOverride
	}

	now := time.Now()
	ar.Status = StatusApproved
	ar.ReviewedBy = &reviewerID
	ar.ReviewedAt = &now
	return s.repo.Update(ar)
}

func (s *Service) Deny(reviewerID, requestID uuid.UUID) error {
	ar, err := s.repo.FindByID(requestID)
	if err != nil {
		return err
	}
	if ar.Status != StatusPending {
		return ErrNotPending
	}

	now := time.Now()
	ar.Status = StatusDenied
	ar.ReviewedBy = &reviewerID
	ar.ReviewedAt = &now
	return s.repo.Update(ar)
}
