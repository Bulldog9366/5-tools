"use client";

// The door for 5 Tools.
//
// Off by default: until NEXT_PUBLIC_REQUIRE_LOGIN is set to "true" in Vercel,
// every page renders exactly as it does today, so nobody's screen changes.
// Switch it on and each page asks for the sign-in that already exists in
// Supabase Auth before it renders; the session then rides along on every
// database call the pages make.
//
// This is the lock on the door, not the lock on the safe: the database key
// still ships to the browser, so the tables also need row-level security on
// before the data is really closed. See the note in the repo's README.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

const LOGIN_REQUIRED = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "true";

type GateState = "off" | "checking" | "signed-in" | "signed-out";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<GateState>(
    LOGIN_REQUIRED ? "checking" : "off",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!LOGIN_REQUIRED) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState(data.session ? "signed-in" : "signed-out");
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setState("signed-in");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState("signed-out");
  }

  if (state === "off" || state === "signed-in") {
    return (
      <>
        {children}
        {LOGIN_REQUIRED ? (
          <button
            type="button"
            onClick={signOut}
            className="fixed bottom-4 right-4 z-50 rounded-full border border-[#d4a640]/40 bg-[#160c06]/80 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#d9c9a4] backdrop-blur transition hover:border-[#d4a640] hover:text-[#f8d978]"
          >
            Sign out
          </button>
        ) : null}
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#120a05] px-6 py-16 text-[#fff5df]">
      <div className="w-full max-w-md rounded-3xl border border-[#d4a640]/40 bg-[#1d1008]/90 p-8 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
        <p className="text-xs font-black uppercase tracking-[0.42em] text-[#d4a640]">
          5 Tools
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-[#d9c9a4]">
          {state === "checking"
            ? "Checking your session…"
            : "Use the 5 Tools login you were given."}
        </p>

        {state === "signed-out" ? (
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-[#d9c9a4]">
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-[#d4a640]/30 bg-[#120a05] px-3 py-2 text-base font-normal normal-case tracking-normal text-[#fff5df] outline-none focus:border-[#d4a640]"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-wide text-[#d9c9a4]">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-[#d4a640]/30 bg-[#120a05] px-3 py-2 text-base font-normal normal-case tracking-normal text-[#fff5df] outline-none focus:border-[#d4a640]"
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-[#b8322a]/50 bg-[#3a120e]/60 px-3 py-2 text-sm text-[#ffd7d0]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl border border-[#d4a640] bg-[#2a1709] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#f8d978] transition hover:bg-[#4c2d12] disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : null}

        {!LOGIN_REQUIRED ? null : (
          <p className="mt-6 text-[11px] leading-5 text-[#9c8c72]">
            Access is for 5 Tools staff only. If you need a login, ask Eric.
          </p>
        )}
      </div>
    </main>
  );
}
