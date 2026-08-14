import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
  const { enterWorkspace } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    enterWorkspace({ name: name.trim(), email: email.trim() });
  }

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#0a1016] px-4 py-10 text-[#dce7e8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(48,155,121,.18),transparent_34%),linear-gradient(135deg,rgba(17,28,36,.9),rgba(7,11,16,.98))]" />
      <div className="relative w-full max-w-[430px]">
        <div className="mb-7 text-center">
          <img src="/assets/rtr-logo.jpeg" alt="Rags to Riches FX" className="mx-auto h-24 w-24 rounded-full bg-white object-contain shadow-[0_0_42px_rgba(76,224,177,.18)]" />
          <h1 className="mt-5 text-[28px] font-bold tracking-[-.04em] text-[#eff7f5]">RTR-TradeScope</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[.18em] text-[#66d6b5]">Track. Review. Refine.</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-[#293a43] bg-[#111a22]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,.42)] backdrop-blur-xl sm:p-7">
          <div className="mb-6">
            <div className="text-[18px] font-bold text-[#edf5f4]">Beta Tester Access</div>
            <div className="mt-1 text-[11px] text-[#778994]">Enter your details to open the shared RTR workspace.</div>
          </div>
          {error && <div role="alert" className="mb-4 rounded-lg border border-[#743f45] bg-[#351f26] p-3 text-[11px] text-[#f0a29a]">{error}</div>}
          <div className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#81919b]">Your name</span><input data-testid="input-beta-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" className="w-full rounded-lg border border-[#2c3a45] bg-[#0c141b] px-3.5 py-3 text-[13px] outline-none focus:border-[#4ce0b1]" /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#81919b]">Email address</span><input data-testid="input-beta-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="email@example.com" className="w-full rounded-lg border border-[#2c3a45] bg-[#0c141b] px-3.5 py-3 text-[13px] outline-none focus:border-[#4ce0b1]" /></label>
          </div>
          <button data-testid="button-beta-enter" className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4ce0b1] py-3 text-[12px] font-bold text-[#0a1716]"><ShieldCheck size={16} />Enter RTR-TradeScope</button>
          <p className="mt-4 text-center text-[10px] leading-relaxed text-[#667883]">Temporary beta access only. This is not authentication; testers share the same workspace data.</p>
        </form>
      </div>
    </main>
  );
}
