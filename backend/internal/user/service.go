package user

import (
	"errors"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailTaken   = errors.New("email already in use")
	ErrNotFound     = errors.New("user not found")
	ErrInvalidCreds = errors.New("invalid credentials")
)

type UserService struct {
	userRepo  *UserRepository
	tokenRepo *RefreshTokenRepository
}

func NewUserService(userRepo *UserRepository, tokenRepo *RefreshTokenRepository) *UserService {
	return &UserService{userRepo: userRepo, tokenRepo: tokenRepo}
}

func (s *UserService) Register(email, password, firstName, lastName string, deptID uuid.UUID) (*User, error) {

	// Check department exists
	// dept, err := s.
	existing, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	u := &User{
		Email:        email,
		PasswordHash: string(hash),
		FirstName:    firstName,
		LastName:     lastName,
		DepartmentID: deptID,
	}
	return u, s.userRepo.Register(u)
}

func (s *UserService) Authenticate(email, password string) (*User, error) {
	u, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrInvalidCreds
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCreds
	}
	return u, nil
}

func (s *UserService) GetByID(id uuid.UUID) (*User, error) {
	u, err := s.userRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, ErrNotFound
	}
	return u, nil
}

func (s *UserService) List(page, limit int) ([]User, int64, error) {
	return s.userRepo.List(page, limit)
}

func (s *UserService) ListWithDetails(f ListFilters) ([]UserSummary, int64, error) {
	return s.userRepo.ListWithDetails(f)
}

func (s *UserService) Update(u *User) error {
	return s.userRepo.Update(u)
}

func (s *UserService) Delete(id uuid.UUID) error {
	return s.userRepo.Delete(id)
}

func (s *UserService) RevokeAllTokens(userID uuid.UUID) error {
	return s.tokenRepo.RevokeByUserID(userID)
}
