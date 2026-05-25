package user

import (
	"time"

	"github.com/google/uuid"
	"github.com/kusumaningrat/idp-backend/internal/models"
)

type User struct {
	models.Base
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"not null"             json:"-"`
	FirstName    string    `gorm:"not null"             json:"first_name"`
	LastName     string    `gorm:"not null"             json:"last_name"`
	IsActive     bool      `gorm:"default:true"         json:"is_active"`
	DepartmentID uuid.UUID `gorm:"type:uuid;not null;index" json:"department_id"`
	// UserRoles loaded via preload in services — avoids import cycle with role package
}

func (u *User) FullName() string {
	return u.FirstName + " " + u.LastName
}

type RefreshToken struct {
	models.Base
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	TokenHash string    `gorm:"not null;uniqueIndex"     json:"-"`
	ExpiresAt time.Time `gorm:"not null"                 json:"expires_at"`
	Revoked   bool      `gorm:"default:false"            json:"revoked"`
	User      *User     `gorm:"foreignKey:UserID"        json:"-"`
}

func (rt *RefreshToken) IsExpired() bool {
	return time.Now().After(rt.ExpiresAt)
}

func (rt *RefreshToken) IsValid() bool {
	return !rt.Revoked && !rt.IsExpired()
}
