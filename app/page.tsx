"use client";

import Link from "next/link";

function ToolCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-200 hover:border-[#fbbf24]/50 hover:bg-[#0f172a]"
    >
      <h2 className="text-lg font-semibold text-[#f9fafb] transition group-hover:text-[#fbbf24]">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#9ca3af]">{description}</p>
    </Link>
  );
}

function PhotoTile({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-[#1f2937] bg-[#111827] shadow-[0_14px_35px_rgba(0,0,0,0.35)] ${className}`}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0f172a] text-[#f9fafb]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(217,119,6,0.10),transparent_25%)]" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 md:px-10">
        <header className="rounded-2xl border border-[#1f2937] bg-[#111827]/95 px-6 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-4xl font-bold tracking-wide text-[#fbbf24]">
                5Tools
              </div>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-sm font-medium text-[#9ca3af]">
                  Repair &amp; Maintenance Workspace
                </p>
                <span className="hidden h-[2px] w-16 bg-[#fbbf24] md:block" />
              </div>
            </div>

            <nav className="hidden items-center gap-8 text-sm font-medium text-[#d1d5db] md:flex">
              <Link href="/" className="relative text-[#f9fafb]">
                Dashboard
                <span className="absolute -bottom-2 left-0 h-[2px] w-full bg-[#fbbf24]" />
              </Link>
              <Link href="/inspections" className="transition hover:text-[#f9fafb]">
                Photo Tool
              </Link>
              <Link href="/estimator" className="transition hover:text-[#f9fafb]">
                Estimator
              </Link>
              <Link href="/project-tracker" className="transition hover:text-[#f9fafb]">
                Projects
              </Link>
            </nav>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-14 md:py-20 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="w-full max-w-3xl">
            <h1 className="text-5xl font-bold leading-tight text-[#f9fafb] md:text-7xl">
              Manage Repair Work from One Dashboard
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#9ca3af]">
              Organize photo documentation, build repair scopes, prepare cost
              estimates, and track maintenance work from one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/inspections"
                className="rounded-xl bg-[#fbbf24] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#d97706]"
              >
                Open Photo Tool
              </Link>

              <Link
                href="/estimator"
                className="rounded-xl border border-[#1f2937] bg-[#111827] px-6 py-3 text-sm font-semibold text-[#f9fafb] transition hover:bg-[#1f2937]"
              >
                Open Estimator
              </Link>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <ToolCard
                title="Photo Review Tool"
                description="Capture jobsite photos, document visible conditions, and organize repair notes."
                href="/inspections"
              />
              <ToolCard
                title="Cost Estimator"
                description="Build repair pricing, compare scope items, and prepare job totals."
                href="/estimator"
              />
              <ToolCard
                title="Project Tracker"
                description="Track open jobs, materials, scheduling, and repair progress."
                href="/project-tracker"
              />
              <ToolCard
                title="Operations Hub"
                description="Access internal workflows, forms, and maintenance support tools."
                href="/"
              />
            </div>

            <div className="mt-10 max-w-4xl rounded-xl border border-[#1f2937] bg-[#111827]/95 p-4 text-xs leading-6 text-[#9ca3af] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              5Tools supports general maintenance, repair workflow, and visual
              documentation. It does not provide licensed inspections,
              engineering opinions, or certified reports.
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="grid h-[620px] grid-cols-2 grid-rows-3 gap-4">
              <PhotoTile
                src="/cabinet-install.jpg"
                alt="Contractor installing cabinets"
                className="col-span-2 row-span-2"
              />
              <PhotoTile
                src="/outlet-repair.jpg"
                alt="Replacing an outlet"
              />
              <PhotoTile
                src="/trim-repair.jpg"
                alt="Trim and finish repair work"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}