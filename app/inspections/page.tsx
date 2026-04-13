"use client";

import React, { useEffect, useMemo, useState } from "react";

type TrackerItem = {
  id: string;
  title: string;
  status: string;
  assignedTo: string;
  dueDate: string;
  notes: string;
  updatedAt: string;
};

const STORAGE_KEY = "project-tracker-items-v1";
const STATUS_OPTIONS = ["Not Started", "In Progress", "Waiting", "Done"];

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createBlankItem(): TrackerItem {
  return {
    id: uid(),
    title: "",
    status: "Not Started",
    assignedTo: "",
    dueDate: "",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function safeParseItems(raw: string | null): TrackerItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ProjectTrackerPage() {
  const [items, setItems] = useState<TrackerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [item, setItem] = useState<TrackerItem>(createBlankItem());
  const [statusMessage, setStatusMessage] = useState<string>("Ready");

  useEffect(() => {
    const saved = safeParseItems(localStorage.getItem(STORAGE_KEY));
    setItems(saved);

    if (saved.length > 0) {
      const mostRecent = [...saved].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      setItem(mostRecent);
      setSelectedId(mostRecent.id);
    }
  }, []);

  const sortedItems = useMemo(() => {
    return [...items].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [items]);

  function flashStatus(message: string): void {
    setStatusMessage(message);
    window.setTimeout(() => {
      setStatusMessage("Ready");
    }, 2200);
  }

  function normalizeItem(source: TrackerItem): TrackerItem {
    return {
      ...source,
      title: source.title.trim() || "Untitled Task",
      assignedTo: source.assignedTo.trim(),
      notes: source.notes,
      updatedAt: new Date().toISOString(),
    };
  }

  function updateField<K extends keyof TrackerItem>(
    key: K,
    value: TrackerItem[K]
  ): void {
    setItem((prev) => ({
      ...prev,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  }

  function createNewItem(): void {
    const fresh = createBlankItem();
    setItem(fresh);
    setSelectedId(fresh.id);
    flashStatus("Started new item");
  }

  function saveToDevice(): void {
    const toSave = normalizeItem(item);

    setItem(toSave);
    setSelectedId(toSave.id);

    setItems((prev) => {
      const exists = prev.some((x) => x.id === toSave.id);
      const next = exists
        ? prev.map((x) => (x.id === toSave.id ? toSave : x))
        : [toSave, ...prev];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    flashStatus("Saved to device");
  }

  function loadFromDevice(id: string): void {
    const found = items.find((x) => x.id === id);
    if (!found) return;
    setItem(found);
    setSelectedId(found.id);
    flashStatus("Loaded from device");
  }

  function deleteFromDevice(): void {
    if (!item.id) return;

    const ok = window.confirm("Delete this item from this device?");
    if (!ok) return;

    const next = items.filter((x) => x.id !== item.id);
    setItems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    if (next.length > 0) {
      setItem(next[0]);
      setSelectedId(next[0].id);
    } else {
      const fresh = createBlankItem();
      setItem(fresh);
      setSelectedId(fresh.id);
    }

    flashStatus("Deleted from device");
  }

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Project Tracker</h1>
              <p className="mt-1 text-sm text-slate-600">
                Local-only safe version so build will pass.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={createNewItem}
                className="rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-100"
              >
                New Item
              </button>
              <button
                onClick={saveToDevice}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
              >
                Save
              </button>
              <button
                onClick={deleteFromDevice}
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-300 bg-white p-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Saved Items
              </label>
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  loadFromDevice(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 outline-none focus:border-slate-500"
              >
                <option value="">Select saved item</option>
                {sortedItems.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title} — {x.status}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-white p-4">
              <div className="text-sm font-semibold text-slate-700">Status</div>
              <div className="mt-2 min-h-[44px] text-sm text-slate-600">
                {statusMessage}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Last updated: {formatDateTime(item.updatedAt)}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
          <h2 className="text-xl font-bold">Task</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field
              label="Title"
              value={item.title}
              onChange={(value) => updateField("title", value)}
              placeholder="Task title"
            />

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Status
              </label>
              <select
                value={item.status}
                onChange={(e) => updateField("status", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-slate-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <Field
              label="Assigned To"
              value={item.assignedTo}
              onChange={(value) => updateField("assignedTo", value)}
              placeholder="Assigned person"
            />

            <Field
              label="Due Date"
              value={item.dueDate}
              onChange={(value) => updateField("dueDate", value)}
              type="date"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Notes
            </label>
            <textarea
              value={item.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-slate-500"
              placeholder="Notes"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-slate-500"
      />
    </div>
  );
}