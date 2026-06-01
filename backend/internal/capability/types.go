package capability

// BindProviderInput is the request body for POST .../capabilities/:cap/provider.
type BindProviderInput struct {
	ProviderName string `json:"provider_name" binding:"required"`
	Endpoint     string `json:"endpoint"      binding:"required"`
	Region       string `json:"region"`
	Namespace    string `json:"namespace"`
	Token        string `json:"token"`
}

// UpdateProviderInput is the request body for PUT .../capabilities/:cap/provider/:id.
// Token is optional — if blank the existing vault secret is retained.
type UpdateProviderInput struct {
	Endpoint  string `json:"endpoint"  binding:"required"`
	Region    string `json:"region"`
	Namespace string `json:"namespace"`
	Token     string `json:"token"` // optional: omit to keep existing
}

// CapabilityStatusResponse is returned by GET .../capabilities and GET .../capabilities/:cap.
type CapabilityStatusResponse struct {
	CapabilityName string                  `json:"capability_name"`
	DisplayName    string                  `json:"display_name"`
	IsEnabled      bool                    `json:"is_enabled"`
	Providers      []ProviderConfigResponse `json:"providers"`
}

// ProviderConfigResponse is the public shape of a ProviderConfig (no vault path, no token).
type ProviderConfigResponse struct {
	ID             string `json:"id"`
	ProviderName   string `json:"provider_name"`
	DisplayName    string `json:"display_name"`
	Endpoint       string `json:"endpoint"`
	Region         string `json:"region,omitempty"`
	Namespace      string `json:"namespace,omitempty"`
	CredentialType string `json:"credential_type"`
	CreatedAt      string `json:"created_at"`
}

// VerifyProviderResult is returned by POST .../capabilities/:cap/provider/:id/verify.
type VerifyProviderResult struct {
	Reachable  bool   `json:"reachable"`
	StatusCode int    `json:"status_code,omitempty"`
	Message    string `json:"message"`
}
