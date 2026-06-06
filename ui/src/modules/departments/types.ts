export interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentList {
  items: Department[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateDepartmentInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
}
