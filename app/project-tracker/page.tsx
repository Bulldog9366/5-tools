"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type SupplyItem = {
  id: string;
  name: string;
  qty: string;
  cost: string;
};

type Project = {
  id: number;
  title: string;
  property: string;
  supplies: SupplyItem[];
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function emptySupply(): SupplyItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    qty: "",
    cost: "",
  };
}
function getProjectSupplyTotal(project: Project) {
  return (project.supplies || []).reduce((sum, item) => {
    const value = Number(String(item.cost).replace(/[^\d.]/g, "")) || 0;
    return sum + value;
  }, 0);
}
export default function Page() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<{
    title: string;
    property: string;
    supplies: SupplyItem[];
  }>({
    title: "",
    property: "",
    supplies: [],
  });

  useEffect(() => {
    void loadCloud();
  }, []);

  async function loadCloud() {
    setLoadingCloud(true);
    setMessage("");

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("id", { ascending: false });

    setLoadingCloud(false);

    if (error) {
      setMessage(`Load failed: ${error.message}`);
      return;
    }

    setProjects((data as Project[]) || []);
    setMessage("Projects loaded from cloud.");
  }

  async function saveCloud(updated: Project[]) {
    setSavingCloud(true);
    setMessage("");

    const { error } = await supabase.from("projects").upsert(updated);

    setSavingCloud(false);

    if (error) {
      setMessage(`Save failed: ${error.message}`);
      return;
    }

    setProjects(updated);
    setMessage("Projects saved to cloud.");
  }

  function addSupply() {
    setForm((prev) => ({
      ...prev,
      supplies: [...prev.supplies, emptySupply()],
    }));
  }

  function updateSupply(index: number, field: keyof SupplyItem, value: string) {
    const copy = [...form.supplies];
    copy[index] = {
      ...copy[index],
      [field]: value,
    };
    setForm((prev) => ({ ...prev, supplies: copy }));
  }

  function removeSupply(index: number) {
    const copy = [...form.supplies];
    copy.splice(index, 1);
    setForm((prev) => ({ ...prev, supplies: copy }));
  }

  function resetForm() {
    setForm({
      title: "",
      property: "",
      supplies: [],
    });
    setEditingId(null);
  }

  async function saveProject() {
    if (!form.title.trim()) {
      setMessage("Project name is required.");
      return;
    }

    const cleanedSupplies = form.supplies.filter(
      (s) => s.name.trim() || s.qty.trim() || s.cost.trim()
    );

    const projectToSave: Project = {
      id: editingId ?? Date.now(),
      title: form.title,
      property: form.property,
      supplies: cleanedSupplies,
    };

    const updated = editingId
      ? projects.map((p) => (p.id === editingId ? projectToSave : p))
      : [projectToSave, ...projects];

    await saveCloud(updated);
    resetForm();
  }

  function editProject(project: Project) {
    setForm({
      title: project.title || "",
      property: project.property || "",
      supplies: project.supplies?.length
        ? project.supplies
        : [],
    });
    setEditingId(project.id);
    setExpanded((prev) => ({ ...prev, [project.id]: true }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProject(id: number) {
    const updated = projects.filter((p) => p.id !== id);
    await saveCloud(updated);

    if (editingId === id) {
      resetForm();
    }
  }

  const totalSupplyEstimate = useMemo(() => {
    return projects.reduce((sum, project) => {
      return (
        sum +
        (project.supplies || []).reduce((sub, item) => {
          const value = Number(String(item.cost).replace(/[^\d.]/g, "")) || 0;
          return sub + value;
        }, 0)
      );
    }, 0);
  }, [projects]);

  function formatMoney(value: string | number) {
    const num =
      typeof value === "number"
        ? value
        : Number(String(value).replace(/[^\d.]/g, "")) || 0;

    return num.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-300 bg-slate-100 p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Project Tracker</h1>
              <p className="mt-2 text-sm text-slate-700">
                Track jobs, supplies, budgets, and saved project details.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadCloud()}
                className="rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                {loadingCloud ? "Loading..." : "Reload Cloud"}
              </button>

              <button
                onClick={() => void saveCloud(projects)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm">
            <div className="text-sm text-slate-600">Total Projects</div>
            <div className="mt-2 text-3xl font-bold">{projects.length}</div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm">
            <div className="text-sm text-slate-600">Supply Estimate</div>
            <div className="mt-2 text-3xl font-bold">
              {formatMoney(totalSupplyEstimate)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 shadow-sm">
            <div className="text-sm text-slate-600">Saved in Cloud</div>
            <div className="mt-2 text-3xl font-bold">{projects.length}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-slate-100 p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit Project" : "New Project"}
            </h2>

            {editingId ? (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Project Name</span>
              <input
                placeholder="Project Name"
                className="w-full rounded-xl border border-slate-400 bg-white px-3 py-2 outline-none focus:border-slate-600"
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Property</span>
              <input
                placeholder="Property"
                className="w-full rounded-xl border border-slate-400 bg-white px-3 py-2 outline-none focus:border-slate-600"
                value={form.property}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, property: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-300 bg-slate-200 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Supplies Needed</h3>
              <button
                onClick={addSupply}
                className="rounded-xl border border-slate-400 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                + Add Supply
              </button>
            </div>

            <div className="space-y-3">
              {form.supplies.map((s, i) => (
                <div
                  key={s.id}
                  className="grid gap-3 rounded-2xl border border-slate-300 bg-slate-100 p-4 md:grid-cols-[1.6fr_.8fr_.8fr_auto]"
                >
                  <input
                    placeholder="Item"
                    className="rounded-xl border border-slate-400 bg-white px-3 py-2 outline-none focus:border-slate-600"
                    value={s.name}
                    onChange={(e) => updateSupply(i, "name", e.target.value)}
                  />
                  <input
                    placeholder="Qty"
                    className="rounded-xl border border-slate-400 bg-white px-3 py-2 outline-none focus:border-slate-600"
                    value={s.qty}
                    onChange={(e) => updateSupply(i, "qty", e.target.value)}
                  />
                  <input
                    placeholder="Cost"
                    className="rounded-xl border border-slate-400 bg-white px-3 py-2 outline-none focus:border-slate-600"
                    value={s.cost}
                    onChange={(e) => updateSupply(i, "cost", e.target.value)}
                  />
                  <button
                    onClick={() => removeSupply(i)}
                    className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void saveProject()}
              className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-800"
            >
              {editingId ? "Update Project" : "Save Project"}
            </button>

            <button
              onClick={resetForm}
              className="rounded-xl border border-slate-400 bg-white px-5 py-2.5 font-semibold hover:bg-slate-50"
            >
              Clear Form
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-slate-100 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Saved Projects</h2>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-400 bg-slate-50 px-6 py-10 text-center text-slate-600">
                No saved projects yet.
              </div>
            ) : (
              projects.map((p) => {
                const isOpen = expanded[p.id] ?? false;

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-300 bg-slate-50 shadow-sm"
                  >
                    <button
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [p.id]: !isOpen,
                        }))
                      }
                      className="flex w-full items-center justify-between rounded-t-2xl px-4 py-4 text-left hover:bg-slate-100"
                    >
                      <div>
                      <div className="text-lg font-semibold text-slate-900">
                      {p.title || "Untitled Project"}
                      </div>
                      <div className="text-sm text-slate-600">
                      {p.property || "No property entered"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                           {(p.supplies?.length || 0)} item{(p.supplies?.length || 0) === 1 ? "" : "s"} •{" "}
                            {formatMoney(getProjectSupplyTotal(p))}
                      </div>
                      </div>

                      <div className="text-sm font-semibold text-slate-700">
                        {isOpen ? "Hide" : "View"}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-300 px-4 py-4">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => editProject(p)}
                            className="rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void deleteProject(p.id)}
                            className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>

                        <div className="mb-3 text-sm font-semibold text-slate-800">
                          Supplies
                        </div>

                        <div className="space-y-2">
                          {p.supplies?.length ? (
                            p.supplies.map((s, i) => (
                              <div
                                key={`${p.id}-${i}`}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                              >
                                {s.name || "Item"}
                                {s.qty ? ` - ${s.qty}` : ""}
                                {s.cost ? ` - ${formatMoney(s.cost)}` : ""}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-500">
                              No supplies listed.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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