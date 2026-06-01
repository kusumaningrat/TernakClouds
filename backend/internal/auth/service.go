package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/config"
	"github.com/kusumaningrat/ternakclouds/internal/department"
	"github.com/kusumaningrat/ternakclouds/internal/user"
	pkgjwt "github.com/kusumaningrat/ternakclouds/pkg/jwt"
)

var ErrInvalidToken = errors.New("invalid or expired token")

type UserProfile struct {
	ID             string `json:"id"`
	Email          string `json:"email"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	DepartmentID   string `json:"department_id"`
	DepartmentName string `json:"department_name"`
	IsActive       bool   `json:"is_active"`
}

type AuthService struct {
	userService *user.UserService
	deptService *department.DepartmentService
	tokenRepo   *user.RefreshTokenRepository
	jwtCfg      config.JWTConfig
}

func NewAuthService(
	userService *user.UserService,
	deptService *department.DepartmentService,
	tokenRepo *user.RefreshTokenRepository,
	jwtCfg config.JWTConfig,
) *AuthService {
	return &AuthService{
		userService: userService,
		deptService: deptService,
		tokenRepo:   tokenRepo,
		jwtCfg:      jwtCfg,
	}
}

func (s *AuthService) Register(input RegisterInput) (*RegisterResponse, error) {
	dept, err := s.deptService.FindOrCreate(input.DepartmentName)
	if err != nil {
		return nil, err
	}

	u, err := s.userService.Register(input.Email, input.Password, input.FirstName, input.LastName, dept.ID)
	if err != nil {
		return nil, err
	}

	return &RegisterResponse{
		ID:             u.ID.String(),
		Email:          u.Email,
		FirstName:      u.FirstName,
		LastName:       u.LastName,
		DepartmentName: dept.Name,
		CreatedAt:      u.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}, nil
}

func (s *AuthService) Login(input LoginInput) (*TokenResponse, error) {
	u, err := s.userService.Authenticate(input.Email, input.Password)
	if err != nil {
		return nil, err
	}
	return s.issueTokens(u)
}

// Logout revokes only the presented refresh token, leaving other sessions intact.
func (s *AuthService) Logout(rawRefreshToken string) error {
	rt, err := s.tokenRepo.FindByHash(hashToken(rawRefreshToken))
	if err != nil {
		return err
	}
	if rt == nil || rt.Revoked {
		return ErrInvalidToken
	}
	return s.tokenRepo.RevokeOne(rt.ID)
}

// RefreshToken validates the old token, rotates it, and issues a new pair.
func (s *AuthService) RefreshToken(rawRefreshToken string) (*TokenResponse, error) {
	rt, err := s.tokenRepo.FindByHash(hashToken(rawRefreshToken))
	if err != nil {
		return nil, err
	}
	if rt == nil || !rt.IsValid() {
		return nil, ErrInvalidToken
	}

	if err := s.tokenRepo.RevokeOne(rt.ID); err != nil {
		return nil, err
	}

	u, err := s.userService.GetByID(rt.UserID)
	if err != nil {
		return nil, err
	}
	return s.issueTokens(u)
}

func (s *AuthService) issueTokens(u *user.User) (*TokenResponse, error) {
	accessToken, err := pkgjwt.GenerateAccessToken(u.ID, u.Email, u.DepartmentID, s.jwtCfg.Secret, s.jwtCfg.AccessExpiry)
	if err != nil {
		return nil, err
	}

	rawRefresh, hash, err := generateRefreshToken()
	if err != nil {
		return nil, err
	}

	rt := &user.RefreshToken{
		UserID:    u.ID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(s.jwtCfg.RefreshExpiry),
	}
	if err := s.tokenRepo.Create(rt); err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		TokenType:    "Bearer",
	}, nil
}

func generateRefreshToken() (rawToken, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	rawToken = base64.URLEncoding.EncodeToString(b)
	hash = hashToken(rawToken)
	return
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func (s *AuthService) Profile(userID uuid.UUID) (*UserProfile, error) {
	u, err := s.userService.GetByID(userID)
	if err != nil {
		return nil, err
	}

	deptName := ""
	dept, err := s.deptService.Get(u.DepartmentID)
	if err != nil && !errors.Is(err, department.ErrNotFound) {
		return nil, err
	}
	if dept != nil {
		deptName = dept.Name
	}

	return &UserProfile{
		ID:             u.ID.String(),
		Email:          u.Email,
		FirstName:      u.FirstName,
		LastName:       u.LastName,
		DepartmentID:   u.DepartmentID.String(),
		DepartmentName: deptName,
		IsActive:       u.IsActive,
	}, nil
}
