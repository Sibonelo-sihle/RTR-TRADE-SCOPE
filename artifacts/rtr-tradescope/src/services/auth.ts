import type { BetaTesterProfile } from "@/types/auth";

// Temporary local-only access marker. This is not authentication or a security boundary.
export const BETA_TESTER_STORAGE_KEY = "rtr-tradescope:beta-tester:v1";

export function loadBetaTester(): BetaTesterProfile | null {
  try {
    const value = window.localStorage.getItem(BETA_TESTER_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<BetaTesterProfile>;
    if (typeof parsed.name !== "string" || typeof parsed.email !== "string") return null;
    const name = parsed.name.trim();
    const email = parsed.email.trim().toLowerCase();
    return name && email ? { name, email } : null;
  } catch {
    return null;
  }
}

export function saveBetaTester(profile: BetaTesterProfile) {
  window.localStorage.setItem(BETA_TESTER_STORAGE_KEY, JSON.stringify(profile));
}

export function clearBetaTester() {
  window.localStorage.removeItem(BETA_TESTER_STORAGE_KEY);
}
