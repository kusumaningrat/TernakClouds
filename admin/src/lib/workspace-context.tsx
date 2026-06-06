import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Workspace } from "@/lib/types";

const STORAGE_KEY = "Clouds_workspace_v2";

function readStored(): Workspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Workspace) : null;
  } catch {
    return null;
  }
}

interface WorkspaceContextValue {
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (ws: Workspace | null) => void;
  /** False until the first useEffect has run and localStorage has been read. */
  isHydrated: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  selectedWorkspace: null,
  setSelectedWorkspace: () => undefined,
  isHydrated: false,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<Workspace | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSelectedWorkspaceState(readStored());
    setIsHydrated(true);
  }, []);

  const setSelectedWorkspace = (ws: Workspace | null) => {
    setSelectedWorkspaceState(ws);
    try {
      if (ws) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.)
    }
  };

  return (
    <WorkspaceContext.Provider value={{ selectedWorkspace, setSelectedWorkspace, isHydrated }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  return useContext(WorkspaceContext);
}
