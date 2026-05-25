package auth

type RegisterInput struct {
	Email          string `json:"email"            binding:"required,email"`
	Password       string `json:"password"         binding:"required,min=8"`
	FirstName      string `json:"first_name"       binding:"required"`
	LastName       string `json:"last_name"        binding:"required"`
	DepartmentName string `json:"department_name"  binding:"required"`
}

type LoginInput struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshInput struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type LogoutInput struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type RegisterResponse struct {
	ID             string `json:"id"`
	Email          string `json:"email"`
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	DepartmentName string `json:"department_name"`
	CreatedAt      string `json:"created_at"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
}
