import { createContext, useContext } from "react";
import type { WorkspaceEnvironment } from "@/lib/types";

export interface EnvironmentContextValue {
  selectedEnvironment: WorkspaceEnvironment | null;
  setSelectedEnvironment: (env: WorkspaceEnvironment | null) => void;
  isHydrated: boolean;
}

export const EnvironmentContext = createContext<EnvironmentContextValue>({
  selectedEnvironment: null,
  setSelectedEnvironment: () => undefined,
  isHydrated: false,
});

export function useEnvironmentContext() {
  return useContext(EnvironmentContext);
}
