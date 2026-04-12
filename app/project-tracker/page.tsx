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
      className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
    >
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">5Tools</h1>
          <p className="mt-2 text-sm text-slate-600">
            Operations tools for project tracking, tenant intake, inspections, and more.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ToolCard
            title="Project Tracker"
            description="Track jobs, supplies, budgets, and progress."
            href="/project-tracker"
          />
          <ToolCard
            title="Tenant Intake"
            description="Tenant intake checklist and move-in workflow."
            href="/tenant-intake"
          />
          <ToolCard
            title="Property Intake"
            description="Property management onboarding and intake."
            href="/property-intake"
          />
          <ToolCard
            title="Inspection App"
            description="Inspection reporting and field notes."
            href="/inspection"
          />
          <ToolCard
            title="Estimates"
            description="Build and manage project estimates."
            href="/estimates"
          />
        </div>
      </div>
    </main>
  );
}