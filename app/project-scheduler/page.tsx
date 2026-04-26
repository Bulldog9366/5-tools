"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase";

/* =========================
   SUPABASE CLIENT
========================= */
const supabase = createClient();

/* =========================
   TYPES
========================= */
type ProjectStatus =
  | "New"
  | "Scheduled"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Canceled";

type Priority = "Low" | "Medium" | "High" | "Urgent";

type ProjectItem = {
  id: string;
  propertyAddress: string;
  unit: string;
  trade: string;
  vendor: string;
  requestedBy: string;
  description: string;
  dateRequested: string;
  dateScheduled: string;
  targetCompletion: string;
  status: ProjectStatus;
  priority: Priority;
  assignedTo: string;
  tenantName: string;
  tenantPhone: string;
  accessNotes: string;
  notes: string;
  createdAt: string;
};

type CloudSchedulerRow = {
  id: string;
  board_name: string | null;
  items_json: ProjectItem[] | null;
  created_at: string;
  updated_at: string;
};

type ProjectTrackerBridgeItem = {
  id: string;
  title: string;
  property: string;
  status: string;
  priority: string;
  assignedto: string;
  duedate: string;
  budget: number;
  actualcost: number;
  notes: string;
  supplies: {
    id: string;
    item: string;
    qty: string;
    unitcost: string;
    vendor: string;
    notes: string;
  }[];
};

type TimeEntry = {
  id: string;
  project_id: string | null;
  employee_name: string;
  property_address?: string | null;
  project_title?: string | null;
  work_description?: string | null;
  clock_in: string | null;
  clock_out?: string | null;
  break_minutes?: number | null;
  total_hours?: number | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
};


const STORAGE_KEY = "five-tools-project-scheduler";
const PROJECT_TRACKER_BRIDGE_KEY = "project_tracker";
const TABLE_NAME = "project_scheduler";

const STATUS_OPTIONS: ProjectStatus[] = [
  "New",
  "Scheduled",
  "In Progress",
  "On Hold",
  "Completed",
  "Canceled",
];

const PRIORITY_OPTIONS: Priority[] = ["Low", "Medium", "High", "Urgent"];

const TRADE_OPTIONS = [
  "",
  "General",
  "Electrician",
  "Plumber",
  "HVAC",
  "Handyman",
  "Painter",
  "Cleaner",
  "Flooring",
  "Drywall",
  "Appliance",
  "Landscaping",
  "Roofing",
  "Carpentry",
  "Other",
];

/* =========================
   HELPERS
========================= */
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function prettyDate(value: string) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function parseDate(value: string) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function blankProject(): ProjectItem {
  return {
    id: uid(),
    propertyAddress: "",
    unit: "",
    trade: "",
    vendor: "",
    requestedBy: "",
    description: "",
    dateRequested: todayISO(),
    dateScheduled: "",
    targetCompletion: "",
    status: "New",
    priority: "Medium",
    assignedTo: "",
    tenantName: "",
    tenantPhone: "",
    accessNotes: "",
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

function statusClasses(status: ProjectStatus) {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-700";
    case "In Progress":
      return "bg-blue-100 text-blue-700";
    case "Scheduled":
      return "bg-amber-100 text-amber-700";
    case "On Hold":
      return "bg-orange-100 text-orange-700";
    case "Canceled":
      return "bg-rose-100 text-rose-700";
    case "New":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function statusBar(status: ProjectStatus) {
  switch (status) {
    case "Completed":
      return "border-l-emerald-500";
    case "In Progress":
      return "border-l-blue-500";
    case "Scheduled":
      return "border-l-amber-500";
    case "On Hold":
      return "border-l-orange-500";
    case "Canceled":
      return "border-l-rose-500";
    case "New":
    default:
      return "border-l-slate-400";
  }
}

function priorityClasses(priority: Priority) {
  switch (priority) {
    case "Urgent":
      return "border-red-300 bg-red-50 text-red-700";
    case "High":
      return "border-amber-300 bg-amber-50 text-amber-700";
    case "Medium":
      return "border-sky-300 bg-sky-50 text-sky-700";
    case "Low":
    default:
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function shortDateNumber(date: Date) {
  return date.getDate();
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function truncate(text: string, len = 40) {
  if (!text) return "";
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

/* =========================
   PAGE
========================= */
export default function ProjectSchedulerPage() {
  const [boardName, setBoardName] = useState("Project Scheduler");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [expandedTimeProjectIds, setExpandedTimeProjectIds] = useState<Record<string, boolean>>({});

  const [quickAddress, setQuickAddress] = useState("");
  const [quickTrade, setQuickTrade] = useState("Electrician");
  const [quickDescription, setQuickDescription] = useState("");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterTrade, setFilterTrade] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [showCompleted, setShowCompleted] = useState(true);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [statusMessage, setStatusMessage] = useState("");
  const [cloudRecords, setCloudRecords] = useState<CloudSchedulerRow[]>([]);
  const [selectedCloudId, setSelectedCloudId] = useState("");
  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);

  /* =========================
     INITIAL LOAD
  ========================= */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        const starter: ProjectItem[] = [
          {
            ...blankProject(),
            propertyAddress: "8117 121st Street SW",
            trade: "Electrician",
            description:
              "Evaluate kitchen outlet issue and replace bad receptacle if needed.",
            dateScheduled: todayISO(),
            status: "Scheduled",
            priority: "High",
            requestedBy: "PM",
            assignedTo: "Office",
          },
        ];
        setProjects(starter);
        setActiveId(starter[0].id);
        return;
      }

      const parsed = JSON.parse(raw);
      setBoardName(parsed.boardName || "Project Scheduler");
      const savedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
      setProjects(savedProjects);
      setActiveId(savedProjects[0]?.id ?? null);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    refreshCloudRecords();
    loadTimeEntries();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        boardName,
        projects,
      })
    );
  }, [boardName, projects]);

  /* =========================
     DERIVED
  ========================= */
  const activeProject =
    projects.find((project) => project.id === activeId) ?? projects[0] ?? null;

  const counts = useMemo(() => {
    return {
      total: projects.length,
      newCount: projects.filter((p) => p.status === "New").length,
      scheduled: projects.filter((p) => p.status === "Scheduled").length,
      inProgress: projects.filter((p) => p.status === "In Progress").length,
      completed: projects.filter((p) => p.status === "Completed").length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...projects]
      .filter((project) => {
        if (!showCompleted && project.status === "Completed") return false;
        if (filterStatus !== "All" && project.status !== filterStatus) return false;
        if (filterTrade !== "All" && project.trade !== filterTrade) return false;
        if (filterPriority !== "All" && project.priority !== filterPriority) return false;

        if (!q) return true;

        const haystack = [
          project.propertyAddress,
          project.unit,
          project.trade,
          project.vendor,
          project.requestedBy,
          project.description,
          project.assignedTo,
          project.tenantName,
          project.tenantPhone,
          project.accessNotes,
          project.notes,
          project.status,
          project.priority,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a, b) => {
        if (a.status === "Completed" && b.status !== "Completed") return 1;
        if (a.status !== "Completed" && b.status === "Completed") return -1;

        const aScheduled = a.dateScheduled || "9999-12-31";
        const bScheduled = b.dateScheduled || "9999-12-31";
        const dateCompare = aScheduled.localeCompare(bScheduled);
        if (dateCompare !== 0) return dateCompare;

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [projects, search, filterStatus, filterTrade, filterPriority, showCompleted]);

  const today = useMemo(() => parseDate(todayISO())!, []);
  const thisWeekStart = useMemo(() => startOfWeek(today), [today]);
  const thisWeekEnd = useMemo(() => endOfWeek(today), [today]);

  const scheduledToday = useMemo(() => {
    return filteredProjects.filter((project) => {
      const d = parseDate(project.dateScheduled);
      return d ? sameDay(d, today) : false;
    });
  }, [filteredProjects, today]);

  const scheduledThisWeek = useMemo(() => {
    return filteredProjects.filter((project) => {
      const d = parseDate(project.dateScheduled);
      return d ? d >= thisWeekStart && d <= thisWeekEnd : false;
    });
  }, [filteredProjects, thisWeekStart, thisWeekEnd]);

  const groupedByTrade = useMemo(() => {
    const groups = filteredProjects.reduce<Record<string, ProjectItem[]>>((acc, project) => {
      const key = project.trade || "Unassigned Trade";
      if (!acc[key]) acc[key] = [];
      acc[key].push(project);
      return acc;
    }, {});

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProjects]);

  const calendarDays = useMemo(() => {
    const monthStart = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );
    const monthEnd = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    );

    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    const days: Date[] = [];
    const cursor = new Date(gridStart);

    while (cursor <= gridEnd) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }, [calendarMonth]);

  function jobsForDay(day: Date) {
    return filteredProjects.filter((project) => {
      const d = parseDate(project.dateScheduled);
      return d ? sameDay(d, day) : false;
    });
  }

  function timeEntriesForProject(projectId: string) {
    return timeEntries.filter((entry) => entry.project_id === projectId);
  }

  function totalHoursForProject(projectId: string) {
    return timeEntriesForProject(projectId).reduce(
      (sum, entry) => sum + Number(entry.total_hours || 0),
      0
    );
  }

  function toggleTimeLogs(projectId: string) {
    setExpandedTimeProjectIds((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  }

  function formatClock(value?: string | null) {
    if (!value) return "Active";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
  }

  function renderTimeLogSummary(project: ProjectItem) {
    const linkedEntries = timeEntriesForProject(project.id);
    const totalHours = totalHoursForProject(project.id);
    const isExpanded = !!expandedTimeProjectIds[project.id];

    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleTimeLogs(project.id);
          }}
          className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Employee Time
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {linkedEntries.length === 0
                ? "No time logged"
                : `${linkedEntries.length} time entr${linkedEntries.length === 1 ? "y" : "ies"}`}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-900 shadow-sm ring-1 ring-slate-200">
              {totalHours.toFixed(2)} hrs
            </span>
            <span className="text-xs font-semibold text-blue-700">
              {linkedEntries.length === 0 ? "" : isExpanded ? "Hide logs" : "View logs"}
            </span>
          </div>
        </button>

        {isExpanded && linkedEntries.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {linkedEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-900">
                    {entry.employee_name || "Employee"}
                  </div>
                  <div className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">
                    {Number(entry.total_hours || 0).toFixed(2)} hrs
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-700">In:</span>{" "}
                    {formatClock(entry.clock_in)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Out:</span>{" "}
                    {formatClock(entry.clock_out)}
                  </div>
                  {entry.break_minutes ? (
                    <div>
                      <span className="font-semibold text-slate-700">Break:</span>{" "}
                      {entry.break_minutes} min
                    </div>
                  ) : null}
                  {entry.notes ? (
                    <div className="mt-2 rounded-lg bg-slate-50 p-2 text-slate-600">
                      {entry.notes}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  /* =========================
     CLOUD
  ========================= */
  async function refreshCloudRecords() {
    setIsRefreshingCloud(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, board_name, items_json, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setStatusMessage(`Cloud refresh failed: ${error.message}`);
      setIsRefreshingCloud(false);
      return;
    }

    const rows = (data || []) as CloudSchedulerRow[];
    setCloudRecords(rows);

    if (rows.length > 0 && !selectedCloudId) {
      setSelectedCloudId(rows[0].id);
    } else if (rows.length === 0) {
      setSelectedCloudId("");
    }

    setIsRefreshingCloud(false);
  }

  async function loadTimeEntries() {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .order("clock_in", { ascending: false });

    if (error) {
      setStatusMessage(`Time entries could not be loaded: ${error.message}`);
      return;
    }

    setTimeEntries((data || []) as TimeEntry[]);
  }

  async function saveToCloud() {
    if (!boardName.trim()) {
      setStatusMessage("Enter a board name before cloud save.");
      return;
    }

    setIsSavingCloud(true);
    setStatusMessage("");

    const payload = {
      board_name: boardName,
      items_json: projects,
      updated_at: new Date().toISOString(),
    };

    if (selectedCloudId) {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", selectedCloudId);

      if (error) {
        setStatusMessage(`Cloud save failed: ${error.message}`);
        setIsSavingCloud(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setStatusMessage(`Cloud save failed: ${error.message}`);
        setIsSavingCloud(false);
        return;
      }

      if (data?.id) {
        setSelectedCloudId(data.id);
      }
    }

    await refreshCloudRecords();
    setStatusMessage("Scheduler saved to cloud.");
    setIsSavingCloud(false);
  }

  async function loadFromCloud() {
    if (!selectedCloudId) {
      setStatusMessage("Select a cloud record to load.");
      return;
    }

    setIsLoadingCloud(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, board_name, items_json, created_at, updated_at")
      .eq("id", selectedCloudId)
      .single();

    if (error) {
      setStatusMessage(`Cloud load failed: ${error.message}`);
      setIsLoadingCloud(false);
      return;
    }

    const row = data as CloudSchedulerRow;

    setBoardName(row.board_name || "Project Scheduler");
    const nextProjects = Array.isArray(row.items_json) ? row.items_json : [];
    setProjects(nextProjects);
    setActiveId(nextProjects[0]?.id ?? null);
    setStatusMessage("Cloud scheduler loaded.");
    setIsLoadingCloud(false);
  }

  async function deleteCloudRecord() {
    if (!selectedCloudId) {
      setStatusMessage("Select a cloud record to delete.");
      return;
    }

    const ok = window.confirm("Delete the selected cloud scheduler record?");
    if (!ok) return;

    setIsDeletingCloud(true);
    setStatusMessage("");

    const deletingId = selectedCloudId;

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", deletingId);

    if (error) {
      setStatusMessage(`Cloud delete failed: ${error.message}`);
      setIsDeletingCloud(false);
      return;
    }

    const next = cloudRecords.filter((row) => row.id !== deletingId);
    setCloudRecords(next);
    setSelectedCloudId(next[0]?.id || "");
    setStatusMessage("Cloud scheduler deleted.");
    setIsDeletingCloud(false);
  }

  function createNewCloudRecord() {
    setSelectedCloudId("");
    setStatusMessage("Ready to save as a new cloud scheduler record.");
  }

  /* =========================
     ACTIONS
  ========================= */
  function addQuickProject() {
    if (!quickAddress.trim() && !quickDescription.trim()) return;

    const newProject: ProjectItem = {
      ...blankProject(),
      propertyAddress: quickAddress.trim(),
      trade: quickTrade,
      description: quickDescription.trim(),
      status: "New",
      priority: "Medium",
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveId(newProject.id);
    setQuickAddress("");
    setQuickDescription("");
  }

  function addBlankProject() {
    const newProject = blankProject();
    setProjects((prev) => [newProject, ...prev]);
    setActiveId(newProject.id);
  }

  function duplicateProject(id: string) {
    const source = projects.find((project) => project.id === id);
    if (!source) return;

    const copy: ProjectItem = {
      ...source,
      id: uid(),
      createdAt: new Date().toISOString(),
      status: "New",
    };

    setProjects((prev) => [copy, ...prev]);
    setActiveId(copy.id);
  }

  function deleteProject(id: string) {
    const next = projects.filter((project) => project.id !== id);
    setProjects(next);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null);
    }
  }

  function updateProject<K extends keyof ProjectItem>(
    id: string,
    field: K,
    value: ProjectItem[K]
  ) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id ? { ...project, [field]: value } : project
      )
    );
  }

  function sendToProjectTracker(project: ProjectItem) {
    try {
      const raw = localStorage.getItem(PROJECT_TRACKER_BRIDGE_KEY);
      const existing = raw ? JSON.parse(raw) : [];

      const trackerItem: ProjectTrackerBridgeItem = {
        id: uid(),
        title: project.description
          ? truncate(project.description, 80)
          : `${project.trade || "Project"} - ${project.propertyAddress || "No Address"}`,
        property: [project.propertyAddress, project.unit ? `Unit ${project.unit}` : ""]
          .filter(Boolean)
          .join(" "),
        status:
          project.status === "Completed"
            ? "Complete"
            : project.status === "On Hold"
            ? "On Hold"
            : project.status,
        priority: project.priority,
        assignedto: project.assignedTo || project.vendor || "",
        duedate: project.targetCompletion || project.dateScheduled || "",
        budget: 0,
        actualcost: 0,
        notes: [
          project.description ? `Work Requested: ${project.description}` : "",
          project.trade ? `Trade: ${project.trade}` : "",
          project.vendor ? `Vendor: ${project.vendor}` : "",
          project.requestedBy ? `Requested By: ${project.requestedBy}` : "",
          project.tenantName ? `Tenant: ${project.tenantName}` : "",
          project.tenantPhone ? `Tenant Phone: ${project.tenantPhone}` : "",
          project.accessNotes ? `Access Notes: ${project.accessNotes}` : "",
          project.notes ? `Scheduler Notes: ${project.notes}` : "",
          project.dateRequested ? `Date Requested: ${project.dateRequested}` : "",
          project.dateScheduled ? `Date Scheduled: ${project.dateScheduled}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        supplies: [],
      };

      localStorage.setItem(
        PROJECT_TRACKER_BRIDGE_KEY,
        JSON.stringify([trackerItem, ...existing])
      );
      setStatusMessage("Project sent to Project Tracker.");
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not send project to Project Tracker.");
    }
  }

  function exportJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            boardName,
            projects,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-scheduler-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    const ok = window.confirm("Clear all scheduler records?");
    if (!ok) return;
    setProjects([]);
    setActiveId(null);
    localStorage.removeItem(STORAGE_KEY);
    setStatusMessage("Local scheduler cleared.");
  }

  function shiftMonth(direction: -1 | 1) {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1)
    );
  }

  /* =========================
     PRINT DATA
  ========================= */
  const printProjects = [...filteredProjects];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                5 Tools
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Project Scheduler
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Calendar-based scheduling, cloud save/load, vendor tracking, and day-by-day repair planning.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Back to Dashboard
              </Link>
              <button
                type="button"
                onClick={addBlankProject}
                className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Add Project
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
              >
                Print
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.total}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                New
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.newCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scheduled
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.scheduled}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                In Progress
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.inProgress}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Completed
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.completed}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {statusMessage ? (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {statusMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Board Info</h2>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Scheduler Name
                </label>
                <input
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                  placeholder="Project Scheduler"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Cloud Save</h2>
                <button
                  type="button"
                  onClick={refreshCloudRecords}
                  disabled={isRefreshingCloud}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isRefreshingCloud ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Saved Cloud Records
                  </label>
                  <select
                    value={selectedCloudId}
                    onChange={(e) => setSelectedCloudId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                  >
                    <option value="">New record / no selection</option>
                    {cloudRecords.map((record) => (
                      <option key={record.id} value={record.id}>
                        {(record.board_name || "Unnamed Scheduler")} — {prettyDate(
                          record.updated_at.slice(0, 10)
                        )}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={saveToCloud}
                    disabled={isSavingCloud}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSavingCloud
                      ? "Saving..."
                      : selectedCloudId
                      ? "Update Cloud Record"
                      : "Save New Cloud Record"}
                  </button>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={loadFromCloud}
                      disabled={isLoadingCloud}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {isLoadingCloud ? "Loading..." : "Load Selected"}
                    </button>

                    <button
                      type="button"
                      onClick={createNewCloudRecord}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      New Record
                    </button>

                    <button
                      type="button"
                      onClick={deleteCloudRecord}
                      disabled={isDeletingCloud}
                      className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {isDeletingCloud ? "Deleting..." : "Delete Selected"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Quick Add</h2>
              <p className="mt-1 text-sm text-slate-600">
                Example: 8117 121st Street SW, electrician, description of work requested.
              </p>

              <div className="mt-4 space-y-3">
                <input
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                  placeholder="Property address"
                />

                <select
                  value={quickTrade}
                  onChange={(e) => setQuickTrade(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                >
                  {TRADE_OPTIONS.filter(Boolean).map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>

                <textarea
                  value={quickDescription}
                  onChange={(e) => setQuickDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                  placeholder="Description of work requested"
                />

                <button
                  type="button"
                  onClick={addQuickProject}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add Scheduler Item
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Filters</h2>

              <div className="mt-4 space-y-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                  placeholder="Search address, trade, vendor, notes..."
                />

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="All">All Status</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <select
                  value={filterTrade}
                  onChange={(e) => setFilterTrade(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="All">All Trades</option>
                  {Array.from(new Set(projects.map((p) => p.trade).filter(Boolean))).map(
                    (trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                >
                  <option value="All">All Priorities</option>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={(e) => setShowCompleted(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Show completed
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Actions</h2>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={loadTimeEntries}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Refresh Employee Time
                </button>

                <button
                  type="button"
                  onClick={exportJson}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Export JSON Backup
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Clear All Scheduler Items
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Scheduled for Today</h2>
                  <p className="text-sm text-slate-600">
                    {scheduledToday.length} item{scheduledToday.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {scheduledToday.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Nothing scheduled for today.
                  </div>
                ) : (
                  scheduledToday.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setActiveId(project.id)}
                      className={`w-full rounded-2xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50 ${statusBar(
                        project.status
                      )}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {project.propertyAddress || "Untitled project"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {project.trade || "-"} • {project.vendor || "No vendor"}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            project.status
                          )}`}
                        >
                          {project.status}
                        </span>
                      </div>

                      {project.description && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {truncate(project.description, 95)}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendToProjectTracker(project);
                          }}
                          className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600"
                        >
                          Send to Tracker
                        </button>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Scheduled This Week</h2>
                  <p className="text-sm text-slate-600">
                    {scheduledThisWeek.length} item{scheduledThisWeek.length === 1 ? "" : "s"} •{" "}
                    {prettyDate(thisWeekStart.toISOString().slice(0, 10))} -{" "}
                    {prettyDate(thisWeekEnd.toISOString().slice(0, 10))}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {scheduledThisWeek.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Nothing scheduled this week.
                  </div>
                ) : (
                  scheduledThisWeek.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setActiveId(project.id)}
                      className={`w-full rounded-2xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50 ${statusBar(
                        project.status
                      )}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {project.propertyAddress || "Untitled project"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {project.trade || "-"} • Scheduled {prettyDate(project.dateScheduled)}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                              project.status
                            )}`}
                          >
                            {project.status}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(
                              project.priority
                            )}`}
                          >
                            {project.priority}
                          </span>
                        </div>
                      </div>

                      {project.description && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {truncate(project.description, 95)}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendToProjectTracker(project);
                          }}
                          className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600"
                        >
                          Send to Tracker
                        </button>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Calendar View</h2>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Prev
                  </button>
                  <div className="min-w-[170px] text-center text-sm font-semibold text-slate-800">
                    {monthLabel(calendarMonth)}
                  </div>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="rounded-xl bg-slate-50 px-2 py-2">
                    {d}
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const dayProjects = jobsForDay(day);
                  const inCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isToday = sameDay(day, today);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[120px] rounded-2xl border p-2 ${
                        inCurrentMonth
                          ? "border-slate-200 bg-white"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      } ${isToday ? "ring-2 ring-amber-300" : ""}`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wide">
                          {dayLabel(day)}
                        </div>
                        <div className="text-sm font-bold">{shortDateNumber(day)}</div>
                      </div>

                      <div className="space-y-1">
                        {dayProjects.slice(0, 3).map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => setActiveId(project.id)}
                            className={`block w-full rounded-lg border-l-4 px-2 py-1 text-left text-[11px] leading-4 text-slate-700 ${statusBar(
                              project.status
                            )} bg-slate-50 hover:bg-slate-100`}
                          >
                            <div className="font-semibold">
                              {truncate(project.trade || "Work", 18)}
                            </div>
                            <div>{truncate(project.propertyAddress || "", 20)}</div>
                          </button>
                        ))}

                        {dayProjects.length > 3 && (
                          <div className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                            +{dayProjects.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Grouped by Trade</h2>
                  <p className="text-sm text-slate-600">
                    Quick operational grouping by vendor / trade.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {groupedByTrade.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    No grouped items to show.
                  </div>
                ) : (
                  groupedByTrade.map(([trade, items]) => (
                    <div key={trade} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-semibold text-slate-900">{trade}</div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {items.length} item{items.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {items.slice(0, 6).map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => setActiveId(project.id)}
                            className={`w-full rounded-xl border border-slate-200 border-l-4 bg-white px-3 py-3 text-left shadow-sm transition hover:bg-slate-50 ${statusBar(
                              project.status
                            )}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium text-slate-900">
                                {project.propertyAddress || "Untitled project"}
                              </div>
                              <div className="flex gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(
                                    project.status
                                  )}`}
                                >
                                  {project.status}
                                </span>
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityClasses(
                                    project.priority
                                  )}`}
                                >
                                  {project.priority}
                                </span>
                              </div>
                            </div>
                            {project.description && (
                              <div className="mt-1 text-sm text-slate-600">
                                {truncate(project.description, 85)}
                              </div>
                            )}
                          </button>
                        ))}

                        {items.length > 6 && (
                          <div className="text-xs text-slate-500">
                            +{items.length - 6} more in this trade group
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Scheduled Projects</h2>
                  <p className="text-sm text-slate-600">
                    {filteredProjects.length} visible item{filteredProjects.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {filteredProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No projects match the current filters.
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setActiveId(project.id)}
                      className={`w-full rounded-2xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition hover:bg-slate-50 ${statusBar(
                        project.status
                      )} ${activeId === project.id ? "ring-2 ring-slate-300" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-slate-900">
                            {project.propertyAddress || "Untitled project"}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {project.trade || "No trade selected"}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                              project.status
                            )}`}
                          >
                            {project.status}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(
                              project.priority
                            )}`}
                          >
                            {project.priority}
                          </span>
                        </div>
                      </div>

                      {project.description && (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                          {project.description}
                        </p>
                      )}

                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div className="rounded-lg bg-slate-50 px-2 py-1">
                          Scheduled: {prettyDate(project.dateScheduled)}
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2 py-1">
                          Vendor: {project.vendor || "-"}
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2 py-1">
                          Assigned: {project.assignedTo || "-"}
                        </div>
                        <div className="rounded-lg bg-slate-50 px-2 py-1">
                          Target: {prettyDate(project.targetCompletion)}
                        </div>
                      </div>

                      {renderTimeLogSummary(project)}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            sendToProjectTracker(project);
                          }}
                          className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600"
                        >
                          Send to Tracker
                        </button>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Project Editor</h2>

                {activeProject ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateProject(activeProject.id)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => sendToProjectTracker(activeProject)}
                      className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
                    >
                      Send to Tracker
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(activeProject.id)}
                      className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              {!activeProject ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Select a project to edit.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Property Address
                      </label>
                      <input
                        value={activeProject.propertyAddress}
                        onChange={(e) =>
                          updateProject(activeProject.id, "propertyAddress", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        placeholder="8117 121st Street SW"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Unit
                      </label>
                      <input
                        value={activeProject.unit}
                        onChange={(e) =>
                          updateProject(activeProject.id, "unit", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        placeholder="Unit / Apt / Suite"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Trade
                      </label>
                      <select
                        value={activeProject.trade}
                        onChange={(e) =>
                          updateProject(activeProject.id, "trade", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      >
                        {TRADE_OPTIONS.map((trade) => (
                          <option key={trade} value={trade}>
                            {trade || "Select trade"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Status
                      </label>
                      <select
                        value={activeProject.status}
                        onChange={(e) =>
                          updateProject(activeProject.id, "status", e.target.value as ProjectStatus)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Priority
                      </label>
                      <select
                        value={activeProject.priority}
                        onChange={(e) =>
                          updateProject(activeProject.id, "priority", e.target.value as Priority)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      >
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Assigned To
                      </label>
                      <input
                        value={activeProject.assignedTo}
                        onChange={(e) =>
                          updateProject(activeProject.id, "assignedTo", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        placeholder="PM / Staff"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Description of Work Requested
                    </label>
                    <textarea
                      value={activeProject.description}
                      onChange={(e) =>
                        updateProject(activeProject.id, "description", e.target.value)
                      }
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      placeholder="Describe the work requested, symptoms, scope, or repairs needed..."
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Date Requested
                      </label>
                      <input
                        type="date"
                        value={activeProject.dateRequested}
                        onChange={(e) =>
                          updateProject(activeProject.id, "dateRequested", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Date Scheduled
                      </label>
                      <input
                        type="date"
                        value={activeProject.dateScheduled}
                        onChange={(e) =>
                          updateProject(activeProject.id, "dateScheduled", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Target Completion
                      </label>
                      <input
                        type="date"
                        value={activeProject.targetCompletion}
                        onChange={(e) =>
                          updateProject(activeProject.id, "targetCompletion", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Requested By
                      </label>
                      <input
                        value={activeProject.requestedBy}
                        onChange={(e) =>
                          updateProject(activeProject.id, "requestedBy", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        placeholder="Owner / Tenant / PM"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Vendor / Contractor
                      </label>
                      <input
                        value={activeProject.vendor}
                        onChange={(e) =>
                          updateProject(activeProject.id, "vendor", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        placeholder="Vendor name"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Tenant Name
                      </label>
                      <input
                        value={activeProject.tenantName}
                        onChange={(e) =>
                          updateProject(activeProject.id, "tenantName", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        placeholder="Tenant / occupant"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Tenant Phone
                      </label>
                      <input
                        value={activeProject.tenantPhone}
                        onChange={(e) =>
                          updateProject(activeProject.id, "tenantPhone", e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        placeholder="Phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Access Notes
                    </label>
                    <textarea
                      value={activeProject.accessNotes}
                      onChange={(e) =>
                        updateProject(activeProject.id, "accessNotes", e.target.value)
                      }
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      placeholder="Gate code, lockbox, call before entry, pet notes, occupied/vacant, etc."
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Internal Notes
                    </label>
                    <textarea
                      value={activeProject.notes}
                      onChange={(e) =>
                        updateProject(activeProject.id, "notes", e.target.value)
                      }
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                      placeholder="Office notes, approvals, vendor updates, follow-up items..."
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <div className="print-only px-8 py-8 text-slate-900">
        <div className="border-b border-slate-300 pb-4">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            5 Tools
          </div>
          <h1 className="mt-2 text-3xl font-bold">{boardName || "Project Scheduler"}</h1>
          <div className="mt-2 text-sm text-slate-600">
            Printed {new Date().toLocaleString()}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold">Scheduled for Today</h2>
          <div className="mt-4 space-y-4">
            {scheduledToday.length === 0 ? (
              <div className="rounded-xl border border-slate-300 p-4 text-sm text-slate-600">
                Nothing scheduled for today.
              </div>
            ) : (
              scheduledToday.map((project, index) => (
                <div key={project.id} className="rounded-2xl border border-slate-300 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Today Item {index + 1}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {project.propertyAddress || "Untitled project"}
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-semibold">Trade:</span> {project.trade || "-"} •{" "}
                    <span className="font-semibold">Vendor:</span> {project.vendor || "-"}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
                    {project.description || "-"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold">Scheduled This Week</h2>
          <div className="mt-4 space-y-4">
            {scheduledThisWeek.length === 0 ? (
              <div className="rounded-xl border border-slate-300 p-4 text-sm text-slate-600">
                Nothing scheduled this week.
              </div>
            ) : (
              scheduledThisWeek.map((project, index) => (
                <div key={project.id} className="rounded-2xl border border-slate-300 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Week Item {index + 1}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {project.propertyAddress || "Untitled project"}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold">Trade:</span> {project.trade || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Scheduled:</span>{" "}
                      {prettyDate(project.dateScheduled)}
                    </div>
                    <div>
                      <span className="font-semibold">Vendor:</span> {project.vendor || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span> {project.status}
                    </div>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
                    {project.description || "-"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold">Full Scheduler</h2>
          <div className="mt-4 space-y-5">
            {printProjects.length === 0 ? (
              <div className="rounded-xl border border-slate-300 p-4 text-sm text-slate-600">
                No scheduler items available.
              </div>
            ) : (
              printProjects.map((project, index) => (
                <div key={project.id} className="rounded-2xl border border-slate-300 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Project {index + 1}
                      </div>
                      <h3 className="mt-1 text-lg font-semibold">
                        {project.propertyAddress || "Untitled project"}
                      </h3>
                    </div>

                    <div className="text-right text-sm">
                      <div>
                        <span className="font-semibold">Status:</span> {project.status}
                      </div>
                      <div>
                        <span className="font-semibold">Priority:</span> {project.priority}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="font-semibold">Trade:</span> {project.trade || "-"}</div>
                    <div><span className="font-semibold">Vendor:</span> {project.vendor || "-"}</div>
                    <div><span className="font-semibold">Requested By:</span> {project.requestedBy || "-"}</div>
                    <div><span className="font-semibold">Assigned To:</span> {project.assignedTo || "-"}</div>
                    <div><span className="font-semibold">Date Requested:</span> {prettyDate(project.dateRequested)}</div>
                    <div><span className="font-semibold">Date Scheduled:</span> {prettyDate(project.dateScheduled)}</div>
                    <div><span className="font-semibold">Target Completion:</span> {prettyDate(project.targetCompletion)}</div>
                    <div><span className="font-semibold">Unit:</span> {project.unit || "-"}</div>
                    <div><span className="font-semibold">Tenant:</span> {project.tenantName || "-"}</div>
                    <div><span className="font-semibold">Phone:</span> {project.tenantPhone || "-"}</div>
                  </div>

                  {project.description && (
                    <div className="mt-3">
                      <div className="text-sm font-semibold">Work Requested</div>
                      <div className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
                        {project.description}
                      </div>
                    </div>
                  )}

                  {project.accessNotes && (
                    <div className="mt-3">
                      <div className="text-sm font-semibold">Access Notes</div>
                      <div className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
                        {project.accessNotes}
                      </div>
                    </div>
                  )}

                  {project.notes && (
                    <div className="mt-3">
                      <div className="text-sm font-semibold">Internal Notes</div>
                      <div className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
                        {project.notes}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}