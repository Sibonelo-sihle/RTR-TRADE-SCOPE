import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { clearBetaTester, loadBetaTester, saveBetaTester } from "@/services/auth";
import type { BetaAccessState, BetaTesterProfile } from "@/types/auth";

interface BetaAccessContextValue extends BetaAccessState {
  enterWorkspace: (profile: BetaTesterProfile) => void;
  signOut: () => void;
}

const BetaAccessContext = createContext<BetaAccessContextValue | null>(null);

// Beta Tester Access deliberately keeps identity local to this browser.
// Real authentication can replace this provider without changing workspace data services.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [tester, setTester] = useState<BetaTesterProfile | null>(() => loadBetaTester());

  const value = useMemo<BetaAccessContextValue>(() => ({
    tester,
    loading: false,
    enterWorkspace: (profile) => {
      const normalized = { name: profile.name.trim(), email: profile.email.trim().toLowerCase() };
      saveBetaTester(normalized);
      setTester(normalized);
    },
    signOut: () => {
      clearBetaTester();
      setTester(null);
    },
  }), [tester]);

  return <BetaAccessContext.Provider value={value}>{children}</BetaAccessContext.Provider>;
}

export function useAuth() {
  const value = useContext(BetaAccessContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
