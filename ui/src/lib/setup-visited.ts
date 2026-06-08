const SETUP_VISITED_KEY = "tc_setup_visited";

export function markSetupVisited() {
  try {
    localStorage.setItem(SETUP_VISITED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasSetupBeenVisited(): boolean {
  try {
    return !!localStorage.getItem(SETUP_VISITED_KEY);
  } catch {
    return false;
  }
}
