"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

type SupplyItem = {
  id: string;
  item: string;
  qty: string;
  unitcost: string;
  vendor: string;
  notes: string;
};

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
  supplies: SupplyItem[] | null;
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
  supplies: SupplyItem[];
};

type SchedulerBridgeItem = {
  id?: string;
  title?: string;
  property?: string;
  status?: string;
  priority?: string;
  assignedto?: string;
  duedate?: string;
  budget?: number;
  actualcost?: number;
  notes?: string;
  supplies?: SupplyItem[] | null;
  createdAt?: string;
  updatedAt?: string;
  propertyAddress?: string;
  trade?: string;
  vendor?: string;
  description?: string;
  scheduledDate?: string;
  dateScheduled?: string;
  assignedTo?: string;
};

type WorkOrderTrackerQueueItem = {
  sourceId?: string;
  source?: string;
  workOrderNumber?: string;
  title?: string;
  propertyAddress?: string;
  status?: string;
  priority?: string;
  scopeOfWork?: string;
  vendorName?: string;
  assignedTo?: string;
  cost?: number;
  createdAt?: string;
};

const SCHEDULER_BRIDGE_KEY = "project_tracker";
const WORK_ORDER_TRACKER_QUEUE_KEY = "five_tools_project_tracker_queue_v1";

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Work Orders", href: "/work-order-engine" },
  { label: "Pricing", href: "/work-order-pricing" },
  { label: "Scheduler", href: "/project-scheduler" },
  { label: "Tracker", href: "/project-tracker" },
  { label: "Service Tickets", href: "/service-ticket" },
  { label: "Inventory", href: "/truck-inventory" },
];

const emptySupply = (): SupplyItem => ({
  id: crypto.randomUUID(),
  item: "",
  qty: "",
  unitcost: "",
  vendor: "",
  notes: "",
});

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
  supplies: [],
});

function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseQty(value: string) {
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

function supplyLineTotal(item: SupplyItem) {
  return parseQty(item.qty) * parseMoney(item.unitcost);
}

function suppliesTotal(items: SupplyItem[]) {
  return items.reduce((sum, item) => sum + supplyLineTotal(item), 0);
}

function normalizeSupplies(value: unknown): SupplyItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Partial<SupplyItem>;
    return {
      id: row.id || crypto.randomUUID(),
      item: row.item || "",
      qty: row.qty || "",
      unitcost: row.unitcost || "",
      vendor: row.vendor || "",
      notes: row.notes || "",
    };
  });
}

function mapSchedulerStatus(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "Complete";
    case "in progress":
      return "In Progress";
    case "on hold":
      return "On Hold";
    case "new":
      return "Not Started";
    case "scheduled":
      return "Not Started";
    case "canceled":
      return "On Hold";
    default:
      return "Not Started";
  }
}

function mapSchedulerPriority(priority?: string) {
  const normalized = (priority || "").toLowerCase();
  if (normalized === "low") return "Low";
  if (normalized === "high") return "High";
  if (normalized === "urgent") return "Urgent";
  return "Medium";
}

function schedulerItemToProject(item: SchedulerBridgeItem): ProjectRow {
  const title = (item.title || "").trim();
  const property = (item.property || item.propertyAddress || "").trim();
  const status = (item.status || "").trim();
  const priority = (item.priority || "").trim();
  const assignedto = (item.assignedto || item.assignedTo || "").trim();
  const duedate = (
    item.duedate ||
    item.scheduledDate ||
    item.dateScheduled ||
    ""
  ).trim();
  const notes = (item.notes || "").trim();

  if (title || property || notes) {
    return {
      id: crypto.randomUUID(),
      title: title || property || "Imported Scheduler Project",
      property,
      status: mapSchedulerStatus(status),
      priority: mapSchedulerPriority(priority),
      assignedto,
      duedate: duedate || null,
      budget: Number(item.budget || 0),
      actualcost: Number(item.actualcost || 0),
      notes,
      supplies: normalizeSupplies(item.supplies),
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: item.updatedAt || new Date().toISOString(),
    };
  }

  const trade = (item.trade || "").trim();
  const vendor = (item.vendor || "").trim();
  const description = (item.description || "").trim();

  const titleParts = [trade, description].filter(Boolean);
  const fallbackTitle =
    titleParts.length > 0
      ? titleParts.join(" - ").slice(0, 160)
      : property || "Imported Scheduler Project";

  const noteParts = [
    trade ? `Trade: ${trade}` : "",
    vendor ? `Vendor: ${vendor}` : "",
    description ? `Requested Work: ${description}` : "",
  ].filter(Boolean);

  return {
    id: crypto.randomUUID(),
    title: fallbackTitle,
    property,
    status: mapSchedulerStatus(status),
    priority: mapSchedulerPriority(priority),
    assignedto,
    duedate: duedate || null,
    budget: 0,
    actualcost: 0,
    notes: noteParts.join("\n"),
    supplies: [],
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  };
}

function mapWorkOrderStatus(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "completed":
    case "closed":
      return "Complete";
    case "in progress":
    case "scheduled":
    case "approved":
      return "In Progress";
    case "canceled":
    case "cancelled":
    case "needs approval":
      return "On Hold";
    case "new":
    default:
      return "Not Started";
  }
}

function mapWorkOrderPriority(priority?: string) {
  switch ((priority || "").toLowerCase()) {
    case "emergency":
      return "Urgent";
    case "high":
      return "High";
    case "low":
      return "Low";
    case "routine":
    default:
      return "Medium";
  }
}

function workOrderQueueItemToProject(
  item: WorkOrderTrackerQueueItem,
): ProjectRow {
  const workOrderNumber = (item.workOrderNumber || item.sourceId || "").trim();
  const property = (item.propertyAddress || "").trim();
  const scope = (item.scopeOfWork || "").trim();
  const title =
    (item.title || "").trim() ||
    [property, workOrderNumber ? `Work Order ${workOrderNumber}` : "Work Order"]
      .filter(Boolean)
      .join(" - ") ||
    "Imported Work Order";

  const noteParts = [
    item.source ? `Source: ${item.source}` : "Source: Work Order Engine",
    workOrderNumber ? `Work Order #: ${workOrderNumber}` : "",
    scope ? `Scope of Work: ${scope}` : "",
    item.vendorName ? `Vendor: ${item.vendorName}` : "",
  ].filter(Boolean);

  return {
    id: crypto.randomUUID(),
    title,
    property,
    status: mapWorkOrderStatus(item.status),
    priority: mapWorkOrderPriority(item.priority),
    assignedto: (item.assignedTo || item.vendorName || "").trim(),
    duedate: null,
    budget: Number(item.cost || 0),
    actualcost: Number(item.cost || 0),
    notes: noteParts.join("\n"),
    supplies: [],
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "complete") return "bg-green-50 text-green-700 border-green-200";
  if (s === "in progress") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "on hold") return "bg-yellow-50 text-yellow-800 border-yellow-200";
  return "bg-white text-[#111] border-[#d8d2c4]";
}

function priorityBadgeClass(priority: string | null | undefined) {
  const p = (priority || "").toLowerCase();
  if (p === "urgent") return "bg-red-50 text-red-700 border-red-200";
  if (p === "high") return "bg-orange-50 text-orange-700 border-orange-200";
  if (p === "low") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export default function ProjectTrackerPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  const inputClass =
    "w-full rounded-xl border border-[#c9ab86] bg-[#fffaf3] px-3 py-2 text-sm text-[#2f1f14] outline-none transition focus:border-[#b57a32] focus:bg-white focus:ring-2 focus:ring-[#b57a32]/25";
  const buttonClass =
    "rounded-xl border border-[#c9ab86] bg-[#fffaf3] px-4 py-2 text-sm font-bold text-[#2f1f14] shadow-sm transition hover:border-[#b57a32] hover:bg-[#f3e6d4]";
  const goldButtonClass =
    "rounded-xl bg-[#b57a32] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#9c6b2f]";
  const cardClass =
    "rounded-2xl border border-[#c9ab86] bg-[#fffaf3] shadow-sm";

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

    const rows = ((data as ProjectRow[]) || []).map((project) => ({
      ...project,
      supplies: normalizeSupplies(project.supplies),
    }));

    setProjects(rows);
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

  function addSupplyLine() {
    setForm((prev) => ({
      ...prev,
      supplies: [...prev.supplies, emptySupply()],
    }));
  }

  function updateSupplyLine(
    id: string,
    field: keyof SupplyItem,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      supplies: prev.supplies.map((line) =>
        line.id === id ? { ...line, [field]: value } : line,
      ),
    }));
  }

  function removeSupplyLine(id: string) {
    setForm((prev) => ({
      ...prev,
      supplies: prev.supplies.filter((line) => line.id !== id),
    }));
  }

  function copySupplyTotalToActual() {
    setForm((prev) => ({
      ...prev,
      actualcost: suppliesTotal(prev.supplies).toFixed(2),
    }));
    setMessage("Actual Cost updated from supplies total.");
  }

  async function importFromScheduler() {
    setImporting(true);
    setMessage("");

    try {
      const raw = localStorage.getItem(SCHEDULER_BRIDGE_KEY);

      if (!raw) {
        setMessage("No scheduler items found to import.");
        setImporting(false);
        return;
      }

      const parsed = JSON.parse(raw) as SchedulerBridgeItem[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        setMessage("No scheduler items found to import.");
        setImporting(false);
        return;
      }

      const mapped = parsed.map(schedulerItemToProject);

      const existingFingerprints = new Set(
        projects.map((project) =>
          [
            (project.title || "").trim().toLowerCase(),
            (project.property || "").trim().toLowerCase(),
            (project.duedate || "").trim(),
            (project.notes || "").trim().toLowerCase(),
          ].join("|"),
        ),
      );

      const newRows = mapped.filter((row) => {
        const fingerprint = [
          (row.title || "").trim().toLowerCase(),
          (row.property || "").trim().toLowerCase(),
          (row.duedate || "").trim(),
          (row.notes || "").trim().toLowerCase(),
        ].join("|");

        return !existingFingerprints.has(fingerprint);
      });

      if (newRows.length === 0) {
        localStorage.removeItem(SCHEDULER_BRIDGE_KEY);
        setMessage("No new scheduler items to import.");
        setImporting(false);
        return;
      }

      const { error } = await supabase.from("project_tracker").insert(
        newRows.map((row) => ({
          id: row.id,
          title: row.title,
          property: row.property,
          status: row.status,
          priority: row.priority,
          assignedto: row.assignedto,
          duedate: row.duedate,
          budget: row.budget,
          actualcost: row.actualcost,
          notes: row.notes,
          supplies: row.supplies,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      );

      if (error) {
        setMessage(`Import failed: ${error.message}`);
        setImporting(false);
        return;
      }

      localStorage.removeItem(SCHEDULER_BRIDGE_KEY);
      await loadProjects();
      setMessage(
        `Imported ${newRows.length} scheduler item${
          newRows.length === 1 ? "" : "s"
        }. Scheduler import queue cleared.`,
      );
    } catch (error) {
      console.error(error);
      setMessage("Import from scheduler failed.");
    } finally {
      setImporting(false);
    }
  }

  async function importFromWorkOrderQueue() {
    setImporting(true);
    setMessage("");

    try {
      const raw = localStorage.getItem(WORK_ORDER_TRACKER_QUEUE_KEY);

      if (!raw) {
        setMessage("No Work Order Engine items found to import.");
        setImporting(false);
        return;
      }

      const parsed = JSON.parse(raw) as WorkOrderTrackerQueueItem[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        setMessage("No Work Order Engine items found to import.");
        setImporting(false);
        return;
      }

      const mapped = parsed.map(workOrderQueueItemToProject);

      const existingFingerprints = new Set(
        projects.map((project) =>
          [
            (project.title || "").trim().toLowerCase(),
            (project.property || "").trim().toLowerCase(),
            (project.notes || "").trim().toLowerCase(),
          ].join("|"),
        ),
      );

      const newRows = mapped.filter((row) => {
        const fingerprint = [
          (row.title || "").trim().toLowerCase(),
          (row.property || "").trim().toLowerCase(),
          (row.notes || "").trim().toLowerCase(),
        ].join("|");

        return !existingFingerprints.has(fingerprint);
      });

      if (newRows.length === 0) {
        localStorage.removeItem(WORK_ORDER_TRACKER_QUEUE_KEY);
        setMessage("No new Work Order Engine items to import.");
        setImporting(false);
        return;
      }

      const { error } = await supabase.from("project_tracker").insert(
        newRows.map((row) => ({
          id: row.id,
          title: row.title,
          property: row.property,
          status: row.status,
          priority: row.priority,
          assignedto: row.assignedto,
          duedate: row.duedate,
          budget: row.budget,
          actualcost: row.actualcost,
          notes: row.notes,
          supplies: row.supplies,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      );

      if (error) {
        setMessage(`Work Order import failed: ${error.message}`);
        setImporting(false);
        return;
      }

      localStorage.removeItem(WORK_ORDER_TRACKER_QUEUE_KEY);
      await loadProjects();
      setMessage(
        `Imported ${newRows.length} Work Order Engine item${
          newRows.length === 1 ? "" : "s"
        }. Tracker queue cleared.`,
      );
    } catch (error) {
      console.error(error);
      setMessage("Import from Work Order Engine failed.");
    } finally {
      setImporting(false);
    }
  }

  async function saveProject() {
    if (!form.title.trim()) {
      setMessage("Project title is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const cleanedSupplies = form.supplies
      .filter((line) => {
        return (
          line.item.trim() ||
          line.qty.trim() ||
          line.unitcost.trim() ||
          line.vendor.trim() ||
          line.notes.trim()
        );
      })
      .map((line) => ({
        id: line.id,
        item: line.item.trim(),
        qty: line.qty.trim(),
        unitcost: line.unitcost.trim(),
        vendor: line.vendor.trim(),
        notes: line.notes.trim(),
      }));

    const payload = {
      title: form.title.trim(),
      property: form.property.trim(),
      status: form.status,
      priority: form.priority,
      assignedto: form.assignedto.trim(),
      duedate: form.duedate || null,
      budget: parseMoney(form.budget),
      actualcost: parseMoney(form.actualcost),
      notes: form.notes.trim(),
      supplies: cleanedSupplies,
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

  async function quickAddProject() {
    const title = quickTitle.trim();
    if (!title) {
      setMessage("Enter a quick project name first.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("project_tracker").insert({
      title,
      property: "",
      status: "Not Started",
      priority: "Medium",
      assignedto: "",
      duedate: null,
      budget: 0,
      actualcost: 0,
      notes: "",
      supplies: [],
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(`Quick add failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setQuickTitle("");
    await loadProjects();
    setMessage("Quick project added. Select it to fill in details.");
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
      supplies: normalizeSupplies(project.supplies),
    });

    setMessage("Project loaded for editing.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createServiceTicketFromCurrentForm() {
    const scheduledDate = (form.duedate || "").trim();
    const scheduleValue = scheduledDate ? `${scheduledDate}T08:00` : "";

    const ticketSeed = {
      sourceProjectId: form.id || "",
      ticketNumber: `ST-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${Date.now().toString().slice(-5)}`,
      property: form.property || "",
      unit: "",
      tenant: "",
      assignedTo: form.assignedto || "",
      priority: form.priority || "Normal",
      trade: form.title || "",
      description: form.notes || form.title || "",
      scope: "",
      materials: normalizeSupplies(form.supplies)
        .map((line) =>
          [line.qty, line.item, line.vendor].filter(Boolean).join(" ").trim(),
        )
        .filter(Boolean)
        .join("\n"),
      schedule: scheduleValue,
      access: "",
      laborHours: "",
      materialCost: form.actualcost
        ? moneyDisplay(parseMoney(form.actualcost))
        : "",
      notes: "",
    };

    localStorage.setItem("serviceTicketSeed", JSON.stringify(ticketSeed));
    window.location.href = "/service-ticket";
  }


  function toggleProjectDetails(id: string) {
    setExpandedProjectIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function createServiceTicketFromProject(project: ProjectRow) {
    const scheduledDate = (project.duedate || "").trim();
    const scheduleValue = scheduledDate ? `${scheduledDate}T08:00` : "";

    const ticketSeed = {
      sourceProjectId: project.id,
      ticketNumber: `ST-${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${Date.now().toString().slice(-5)}`,
      property: project.property || "",
      unit: "",
      tenant: "",
      assignedTo: project.assignedto || "",
      priority: project.priority || "Normal",
      trade: project.title || "",
      description: project.notes || project.title || "",
      scope: "",
      materials: normalizeSupplies(project.supplies)
        .map((line) =>
          [line.qty, line.item, line.vendor].filter(Boolean).join(" ").trim(),
        )
        .filter(Boolean)
        .join("\n"),
      schedule: scheduleValue,
      access: "",
      laborHours: "",
      materialCost: project.actualcost ? moneyDisplay(project.actualcost) : "",
      notes: "",
    };

    localStorage.setItem("serviceTicketSeed", JSON.stringify(ticketSeed));
    window.location.href = "/service-ticket";
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

  const openProjects = projects.filter(
    (p) => (p.status || "") !== "Complete",
  ).length;
  const inProgressProjects = projects.filter(
    (p) => (p.status || "") === "In Progress",
  ).length;
  const completedProjects = projects.filter(
    (p) => (p.status || "") === "Complete",
  ).length;
  const criticalOpenProjects = projects.filter(
    (p) => (p.priority || "") === "Urgent" && (p.status || "") !== "Complete",
  ).length;
  const budgetTotal = projects.reduce(
    (sum, p) => sum + Number(p.budget || 0),
    0,
  );
  const actualTotal = projects.reduce(
    (sum, p) => sum + Number(p.actualcost || 0),
    0,
  );
  const allSuppliesTotal = projects.reduce(
    (sum, p) => sum + suppliesTotal(normalizeSupplies(p.supplies)),
    0,
  );
  const currentSupplyTotal = suppliesTotal(form.supplies);

  return (
    <main className="min-h-screen bg-[#ece3d4] text-[#1b1b1b]">
      <header className="border-b border-[#8b6b47] bg-[#f7f1e7] shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#9c6b2f]">
              5 Tools Operations
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[#2e1f12]">
              Project Tracker
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f4a39]">
              Track active jobs, materials, costs, due dates, service tickets,
              and repair progress.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonClass}>
              Dashboard
            </Link>
            <button onClick={loadProjects} className={buttonClass}>
              {loading ? "Reloading..." : "Reload Cloud"}
            </button>
            <button onClick={saveProject} className={goldButtonClass}>
              {saving
                ? "Saving..."
                : form.id
                  ? "Update Project"
                  : "Save Project"}
            </button>
            <button onClick={resetForm} className={buttonClass}>
              New Project
            </button>
          </div>
        </div>

        <nav className="border-t border-[#8b6b47] bg-[#4d3624]">
          <div className="mx-auto flex max-w-7xl flex-wrap px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.href === "/project-tracker"
                    ? "border-b-4 border-[#d4a66a] bg-[#6b4a31] px-4 py-3 text-xs font-black uppercase tracking-wide text-white"
                    : "border-b-4 border-transparent px-4 py-3 text-xs font-black uppercase tracking-wide text-[#f5ede2] transition hover:border-[#d4a66a] hover:bg-[#6b4a31]"
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-[#b89b79]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#8b5e3c_0%,#9b6b45_12%,#7c5235_24%,#a7794f_38%,#7a5237_52%,#966845_66%,#7d5436_80%,#a1714b_100%)] opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_62%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-8">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[#d4b08a] bg-[rgba(35,20,10,0.76)] p-5 text-[#fff8f0] shadow-xl backdrop-blur-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-[#d4a66a]">
                Open
              </div>
              <div className="mt-1 text-4xl font-black">{openProjects}</div>
            </div>
            <div className="rounded-2xl border border-[#d4b08a] bg-[rgba(35,20,10,0.76)] p-5 text-[#fff8f0] shadow-xl backdrop-blur-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-[#d4a66a]">
                In Progress
              </div>
              <div className="mt-1 text-4xl font-black">
                {inProgressProjects}
              </div>
            </div>
            <div className="rounded-2xl border border-[#d4b08a] bg-[rgba(35,20,10,0.76)] p-5 text-[#fff8f0] shadow-xl backdrop-blur-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-[#d4a66a]">
                Completed
              </div>
              <div className="mt-1 text-4xl font-black">
                {completedProjects}
              </div>
            </div>
            <div className="rounded-2xl border border-red-300 bg-red-50/95 p-5 text-red-800 shadow-xl backdrop-blur-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-700">
                Critical Open
              </div>
              <div className="mt-1 text-4xl font-black">
                {criticalOpenProjects}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8">
        <section className="rounded-2xl border border-[#c9ab86] bg-[#fffaf3] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#2f1f14]">
                Project Command Center
              </h2>
              <p className="mt-1 text-sm text-[#5f4a39]">
                Import from Scheduler or Work Orders, update project details,
                create tickets, and track costs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={importFromScheduler} className={buttonClass}>
                {importing ? "Importing..." : "Import from Scheduler"}
              </button>
              <button
                onClick={importFromWorkOrderQueue}
                className={buttonClass}
              >
                {importing ? "Importing..." : "Import Work Orders"}
              </button>
              <button
                onClick={createServiceTicketFromCurrentForm}
                className={buttonClass}
              >
                Create Service Ticket
              </button>
            </div>
          </div>
          {message ? (
            <div className="mt-4 rounded-xl border border-[#c9ab86] bg-[#f3e6d4] px-4 py-3 text-sm font-semibold text-[#2f1f14]">
              {message}
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className={cardClass + " p-5"}>
              <h2 className="text-xl font-bold">Project Info</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Project Name
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Unit turn, plumbing repair, paint, etc."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Property Name / Address
                  </label>
                  <input
                    value={form.property}
                    onChange={(e) => update("property", e.target.value)}
                    placeholder="123 Main St Tacoma, WA"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={form.duedate}
                      onChange={(e) => update("duedate", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Assigned To
                    </label>
                    <input
                      value={form.assignedto}
                      onChange={(e) => update("assignedto", e.target.value)}
                      placeholder="Vendor / PM"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={cardClass + " p-5"}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Cloud Save</h2>
                <button onClick={loadProjects} className={buttonClass}>
                  Refresh
                </button>
              </div>
              <label className="mt-4 mb-1 block text-sm font-medium">
                Saved Cloud Records
              </label>
              <select
                value={form.id}
                onChange={(e) => {
                  const selected = projects.find(
                    (project) => project.id === e.target.value,
                  );
                  if (selected) editProject(selected);
                }}
                className={inputClass}
              >
                <option value="">New record / no selection</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title || "Untitled Project"}{" "}
                    {project.property ? `- ${project.property}` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={saveProject}
                className={goldButtonClass + " mt-3 w-full"}
              >
                {form.id ? "Update Cloud Record" : "Save New Cloud Record"}
              </button>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const selected = projects.find(
                      (project) => project.id === form.id,
                    );
                    if (selected) editProject(selected);
                  }}
                  className={buttonClass}
                >
                  Load Selected
                </button>
                <button onClick={resetForm} className={buttonClass}>
                  New Record
                </button>
                <button
                  onClick={() =>
                    form.id
                      ? deleteProject(form.id)
                      : setMessage("Select a project before deleting.")
                  }
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Delete Selected
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-[#d8d2c4] bg-[#f9f7f2] px-3 py-3 text-xs text-[#333]">
                Save records by property, then load the correct project later
                without depending only on browser local storage.
              </div>
            </div>

            <div className={cardClass + " p-5"}>
              <h2 className="text-xl font-bold">Quick Add</h2>
              <p className="mt-1 text-sm text-[#333]">
                Add the project title now. Fill in the details after.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") quickAddProject();
                  }}
                  placeholder="Add project... example: touch up paint"
                  className={inputClass}
                />
                <button onClick={quickAddProject} className={goldButtonClass}>
                  Add
                </button>
              </div>
            </div>
          </aside>

          <div className="space-y-5">
            <div className={cardClass + " p-5"}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Project Board</h2>
                  <p className="text-sm text-[#333]">
                    {filteredProjects.length} visible project
                    {filteredProjects.length === 1 ? "" : "s"} •{" "}
                    {projects.length} total
                  </p>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className={inputClass + " md:max-w-xs"}
                />
              </div>

              <div className="mt-5 space-y-3">
                {filteredProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#d8d2c4] bg-[#f9f7f2] px-6 py-10 text-center text-sm text-[#6b7280]">
                    {loading ? "Loading projects..." : "No saved projects yet."}
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const projectSupplies = normalizeSupplies(project.supplies);
                    const projectSupplyTotal = suppliesTotal(projectSupplies);
                    const selected = form.id === project.id;
                    const expanded = !!expandedProjectIds[project.id];

                    return (
                      <div
                        key={project.id}
                        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                          selected
                            ? "border-[#b57a32] ring-2 ring-[#b57a32]/60"
                            : "border-[#d8d2c4]"
                        }`}
                      >
                        <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_150px_130px] md:items-center">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9c6b2f]">
                              Property / Address
                            </div>
                            <div className="mt-1 truncate text-lg font-black text-[#2f1f14]">
                              {project.property || "No property entered"}
                            </div>
                          </div>

                          <div className="rounded-xl border border-[#d8d2c4] bg-[#fffaf3] px-3 py-2 text-sm">
                            <div className="text-[10px] font-black uppercase tracking-wide text-[#9c6b2f]">
                              Due Date
                            </div>
                            <div className="mt-1 font-bold text-[#2f1f14]">
                              {project.duedate || "-"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleProjectDetails(project.id)}
                            className="rounded-xl border border-[#b57a32] bg-[#fffaf3] px-4 py-3 text-sm font-black text-[#2f1f14] shadow-sm hover:bg-[#f3e6d4]"
                          >
                            {expanded ? "Hide Details" : "Details"}
                          </button>
                        </div>

                        {expanded ? (
                          <div className="border-t border-[#d8d2c4] bg-[#fffaf3] p-4">
                            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusBadgeClass(project.status)}`}>
                                    {project.status || "No Status"}
                                  </span>
                                  <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${priorityBadgeClass(project.priority)}`}>
                                    {project.priority || "No Priority"}
                                  </span>
                                </div>
                                <h3 className="mt-2 break-words text-xl font-black leading-snug text-[#2f1f14]">
                                  {project.title || "Untitled Project"}
                                </h3>
                              </div>

                              <div className="flex flex-wrap gap-2 lg:justify-end">
                                <button onClick={() => editProject(project)} className={buttonClass}>
                                  Edit
                                </button>
                                <button onClick={() => createServiceTicketFromProject(project)} className={buttonClass}>
                                  Ticket
                                </button>
                                <button
                                  onClick={() => deleteProject(project.id)}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-4">
                              <div className="rounded-xl border border-[#d8d2c4] bg-white p-4">
                                <div className="text-xs font-black uppercase tracking-wide text-[#9c6b2f]">Assigned</div>
                                <div className="mt-2 text-sm font-bold text-[#2f1f14]">{project.assignedto || "Unassigned"}</div>
                              </div>

                              <div className="rounded-xl border border-[#d8d2c4] bg-white p-4">
                                <div className="text-xs font-black uppercase tracking-wide text-[#9c6b2f]">Budget / Actual</div>
                                <div className="mt-3 space-y-2 text-sm">
                                  <div className="flex justify-between"><span>Budget</span><strong>{moneyDisplay(project.budget)}</strong></div>
                                  <div className="flex justify-between"><span>Actual</span><strong>{moneyDisplay(project.actualcost)}</strong></div>
                                  <div className="flex justify-between"><span>Supplies</span><strong>{moneyDisplay(projectSupplyTotal)}</strong></div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-[#d8d2c4] bg-white p-4 lg:col-span-2">
                                <div className="text-xs font-black uppercase tracking-wide text-[#9c6b2f]">Project Notes</div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3f3327]">
                                  {project.notes || "No notes entered."}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-[#d8d2c4] bg-white p-4">
                              <div className="text-xs font-black uppercase tracking-wide text-[#9c6b2f]">Supplies</div>
                              {projectSupplies.length === 0 ? (
                                <p className="mt-2 text-sm text-[#6b5a47]">No supply lines entered.</p>
                              ) : (
                                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                  {projectSupplies.map((line) => (
                                    <div key={line.id} className="rounded-lg bg-[#fffaf3] px-3 py-2 text-xs">
                                      <div className="font-bold text-[#2f1f14]">{line.item || "Supply Item"}</div>
                                      <div className="text-[#6b5a47]">
                                        Qty {line.qty || "-"} × {moneyDisplay(parseMoney(line.unitcost || "0"))} = {moneyDisplay(supplyLineTotal(line))}
                                      </div>
                                      {line.vendor ? <div className="mt-1 text-[#6b5a47]">Vendor: {line.vendor}</div> : null}
                                      {line.notes ? <div className="mt-1 text-[#6b5a47]">{line.notes}</div> : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className={cardClass + " p-5"}>
              <h2 className="text-xl font-bold">Card Editor</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Project Title
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="Example: kitchen cabinet door out of alignment"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Property
                  </label>
                  <input
                    value={form.property}
                    onChange={(e) => update("property", e.target.value)}
                    placeholder="Property address or name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                    className={inputClass}
                  >
                    <option>Not Started</option>
                    <option>In Progress</option>
                    <option>On Hold</option>
                    <option>Complete</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => update("priority", e.target.value)}
                    className={inputClass}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Assigned To
                  </label>
                  <input
                    value={form.assignedto}
                    onChange={(e) => update("assignedto", e.target.value)}
                    placeholder="Painter / Vendor / PM"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.duedate}
                    onChange={(e) => update("duedate", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Budget
                  </label>
                  <input
                    value={form.budget}
                    onChange={(e) => update("budget", e.target.value)}
                    placeholder="2500"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Actual Cost
                  </label>
                  <input
                    value={form.actualcost}
                    onChange={(e) => update("actualcost", e.target.value)}
                    placeholder="1800"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium">
                  Description / Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Add field notes, scheduling notes, material notes, correction scope, or verification notes..."
                  className={inputClass + " min-h-[120px]"}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-[#d8d2c4] bg-[#f9f7f2] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Supplies Line Items</h3>
                    <p className="text-sm text-[#4b5563]">
                      Track material quantity, unit cost, vendor, and notes.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={addSupplyLine} className={goldButtonClass}>
                      Add Supply Line
                    </button>
                    <button
                      onClick={copySupplyTotalToActual}
                      className={buttonClass}
                    >
                      Use Supplies Total
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-white p-4">
                  <div className="text-sm text-[#6b7280]">
                    Current Project Supplies Total
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {moneyDisplay(currentSupplyTotal)}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {form.supplies.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#d8d2c4] bg-white px-4 py-8 text-center text-sm text-[#6b7280]">
                      No supply lines yet.
                    </div>
                  ) : (
                    form.supplies.map((line, index) => (
                      <div
                        key={line.id}
                        className="rounded-2xl border border-[#d8d2c4] bg-white p-4 shadow-sm"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-[#333]">
                            Supply Line {index + 1}
                          </div>
                          <button
                            onClick={() => removeSupplyLine(line.id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                          <div className="xl:col-span-2">
                            <label className="mb-1 block text-sm font-medium">
                              Item
                            </label>
                            <input
                              value={line.item}
                              onChange={(e) =>
                                updateSupplyLine(
                                  line.id,
                                  "item",
                                  e.target.value,
                                )
                              }
                              placeholder="Paint, baseboard, faucet, screws"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Qty
                            </label>
                            <input
                              value={line.qty}
                              onChange={(e) =>
                                updateSupplyLine(line.id, "qty", e.target.value)
                              }
                              placeholder="1"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Unit Cost
                            </label>
                            <input
                              value={line.unitcost}
                              onChange={(e) =>
                                updateSupplyLine(
                                  line.id,
                                  "unitcost",
                                  e.target.value,
                                )
                              }
                              placeholder="25.00"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Line Total
                            </label>
                            <div className="rounded-xl border border-[#d8d2c4] bg-[#f9f7f2] px-3 py-2 font-semibold">
                              {moneyDisplay(supplyLineTotal(line))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Vendor
                            </label>
                            <input
                              value={line.vendor}
                              onChange={(e) =>
                                updateSupplyLine(
                                  line.id,
                                  "vendor",
                                  e.target.value,
                                )
                              }
                              placeholder="Home Depot, Lowe's, Ferguson"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Supply Notes
                            </label>
                            <input
                              value={line.notes}
                              onChange={(e) =>
                                updateSupplyLine(
                                  line.id,
                                  "notes",
                                  e.target.value,
                                )
                              }
                              placeholder="Color, size, part number, pickup note"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={saveProject} className={goldButtonClass}>
                  {saving
                    ? "Saving..."
                    : form.id
                      ? "Update Project"
                      : "Save Project"}
                </button>
                <button
                  onClick={createServiceTicketFromCurrentForm}
                  className={buttonClass}
                >
                  Create Service Ticket
                </button>
                <button onClick={resetForm} className={buttonClass}>
                  Clear Form
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-xl border border-[#d8d2c4] bg-[#f9f7f2] p-3">
                  <div className="text-[#6b7280]">Budget Total</div>
                  <div className="text-lg font-bold">
                    {moneyDisplay(budgetTotal)}
                  </div>
                </div>
                <div className="rounded-xl border border-[#d8d2c4] bg-[#f9f7f2] p-3">
                  <div className="text-[#6b7280]">Actual Total</div>
                  <div className="text-lg font-bold">
                    {moneyDisplay(actualTotal)}
                  </div>
                </div>
                <div className="rounded-xl border border-[#d8d2c4] bg-[#f9f7f2] p-3">
                  <div className="text-[#6b7280]">Supplies Total</div>
                  <div className="text-lg font-bold">
                    {moneyDisplay(allSuppliesTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-[#8b6b47] bg-[#3f2a1b] px-8 py-6 text-center text-xs leading-6 text-[#f1e6d8]">
        5 Tools Project Tracker supports project status, cost tracking,
        supplies, Scheduler imports, Work Order imports, and Service Ticket
        handoff.
      </footer>
    </main>
  );
}
