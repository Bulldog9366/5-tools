"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type SupplyItem = {
  id: string;
  name: string;
  qty: string;
  cost: string;
  ordered: boolean;
  received: boolean;
};

type ProjectStatus = "Not Started" | "In Progress" | "On Hold" | "Completed";
type ProjectPriority = "Low" | "Medium" | "High" | "Urgent";

type Project = {
  id: string;
  title: string;
  property: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  assignedTo: string;
  dueDate: string;
  budget: string;
  actualCost: string;
  notes: string;
  supplies: SupplyItem[];
  created_at: string;
  updated_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function createSupply(): SupplyItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    qty: "",
    cost: "",
    ordered: false,
    received: false,
  };
}

function createEmptyProject(): Project {
  return {
    id: "",
    title: "",
    property: "",
    status: "Not Started",
    priority: "Medium",
    assignedTo: "",
    dueDate: "",
    budget: "",
    actualCost: "",
    notes: "",
    supplies: [createSupply()],
    created_at: "",
    updated_at: "",
  };
}

function parseMoney(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = Number(cleaned || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number): string {
  const amount = typeof value === "number" ? value : parseMoney(value);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusClass(status: ProjectStatus): string {
  switch (status) {
    case "In Progress":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "On Hold":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "Completed":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function priorityClass(priority: ProjectPriority): string {
  switch (priority) {
    case "High":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Urgent":
      return "bg-red-100 text-red-700 border-red-200";
    case "Low":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
  }
}

export default function Page() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<Project>(createEmptyProject());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadCloud();
  }, []);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;

    return projects.filter((project) => {
      const supplyText = (project.supplies || []).map((item) => item.name).join(" ");
      const haystack = [
        project.title,
        project.property,
        project.assignedTo,
        project.status,
        project.priority,
        project.notes,
        supplyText,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [projects, search]);

  const totals = useMemo(() => {
    const totalBudget = projects.reduce((sum, project) => sum + parseMoney(project.budget), 0);
    const totalActual = projects.reduce((sum, project) => sum + parseMoney(project.actualCost), 0);
    const totalSupply = projects.reduce(
      (sum, project) =>
        sum + (project.supplies || []).reduce((sub, item) => sub + parseMoney(item.cost), 0),
      0
    );

    return {
      totalProjects: projects.length,
      openProjects: projects.filter((project) => project.status !== "Completed").length,
      completedProjects: projects.filter((project) => project.status === "Completed").length,
      totalBudget,
      totalActual,
      totalSupply,
    };
  }, [projects]);

  async function loadCloud() {
    if (!supabase) {
      setMessage("Supabase is not connected. Check your .env.local file.");
      return;
    }

    setLoadingCloud(true);
    setMessage("");

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    setLoadingCloud(false);

    if (error) {
      setMessage(`Load failed: ${error.message}`);
      return;
    }

    const cleaned: Project[] = (data || []).map((row: any) => ({
      id: String(row.id ?? crypto.randomUUID()),
      title: row.title ?? "",
      property: row.property ?? "",
      status: row.status ?? "Not Started",
      priority: row.priority ?? "Medium",
      assignedTo: row.assignedTo ?? "",
      dueDate: row.dueDate ?? "",
      budget: row.budget ?? "",
      actualCost: row.actualCost ?? "",
      notes: row.notes ?? "",
      supplies: Array.isArray(row.supplies) && row.supplies.length ? row.supplies : [createSupply()],
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
    }));

    setProjects(cleaned);
    setMessage("Projects loaded from cloud.");
  }

  async function saveCloud(nextProjects: Project[]) {
    if (!supabase) {
      setMessage("Supabase is not connected. Check your .env.local file.");
      return;
    }

    setSavingCloud(true);
    setMessage("");

    const payload = nextProjects.map((project) => ({
      ...project,
      supplies: (project.supplies || []).filter(
        (item) => item.name.trim() || item.qty.trim() || item.cost.trim()
      ),
    }));

    const { error } = await supabase.from("projects").upsert(payload, {
      onConflict: "id",
    });

    setSavingCloud(false);

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      return;
    }

    setProjects(nextProjects);
    setMessage("Projects saved to cloud.");
  }

  function updateForm<K extends keyof Project>(field: K, value: Project[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addSupplyRow() {
    setForm((prev) => ({
      ...prev,
      supplies: [...prev.supplies, createSupply()],
    }));
  }

  function updateSupply(id: string, field: keyof SupplyItem, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      supplies: prev.supplies.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeSupply(id: string) {
    setForm((prev) => {
      const nextSupplies = prev.supplies.filter((item) => item.id !== id);
      return {
        ...prev,
        supplies: nextSupplies.length ? nextSupplies : [createSupply()],
      };
    });
  }

  function resetForm() {
    setForm(createEmptyProject());
    setEditingId(null);
  }

  async function handleSaveProject() {
    if (!form.title.trim()) {
      setMessage("Project name is required.");
      return;
    }

    const now = new Date().toISOString();
    const cleanedSupplies = form.supplies.filter(
      (item) => item.name.trim() || item.qty.trim() || item.cost.trim()
    );

    const projectToSave: Project = {
      ...form,
      id: editingId || crypto.randomUUID(),
      supplies: cleanedSupplies.length ? cleanedSupplies : [createSupply()],
      created_at: editingId ? form.created_at : now,
      updated_at: now,
    };

    const nextProjects = editingId
      ? projects.map((project) => (project.id === editingId ? projectToSave : project))
      : [projectToSave, ...projects];

    setProjects(nextProjects);
    await saveCloud(nextProjects);
    resetForm();
  }

  function handleEdit(project: Project) {
    setForm({
      ...project,
      supplies: project.supplies?.length ? project.supplies : [createSupply()],
    });
    setEditingId(project.id);
    setExpanded((prev) => ({ ...prev, [project.id]: true }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    const nextProjects = projects.filter((project) => project.id !== id);
    setProjects(nextProjects);
    await saveCloud(nextProjects);

    if (editingId === id) {
      resetForm();
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Project Tracker</h1>
              <p className="mt-2 text-sm text-slate-600">
                Track projects, budgets, due dates, supply needs, and cloud saved job status.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadCloud()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
              >
                {loadingCloud ? "Loading..." : "Reload Cloud"}
              </button>

              <button
                onClick={() => void saveCloud(projects)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                {savingCloud ? "Saving..." : "Save All"}
              </button>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Total Projects</div>
            <div className="mt-2 text-3xl font-bold">{totals.totalProjects}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Open Projects</div>
            <div className="mt-2 text-3xl font-bold">{totals.openProjects}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Completed</div>
            <div className="mt-2 text-3xl font-bold">{totals.completedProjects}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Budget Total</div>
            <div className="mt-2 text-2xl font-bold">{formatMoney(totals.totalBudget)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Actual Total</div>
            <div className="mt-2 text-2xl font-bold">{formatMoney(totals.totalActual)}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Supply Estimate</div>
            <div className="mt-2 text-2xl font-bold">{formatMoney(totals.totalSupply)}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit Project" : "New Project"}
            </h2>

            {editingId ? (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Project Name</span>
              <input
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                placeholder="Unit turn, plumbing repair, paint, etc."
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Property</span>
              <input
                value={form.property}
                onChange={(e) => updateForm("property", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                placeholder="123 Main St"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Assigned To</span>
              <input
                value={form.assignedTo}
                onChange={(e) => updateForm("assignedTo", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                placeholder="Vendor, manager, handyman"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Due Date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => updateForm("dueDate", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Status</span>
              <select
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value as ProjectStatus)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>On Hold</option>
                <option>Completed</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Priority</span>
              <select
                value={form.priority}
                onChange={(e) => updateForm("priority", e.target.value as ProjectPriority)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Budget</span>
              <input
                value={form.budget}
                onChange={(e) => updateForm("budget", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                placeholder="2500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Actual Cost</span>
              <input
                value={form.actualCost}
                onChange={(e) => updateForm("actualCost", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                placeholder="1800"
              />
            </label>

            <label className="block md:col-span-2 xl:col-span-4">
              <span className="mb-1 block text-sm font-medium">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                className="min-h-[90px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                placeholder="Scope of work, owner approval notes, scheduling notes, material notes"
              />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Supply Needed List</h3>
              <button
                type="button"
                onClick={addSupplyRow}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Add Supply Item
              </button>
            </div>

            <div className="space-y-3">
              {form.supplies.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-6"
                >
                  <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">Item {index + 1}</span>
                    <input
                      value={item.name}
                      onChange={(e) => updateSupply(item.id, "name", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      placeholder="Paint, trim, faucet, GFCI, lockset"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Qty</span>
                    <input
                      value={item.qty}
                      onChange={(e) => updateSupply(item.id, "qty", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      placeholder="2, 1 box, 40 lf"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Est. Cost</span>
                    <input
                      value={item.cost}
                      onChange={(e) => updateSupply(item.id, "cost", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                      placeholder="125"
                    />
                  </label>

                  <label className="flex items-center gap-2 self-end pb-2">
                    <input
                      type="checkbox"
                      checked={item.ordered}
                      onChange={(e) => updateSupply(item.id, "ordered", e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Ordered</span>
                  </label>

                  <div className="flex items-end justify-between gap-3">
                    <label className="flex items-center gap-2 pb-2">
                      <input
                        type="checkbox"
                        checked={item.received}
                        onChange={(e) => updateSupply(item.id, "received", e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Received</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeSupply(item.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void handleSaveProject()}
              className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              {editingId ? "Update Project" : "Save Project"}
            </button>

            <button
              onClick={resetForm}
              className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50"
            >
              Clear Form
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold">Projects</h2>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
              placeholder="Search projects, property, notes, supplies"
            />
          </div>

          <div className="grid gap-4">
            {filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500">
                No projects saved yet.
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isOpen = expanded[project.id] ?? false;

                return (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-slate-900">{project.title}</div>
                        <div className="text-sm text-slate-600">{project.property || "No property"}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                            project.status
                          )}`}
                        >
                          {project.status}
                        </span>

                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass(
                            project.priority
                          )}`}
                        >
                          {project.priority}
                        </span>

                        <button
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [project.id]: !isOpen,
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-100"
                        >
                          {isOpen ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <span className="font-semibold">Assigned:</span> {project.assignedTo || "—"}
                          </div>
                          <div>
                            <span className="font-semibold">Due:</span> {project.dueDate || "—"}
                          </div>
                          <div>
                            <span className="font-semibold">Budget:</span>{" "}
                            {project.budget ? formatMoney(project.budget) : "—"}
                          </div>
                          <div>
                            <span className="font-semibold">Actual:</span>{" "}
                            {project.actualCost ? formatMoney(project.actualCost) : "—"}
                          </div>
                        </div>

                        {project.notes ? (
                          <div className="rounded-xl bg-white p-3 text-sm text-slate-700">
                            <span className="font-semibold">Notes:</span> {project.notes}
                          </div>
                        ) : null}

                        <div>
                          <div className="mb-2 text-sm font-semibold text-slate-800">Supplies</div>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {project.supplies?.length ? (
                              project.supplies.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
                                >
                                  <div className="font-semibold text-slate-900">{item.name || "Unnamed Item"}</div>
                                  <div className="mt-1 text-slate-600">Qty: {item.qty || "—"}</div>
                                  <div className="text-slate-600">
                                    Cost: {item.cost ? formatMoney(item.cost) : "—"}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    {item.ordered ? (
                                      <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-700">
                                        Ordered
                                      </span>
                                    ) : null}
                                    {item.received ? (
                                      <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                                        Received
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-slate-500">No supplies listed.</div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleEdit(project)}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void handleDelete(project.id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}