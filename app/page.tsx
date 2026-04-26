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
      className="block rounded-2xl border border-[#d8d2c4] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9a227] hover:bg-[#fffdf7] hover:shadow-md"
    >
      <div className="mb-3 h-1.5 w-12 rounded-full bg-[#c9a227]" />
      <h2 className="text-lg font-semibold text-[#111111]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5b564c]">{description}</p>
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
      className={`overflow-hidden rounded-2xl border border-[#d8d2c4] bg-white shadow-sm ${className}`}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#ece8df] px-4 py-6 text-[#111111] md:px-8">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
        
        {/* HEADER */}
        <header className="mb-6 rounded-3xl border border-[#d8d2c4] bg-[#f7f4ed] px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-3xl font-bold text-[#111111]">5Tools</div>
              <p className="mt-1 text-sm uppercase tracking-[0.18em] text-[#c9a227]">
                Repair & Maintenance Workspace
              </p>
            </div>

            <nav className="flex flex-wrap gap-4 text-sm font-medium text-[#5b564c]">
              <Link href="/" className="text-[#111111]">
                Dashboard
              </Link>
              <Link href="/inspections">Photo Tool</Link>
              <Link href="/punch-list">Punch List</Link>
              <Link href="/project-scheduler">Scheduler</Link>
              <Link href="/cost-estimator">Cost Estimator</Link>
              <Link href="/project-tracker">Projects</Link>
            </nav>
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid flex-1 items-start gap-10 py-6 lg:grid-cols-[1.1fr_0.9fr]">

          {/* LEFT SIDE */}
          <div>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              Manage Repair Work from One Dashboard
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5b564c]">
              Organize photo documentation, track punch items, schedule vendors,
              build repair scopes, prepare cost estimates, and manage maintenance
              work from one place.
            </p>

            {/* ACTION BUTTONS */}
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/inspections"
                className="rounded-xl bg-[#c9a227] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b8921f]"
              >
                Open Photo Tool
              </Link>

              <Link
                href="/project-scheduler"
                className="rounded-xl border border-[#d8d2c4] bg-white px-5 py-2 text-sm font-semibold text-[#111111] shadow-sm hover:bg-[#fffdf7]"
              >
                Open Scheduler
              </Link>
            </div>

            {/* TOOL GRID */}
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ToolCard
                title="Photo Review Tool"
                description="Capture jobsite photos, document visible conditions, and organize repair notes."
                href="/inspections"
              />
              <ToolCard
                title="Punch List"
                description="Track final walkthrough items, assign repairs, update status, and print closeout reports."
                href="/punch-list"
              />
              <ToolCard
                title="Project Scheduler"
                description="Schedule trades, track vendor dates, and manage jobs for today and this week."
                href="/project-scheduler"
              />
              <ToolCard
                title="Cost Estimator"
                description="Build repair pricing with labor, materials, local tax, and owner-facing estimate totals."
                href="/cost-estimator"
              />
              <ToolCard
                title="Project Tracker"
                description="Track open jobs, materials, scheduling, and repair progress."
                href="/project-tracker"
              />
              <ToolCard
                title="Operation Hub"
                description="Access internal repair workflows, forms, and maintenance support tools."
                href="/operation-assistant"
              />
              <ToolCard
  title="Time Clock Employees"
  description="Clock employees in and out against Project Scheduler items."
  href="/time-clock-employees"
/>
            </div>

            {/* DISCLAIMER */}
            <div className="mt-8 rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] p-4 text-xs leading-6 text-[#5b564c]">
              5Tools supports general maintenance, repair workflow, project scheduling,
              punch list closeout, and visual documentation. It does not provide licensed
              inspections, engineering opinions, or certified reports.
            </div>
          </div>

          {/* RIGHT SIDE (PHOTOS — UNCHANGED STRUCTURE) */}
          <div className="hidden lg:block">
            <div className="grid h-[600px] grid-cols-2 grid-rows-3 gap-4">
              <PhotoTile
                src="/cabinet-install.jpg"
                alt="Contractor installing cabinets"
                className="col-span-2 row-span-2"
              />
              <PhotoTile src="/outlet-repair.jpg" alt="Replacing outlet" />
              <PhotoTile src="/trim-repair.jpg" alt="Trim repair" />
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}