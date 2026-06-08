import { useEffect, useState, type ReactNode } from "react";
import type { WorkspaceEnvironment } from "@/lib/types";
import { EnvironmentContext } from "./use-environment-context";

const STORAGE_KEY = "Clouds_environment_v1";

function readStored(): WorkspaceEnvironment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceEnvironment) : null;
  } catch {
    return null;
  }
}

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [selectedEnvironment, setSelectedEnvironmentState] = useState<WorkspaceEnvironment | null>(
    null,
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSelectedEnvironmentState(readStored());
    setIsHydrated(true);
  }, []);

  const setSelectedEnvironment = (env: WorkspaceEnvironment | null) => {
    setSelectedEnvironmentState(env);
    try {
      if (env) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <EnvironmentContext.Provider
      value={{ selectedEnvironment, setSelectedEnvironment, isHydrated }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}
