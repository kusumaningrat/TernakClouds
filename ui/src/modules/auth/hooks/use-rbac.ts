import { useMe } from "./use-auth";

const ROLE_ADMIN = "admin";
const ROLE_MANAGER = "manager";
const ROLE_PLATFORM_ENGINEER = "platform-engineer";

export function useRbac() {
  const { data } = useMe();
  const roles = data?.roles?.map((r) => r.role?.name ?? "") ?? [];

  return {
    isAdmin: roles.includes(ROLE_ADMIN),
    isManager: roles.includes(ROLE_MANAGER),
    isAdminOrManager: roles.some((r) => r === ROLE_ADMIN || r === ROLE_MANAGER),
    isPlatformEngineer: roles.includes(ROLE_PLATFORM_ENGINEER),
    hasRole: (name: string) => roles.includes(name),
  };
}
