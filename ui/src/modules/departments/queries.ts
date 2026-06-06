import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { CreateDepartmentInput, Department, DepartmentList, UpdateDepartmentInput } from './types';

export const departmentKeys = {
  all: ['departments'] as const,
  list: (page: number, limit: number) => ['departments', 'list', page, limit] as const,
  detail: (id: string) => ['departments', 'detail', id] as const,
};

export function useDepartments(page = 1, limit = 20) {
  return useQuery<DepartmentList, ApiError>({
    queryKey: departmentKeys.list(page, limit),
    queryFn: () => api.get(`/api/v1/departments?page=${page}&limit=${limit}`),
  });
}

export function useDepartment(id: string) {
  return useQuery<Department, ApiError>({
    queryKey: departmentKeys.detail(id),
    queryFn: () => api.get(`/api/v1/departments/${id}`),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation<Department, ApiError, CreateDepartmentInput>({
    mutationFn: (input) => api.post('/api/v1/departments', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation<Department, ApiError, { id: string; input: UpdateDepartmentInput }>({
    mutationFn: ({ id, input }) => api.put(`/api/v1/departments/${id}`, input),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: departmentKeys.detail(id) });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`/api/v1/departments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
    },
  });
}
