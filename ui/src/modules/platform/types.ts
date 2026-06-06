export interface ProviderConfigResponse {
  id: string;
  provider_name: string;
  display_name: string;
  endpoint: string;
  region?: string;
  namespace?: string;
  credential_type: string;
  created_at: string;
}

export interface CapabilityStatusResponse {
  capability_name: string;
  display_name: string;
  is_enabled: boolean;
  providers: ProviderConfigResponse[];
}

export interface CapabilityProvider {
  id: string;
  name: string;
  display_name: string;
  capability_name: string;
  description: string;
}

export interface BindProviderInput {
  provider_name: string;
  endpoint: string;
  region?: string;
  namespace?: string;
  token?: string;
}

export interface UpdateProviderInput {
  endpoint: string;
  region?: string;
  namespace?: string;
  token?: string;
}
