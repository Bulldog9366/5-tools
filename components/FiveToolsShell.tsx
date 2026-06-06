"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type FiveToolsShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function FiveToolsShell({
  title,
  subtitle,
  children,
}: FiveToolsShellProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#120a05] text-[#fff5df]">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(90deg,#3b2412_0%,#6b4420_12%,#2c190b_24%,#805427_36%,#3d2613_48%,#70481f_60%,#2b180b_72%,#8a5a28_84%,#2f1b0d_100%)]" />

      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,224,142,0.26),transparent_42%),radial-gradient(circle_at_center,rgba(0,0,0,0.15),rgba(0,0,0,0.82)_70%)]" />

      <header className="border-b border-[#d4a640]/40 bg-[#160c06]/90 px-6 py-5 shadow-2xl backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.42em] text-[#d4a640]">
              5 Tools Command System
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#fff5df] md:text-5xl">
              {title}
            </h1>

            {subtitle ? (
              <p className="mt-2 text-sm text-[#d9c9a4]">
                {subtitle}
              </p>
            ) : null}
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-[#d4a640] bg-[#2a1709] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#f8d978] shadow-lg transition hover:bg-[#4c2d12]"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </div>
    </main>
  );
}