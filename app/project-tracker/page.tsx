"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type ProjectRow = {
  id: string;
  title: string | null;
  property: string | null;
  status: string | null;
  priority: string | null;
  assignedto: string | null;
  duedate: string | null;
  budget: number | null;
  actualcost: number | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FormState = {
  id: string;
  title: string;
  property: string;
  status: string;
  priority: string;
  assignedto: string;
  duedate: string;
  budget: string;
  actualcost: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  id: "",
  title: "",
  property: "",
  status: "Not Started",
  priority: "Medium",
  assignedto: "",
  duedate: "",
  budget: "",
  actualcost: "",
  notes: "",
});

function moneyNumber(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyDisplay(value: number | null | undefined) {
  return `$${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ProjectTrackerPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  async function loadProjects() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("project_tracker")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Load failed: ${error.message}`);
      setLoading(false);
      return;
    }

    setProjects((data as ProjectRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm());
    setMessage("Ready for a new project.");
  }

  async function saveProject() {
    if (!form.title.trim()) {
      setMessage("Project title is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      title: form.title.trim(),
      property: form.property.trim(),
      status: form.status,
      priority: form.priority,
      assignedto: form.assignedto.trim(),
      duedate: form.duedate || null,
      budget: moneyNumber(form.budget),
      actualcost: moneyNumber(form.actualcost),
      notes: form.notes.trim(),
      updated_at: new Date().toISOString(),
    };

    let error: { message: string } | null = null;

    if (form.id) {
      const res = await supabase
        .from("project_tracker")
        .update(payload)
        .eq("id", form.id);
      error = res.error;
    } else {
      const res = await supabase.from("project_tracker").insert(payload);
      error = res.error;
    }

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    await loadProjects();
    resetForm();
    setMessage("Project saved.");
    setSaving(false);
  }

  function editProject(project: ProjectRow) {
    setForm({
      id: project.id,
      title: project.title || "",
      property: project.property || "",
      status: project.status || "Not Started",
      priority: project.priority || "Medium",
      assignedto: project.assignedto || "",
      duedate: project.duedate || "",
      budget: project.budget?.toString() || "",
      actualcost: project.actualcost?.toString() || "",
      notes: project.notes || "",
    });

    setMessage("Project loaded for editing.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProject(id: string) {
    const confirmed = window.confirm("Delete this project?");
    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("project_tracker")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      return;
    }

    if (form.id === id) {
      setForm(emptyForm());
    }

    await loadProjects();
    setMessage("Project deleted.");
  }

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter((project) => {
      return (
        (project.title || "").toLowerCase().includes(q) ||
        (project.property || "").toLowerCase().includes(q) ||
        (project.status || "").toLowerCase().includes(q) ||
        (project.priority || "").toLowerCase().includes(q) ||
        (project.assignedto || "").toLowerCase().includes(q)
      );
    });
  }, [projects, search]);

  const totalProjects = projects.length;
  const openProjects = projects.filter(
    (p) => (p.status || "") !== "Complete"
  ).length;
  const completedProjects = projects.filter(
    (p) => (p.status || "") === "Complete"
  ).length;
  const budgetTotal = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
  const actualTotal = projects.reduce(
    (sum, p) => sum + Number(p.actualcost || 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Project Tracker
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Track jobs, budgets, due dates, and saved project details.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadProjects}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                {loading ? "Reloading..." : "Reload Cloud"}
              </button>

              <button
                onClick={saveProject}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                {saving ? "Saving..." : form.id ? "Update Project" : "Save Project"}
              </button>

              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                New Project
              </button>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Total Projects</div>
            <div className="mt-2 text-3xl font-bold">{totalProjects}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Open Projects</div>
            <div className="mt-2 text-3xl font-bold">{openProjects}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Completed</div>
            <div className="mt-2 text-3xl font-bold">{completedProjects}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Budget Total</div>
            <div className="mt-2 text-3xl font-bold">{moneyDisplay(budgetTotal)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Actual Total</div>
            <div className="mt-2 text-3xl font-bold">{moneyDisplay(actualTotal)}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">
            {form.id ? "Edit Project" : "New Project"}
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Project Name</label>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Unit turn, plumbing repair, paint, etc."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Property</label>
              <input
                value={form.property}
                onChange={(e) => update("property", e.target.value)}
                placeholder="123 Main St"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>On Hold</option>
                <option>Complete</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => update("priority", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Assigned To</label>
              <input
                value={form.assignedto}
                onChange={(e) => update("assignedto", e.target.value)}
                placeholder="Vendor, manager, handyman"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Due Date</label>
              <input
                type="date"
                value={form.duedate}
                onChange={(e) => update("duedate", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Budget</label>
              <input
                value={form.budget}
                onChange={(e) => update("budget", e.target.value)}
                placeholder="2500"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Actual Cost</label>
              <input
                value={form.actualcost}
                onChange={(e) => update("actualcost", e.target.value)}
                placeholder="1800"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Scope of work, owner approval notes, scheduling notes, material notes"
              className="min-h-[120px] w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={saveProject}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              {saving ? "Saving..." : form.id ? "Update Project" : "Save Project"}
            </button>

            <button
              onClick={resetForm}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Clear Form
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-semibold">Saved Projects</h2>

            <div className="w-full md:w-80">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-5">
            {filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                {loading ? "Loading projects..." : "No saved projects yet."}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-slate-200 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {project.title || "Untitled Project"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {project.property || "No property entered"}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs">
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          {project.status || "No Status"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          {project.priority || "No Priority"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                      <div>
                        <span className="font-medium text-slate-800">Assigned To:</span>{" "}
                        {project.assignedto || "-"}
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Due Date:</span>{" "}
                        {project.duedate || "-"}
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Budget:</span>{" "}
                        {moneyDisplay(project.budget)}
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">Actual Cost:</span>{" "}
                        {moneyDisplay(project.actualcost)}
                      </div>
                    </div>

                    {project.notes ? (
                      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {project.notes}
                      </div>
                    ) : null}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => editProject(project)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteProject(project.id)}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}