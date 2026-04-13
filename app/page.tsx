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
      className="block rounded-2xl border border-slate-300 bg-white p-6 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
    >
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-200 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-2xl border border-slate-300 bg-slate-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">
            Aspen NW Real Estate LLC
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Property management tools dashboard
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ToolCard
            title="Photo Inspection"
            description="Area-based inspection with comments, photos, and repair notes."
            href="/inspections"
          />

          <ToolCard
            title="Project Tracker"
            description="Track repair projects, scopes, notes, and progress."
            href="/project-tracker"
          />
        </div>
      </div>
    </main>
  );
}