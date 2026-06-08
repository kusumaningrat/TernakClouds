import type { UserRole } from "../users/types";

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  department_name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  department_id: string;
  department_name: string;
  is_active: boolean;
  must_change_password: boolean;
}

export interface MeResponse extends UserProfile {
  roles: UserRole[];
}

export interface JWTClaims {
  user_id: string;
  email: string;
  department_id: string;
  exp: number;
  iat: number;
}
