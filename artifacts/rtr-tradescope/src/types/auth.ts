export interface BetaTesterProfile {
  name: string;
  email: string;
}

export interface BetaAccessState {
  tester: BetaTesterProfile | null;
  loading: boolean;
}
