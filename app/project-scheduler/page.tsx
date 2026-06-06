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
  sourceId?: string;
  source?: string;
  workOrderNumber?: string;
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

type WorkOrderSchedulerQueueItem = {
  sourceId?: string;
  source?: string;
  workOrderNumber?: string;
  propertyAddress?: string;
  unit?: string;
  category?: string;
  vendorName?: string;
  assignedTo?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  description?: string;
  status?: string;
  priority?: string;
  requestorName?: string;
  requestorPhone?: string;
  accessNotes?: string;
  createdAt?: string;
};

type SecretarySchedulerDraft = {
  source?: string;
  secretaryId?: string;
  id?: string;
  title?: string;
  description?: string;
  details?: string;
  propertyAddress?: string;
  address?: string;
  contactName?: string;
  contact?: string;
  vendorName?: string;
  assignedTo?: string;
  dueDate?: string;
  dueTime?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  priority?: string;
  createdAt?: string;
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
const WORK_ORDER_SCHEDULER_QUEUE_KEY = "five_tools_project_scheduler_queue_v1";
const SECRETARY_SCHEDULER_HANDOFF_KEY = "five-tools-scheduler-draft";
const SECRETARY_SCHEDULER_HANDOFF_ALIASES = [
  "five-tools-scheduler-draft",
  "schedulerDraft",
  "projectSchedulerDraft",
  "five_tools_scheduler_draft",
];
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

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Work Orders", href: "/work-order-engine" },
  { label: "Pricing", href: "/work-order-pricing" },
  { label: "Scheduler", href: "/project-scheduler" },
  { label: "Projects", href: "/project-tracker" },
  { label: "Time Clock", href: "/time-clock-employees" },
  { label: "Truck Inventory", href: "/truck-inventory" },
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

function mapWorkOrderPriority(priority?: string): Priority {
  switch (priority) {
    case "Emergency":
      return "Urgent";
    case "High":
      return "High";
    case "Low":
      return "Low";
    case "Routine":
    default:
      return "Medium";
  }
}

function mapSecretaryPriority(priority?: string): Priority {
  const value = (priority || "").toLowerCase();
  if (value.includes("urgent") || value.includes("emergency")) return "Urgent";
  if (value.includes("high")) return "High";
  if (value.includes("low")) return "Low";
  return "Medium";
}

function readSecretarySchedulerDraftFromStorage(): {
  draft: SecretarySchedulerDraft | null;
  key: string;
} {
  if (typeof window === "undefined") return { draft: null, key: "" };

  for (const key of SECRETARY_SCHEDULER_HANDOFF_ALIASES) {
    const raw =
      window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { draft: parsed as SecretarySchedulerDraft, key };
      }
    } catch {
      // keep checking other known keys
    }
  }

  return { draft: null, key: "" };
}

function readSecretarySchedulerDraftFromUrl(): SecretarySchedulerDraft | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (params.get("source") !== "secretary" && !params.get("secretaryId"))
    return null;

  return {
    source: "secretary",
    secretaryId: params.get("secretaryId") || undefined,
    title: params.get("title") || undefined,
    details: params.get("details") || undefined,
    description: params.get("details") || params.get("title") || undefined,
    propertyAddress: params.get("address") || undefined,
    address: params.get("address") || undefined,
    contactName: params.get("contact") || undefined,
    contact: params.get("contact") || undefined,
    dueDate: params.get("dueDate") || undefined,
    dueTime: params.get("dueTime") || undefined,
    priority: params.get("priority") || undefined,
    createdAt: new Date().toISOString(),
  };
}

function secretaryDraftToProject(draft: SecretarySchedulerDraft): ProjectItem {
  const sourceId = draft.secretaryId || draft.id || `secretary-${Date.now()}`;
  const propertyAddress = draft.propertyAddress || draft.address || "";
  const contactName = draft.contactName || draft.contact || "";
  const vendorOrAssigned =
    draft.assignedTo || draft.vendorName || contactName || "";
  const scheduledDate = draft.scheduledDate || draft.dueDate || todayISO();
  const scheduledTime = draft.scheduledTime || draft.dueTime || "";
  const description =
    draft.description ||
    draft.details ||
    draft.title ||
    "Scheduled visit from Virtual Secretary.";

  return {
    ...blankProject(),
    id: `secretary-${sourceId}`,
    sourceId,
    source: "Virtual Secretary",
    propertyAddress,
    trade: "General",
    vendor: draft.vendorName || "",
    requestedBy: "Virtual Secretary",
    description,
    dateRequested: draft.createdAt ? draft.createdAt.slice(0, 10) : todayISO(),
    dateScheduled: scheduledDate,
    targetCompletion: scheduledDate,
    status: "Scheduled",
    priority: mapSecretaryPriority(draft.priority),
    assignedTo: vendorOrAssigned,
    tenantName: contactName,
    notes: [
      draft.title ? `Secretary Item: ${draft.title}` : "",
      scheduledTime ? `Scheduled Time: ${scheduledTime}` : "",
      contactName ? `Contact: ${contactName}` : "",
      "Imported from Virtual Secretary handoff.",
    ]
      .filter(Boolean)
      .join("\n"),
    createdAt: draft.createdAt || new Date().toISOString(),
  };
}

function mergeSecretarySchedulerHandoff(existingProjects: ProjectItem[]) {
  const storageResult = readSecretarySchedulerDraftFromStorage();
  const draft = storageResult.draft || readSecretarySchedulerDraftFromUrl();

  if (!draft) return { projects: existingProjects, importedCount: 0 };

  const imported = secretaryDraftToProject(draft);
  const sourceId = imported.sourceId || imported.id;
  const filteredExisting = existingProjects.filter((project) => {
    const key = project.sourceId || project.id;
    return key !== sourceId;
  });

  if (typeof window !== "undefined") {
    for (const key of SECRETARY_SCHEDULER_HANDOFF_ALIASES) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  }

  return { projects: [imported, ...filteredExisting], importedCount: 1 };
}

function mapWorkOrderTrade(category?: string) {
  const value = (category || "").toLowerCase();
  if (value.includes("plumb")) return "Plumber";
  if (value.includes("electric")) return "Electrician";
  if (value.includes("hvac")) return "HVAC";
  if (value.includes("paint") || value.includes("drywall")) return "Painter";
  if (value.includes("floor")) return "Flooring";
  if (value.includes("appliance")) return "Appliance";
  if (value.includes("clean") || value.includes("trash")) return "Cleaner";
  if (value.includes("roof")) return "Roofing";
  if (value.includes("carpentry") || value.includes("trim")) return "Carpentry";
  if (value.includes("landscap")) return "Landscaping";
  if (value.includes("general") || value.includes("maintenance"))
    return "General";
  return "Handyman";
}

function readWorkOrderSchedulerQueue(): WorkOrderSchedulerQueueItem[] {
  try {
    const raw = localStorage.getItem(WORK_ORDER_SCHEDULER_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function workOrderQueueItemToProject(
  item: WorkOrderSchedulerQueueItem,
): ProjectItem {
  const sourceId = item.sourceId || item.workOrderNumber || uid();
  const scheduleNote = item.scheduledTime
    ? `Scheduled Time: ${item.scheduledTime}`
    : "";
  const workOrderNote = item.workOrderNumber
    ? `Work Order #: ${item.workOrderNumber}`
    : "";

  return {
    ...blankProject(),
    id: `wo-${sourceId}`,
    sourceId,
    source: item.source || "Work Order Engine",
    workOrderNumber: item.workOrderNumber || "",
    propertyAddress: item.propertyAddress || "",
    unit: item.unit || "",
    trade: mapWorkOrderTrade(item.category),
    vendor: item.vendorName || "",
    requestedBy: item.source || "Work Order Engine",
    description:
      item.description || "Imported work order from Work Order Engine.",
    dateRequested: item.createdAt ? item.createdAt.slice(0, 10) : todayISO(),
    dateScheduled: item.scheduledDate || todayISO(),
    targetCompletion: item.scheduledDate || "",
    status: "Scheduled",
    priority: mapWorkOrderPriority(item.priority),
    assignedTo: item.assignedTo || item.vendorName || "",
    tenantName: item.requestorName || "",
    tenantPhone: item.requestorPhone || "",
    accessNotes: item.accessNotes || "",
    notes: [
      workOrderNote,
      scheduleNote,
      "Imported from Work Order Engine queue.",
    ]
      .filter(Boolean)
      .join("\n"),
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

function mergeWorkOrderQueue(existingProjects: ProjectItem[]) {
  const queue = readWorkOrderSchedulerQueue();
  if (queue.length === 0)
    return { projects: existingProjects, importedCount: 0 };

  const imported = queue.map(workOrderQueueItemToProject);
  const importedIds = new Set(
    imported.map((item) => item.sourceId || item.workOrderNumber || item.id),
  );
  const filteredExisting = existingProjects.filter((project) => {
    const key = project.sourceId || project.workOrderNumber || project.id;
    return !importedIds.has(key);
  });

  localStorage.removeItem(WORK_ORDER_SCHEDULER_QUEUE_KEY);
  return {
    projects: [...imported, ...filteredExisting],
    importedCount: imported.length,
  };
}

function statusClasses(status: ProjectStatus) {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-700";
    case "In Progress":
      return "bg-[#fff7db] text-[#8a6f22]";
    case "Scheduled":
      return "bg-[#fff7db] text-[#8a6f22]";
    case "On Hold":
      return "bg-[#fff7db] text-[#8a6f22]";
    case "Canceled":
      return "bg-rose-100 text-rose-700";
    case "New":
    default:
      return "bg-[#efe3d2] text-[#4d3624]";
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
      return "border-amber-300 bg-amber-50 text-[#8a6f22]";
    case "Medium":
      return "border-sky-300 bg-sky-50 text-[#8a6f22]";
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
  const [expandedTimeProjectIds, setExpandedTimeProjectIds] = useState<
    Record<string, boolean>
  >({});

  const [quickAddress, setQuickAddress] = useState("");
  const [quickTrade, setQuickTrade] = useState("Electrician");
  const [quickDescription, setQuickDescription] = useState("");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterTrade, setFilterTrade] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [showCompleted, setShowCompleted] = useState(true);
  const [isTodayOpen, setIsTodayOpen] = useState(false);
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [isScheduledProjectsOpen, setIsScheduledProjectsOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [openWeekTrades, setOpenWeekTrades] = useState<Record<string, boolean>>(
    {},
  );
  const [openTradeGroups, setOpenTradeGroups] = useState<
    Record<string, boolean>
  >({});

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

  const [viewMode, setViewMode] = useState<"Today" | "Week" | "Trade" | "All">(
    "Today",
  );
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const [activePanel, setActivePanel] = useState<
    | "Quick Add"
    | "Dispatch Board"
    | "Calendar"
    | "Job Editor"
    | "Filters"
    | "Admin Tools"
  >("Dispatch Board");

  /* =========================
     INITIAL LOAD
  ========================= */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let loadedProjects: ProjectItem[] = [];

      if (!raw) {
        loadedProjects = [
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
      } else {
        const parsed = JSON.parse(raw);
        setBoardName(parsed.boardName || "Project Scheduler");
        loadedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
      }

      const workOrderMerge = mergeWorkOrderQueue(loadedProjects);
      const secretaryMerge = mergeSecretarySchedulerHandoff(
        workOrderMerge.projects,
      );
      const nextProjects = secretaryMerge.projects;

      setProjects(nextProjects);
      setActiveId(nextProjects[0]?.id ?? null);

      const messages = [];
      if (workOrderMerge.importedCount > 0) {
        messages.push(
          `Imported ${workOrderMerge.importedCount} work order${workOrderMerge.importedCount === 1 ? "" : "s"} from Work Order Engine.`,
        );
      }
      if (secretaryMerge.importedCount > 0) {
        messages.push("Imported scheduled visit from Virtual Secretary.");
        setIsScheduledProjectsOpen(true);
        setIsEditorOpen(true);
      }
      if (messages.length > 0) {
        setStatusMessage(messages.join(" "));
      }
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
      }),
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
        if (filterStatus !== "All" && project.status !== filterStatus)
          return false;
        if (filterTrade !== "All" && project.trade !== filterTrade)
          return false;
        if (filterPriority !== "All" && project.priority !== filterPriority)
          return false;

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

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [
    projects,
    search,
    filterStatus,
    filterTrade,
    filterPriority,
    showCompleted,
  ]);

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

  const scheduledThisWeekByTrade = useMemo(() => {
    const groups = scheduledThisWeek.reduce<Record<string, ProjectItem[]>>(
      (acc, project) => {
        const key = project.trade || "Unassigned Trade";
        if (!acc[key]) acc[key] = [];
        acc[key].push(project);
        return acc;
      },
      {},
    );

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [scheduledThisWeek]);

  const groupedByTrade = useMemo(() => {
    const groups = filteredProjects.reduce<Record<string, ProjectItem[]>>(
      (acc, project) => {
        const key = project.trade || "Unassigned Trade";
        if (!acc[key]) acc[key] = [];
        acc[key].push(project);
        return acc;
      },
      {},
    );

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProjects]);

  const calendarDays = useMemo(() => {
    const monthStart = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    );
    const monthEnd = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
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
      0,
    );
  }

  function toggleTimeLogs(projectId: string) {
    setExpandedTimeProjectIds((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  }

  function toggleWeekTrade(trade: string) {
    setOpenWeekTrades((prev) => ({
      ...prev,
      [trade]: !prev[trade],
    }));
  }

  function toggleTradeGroup(trade: string) {
    setOpenTradeGroups((prev) => ({
      ...prev,
      [trade]: !prev[trade],
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
      <div className="mt-4 rounded-2xl border border-[#c9ab86] bg-[#fff8ee] p-3 sm:p-4">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleTimeLogs(project.id);
          }}
          className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[#7b6044]">
              Employee Time
            </div>
            <div className="mt-1 text-sm font-semibold text-[#111111]">
              {linkedEntries.length === 0
                ? "No time logged"
                : `${linkedEntries.length} time entr${linkedEntries.length === 1 ? "y" : "ies"}`}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[#111111] shadow-sm ring-1 ring-slate-200">
              {totalHours.toFixed(2)} hrs
            </span>
            <span className="text-xs font-semibold text-[#8a6f22]">
              {linkedEntries.length === 0
                ? ""
                : isExpanded
                  ? "Hide logs"
                  : "View logs"}
            </span>
          </div>
        </button>

        {isExpanded && linkedEntries.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {linkedEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-[#c9ab86] bg-white p-3 text-xs shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-[#111111]">
                    {entry.employee_name || "Employee"}
                  </div>
                  <div className="rounded-full bg-[#efe3d2] px-2 py-1 font-bold text-[#4d3624]">
                    {Number(entry.total_hours || 0).toFixed(2)} hrs
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-[#5f4a39]">
                  <div>
                    <span className="font-semibold text-[#4d3624]">In:</span>{" "}
                    {formatClock(entry.clock_in)}
                  </div>
                  <div>
                    <span className="font-semibold text-[#4d3624]">Out:</span>{" "}
                    {formatClock(entry.clock_out)}
                  </div>
                  {entry.break_minutes ? (
                    <div>
                      <span className="font-semibold text-[#4d3624]">
                        Break:
                      </span>{" "}
                      {entry.break_minutes} min
                    </div>
                  ) : null}
                  {entry.notes ? (
                    <div className="mt-2 rounded-lg bg-[#fff8ee] p-2 text-[#5f4a39]">
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
    value: ProjectItem[K],
  ) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === id ? { ...project, [field]: value } : project,
      ),
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
        property: [
          project.propertyAddress,
          project.unit ? `Unit ${project.unit}` : "",
        ]
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
          project.dateRequested
            ? `Date Requested: ${project.dateRequested}`
            : "",
          project.dateScheduled
            ? `Date Scheduled: ${project.dateScheduled}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        supplies: [],
      };

      localStorage.setItem(
        PROJECT_TRACKER_BRIDGE_KEY,
        JSON.stringify([trackerItem, ...existing]),
      );
      setStatusMessage("Project sent to Project Tracker.");
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not send project to Project Tracker.");
    }
  }

  function importWorkOrdersFromQueue() {
    const merged = mergeWorkOrderQueue(projects);
    if (merged.importedCount === 0) {
      setStatusMessage(
        "No Work Order Engine scheduler items waiting to import.",
      );
      return;
    }

    setProjects(merged.projects);
    setActiveId(merged.projects[0]?.id ?? null);
    setStatusMessage(
      `Imported ${merged.importedCount} work order${merged.importedCount === 1 ? "" : "s"} from Work Order Engine.`,
    );
  }

  function importSecretaryScheduleDraft() {
    const merged = mergeSecretarySchedulerHandoff(projects);
    if (merged.importedCount === 0) {
      setStatusMessage(
        "No Virtual Secretary scheduler draft waiting to import.",
      );
      return;
    }

    setProjects(merged.projects);
    setActiveId(merged.projects[0]?.id ?? null);
    setIsScheduledProjectsOpen(true);
    setIsEditorOpen(true);
    setStatusMessage("Imported scheduled visit from Virtual Secretary.");
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
          2,
        ),
      ],
      { type: "application/json" },
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
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1),
    );
  }

  /* =========================
     CLEAN DISPATCH VIEW DATA
  ========================= */
  const dispatchProjects = useMemo(() => {
    if (viewMode === "Today") return scheduledToday;
    if (viewMode === "Week") return scheduledThisWeek;
    if (viewMode === "Trade") return filteredProjects;
    return filteredProjects;
  }, [viewMode, scheduledToday, scheduledThisWeek, filteredProjects]);

  const printProjects = [...filteredProjects];

  return (
    <div className="min-h-screen bg-[#ece3d4] text-[#1b1b1b]">
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5in;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
          }
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      <header className="no-print border-b border-[#8b6b47] bg-[#f7f1e7] shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.35em] text-[#9c6b2f]">
              5 Tools Dispatch
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#2e1f12] sm:text-4xl">
              Project Scheduler
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5a4633]">
              Clean dispatch board for property visits, vendor scheduling,
              work-order imports, and tracker handoff.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-xl border border-[#b38b66] bg-white px-4 py-2 text-sm font-black uppercase tracking-wide text-[#2f1f14] shadow-sm hover:bg-[#fff8ee]"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={addBlankProject}
              className="rounded-xl bg-[#4d3624] px-4 py-2 text-sm font-black uppercase tracking-wide text-[#f8f1e7] shadow-sm hover:bg-[#6b4a31]"
            >
              Add Job
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-[#c58a3b] px-4 py-2 text-sm font-black uppercase tracking-wide text-white shadow-sm hover:bg-[#ad742b]"
            >
              Print
            </button>
          </div>
        </div>

        <nav className="border-t border-[#8b6b47] bg-[#4d3624] shadow-inner">
          <div className="mx-auto flex max-w-7xl flex-wrap px-4 sm:px-6 lg:px-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.href === "/project-scheduler"
                    ? "border-b-4 border-[#d4a66a] bg-[#6b4a31] px-4 py-3 text-xs font-black uppercase tracking-wide text-white"
                    : "border-b-4 border-transparent px-4 py-3 text-xs font-black uppercase tracking-wide text-[#f5ede2] hover:border-[#d4a66a] hover:bg-[#6b4a31]"
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total", counts.total],
              ["New", counts.newCount],
              ["Scheduled", counts.scheduled],
              ["In Progress", counts.inProgress],
              ["Completed", counts.completed],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-[#c9ab86] bg-[#fffaf3] p-4 shadow-sm"
              >
                <div className="text-xs font-black uppercase tracking-wide text-[#8a6f22]">
                  {label}
                </div>
                <div className="mt-1 text-3xl font-black text-[#2f1f14]">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="no-print mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {statusMessage ? (
          <div className="mb-5 rounded-2xl border border-[#c9ab86] bg-[#fffaf3] px-4 py-3 text-sm font-semibold text-[#4d3624] shadow-sm">
            {statusMessage}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <section className="rounded-3xl border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-sm">
              <h2 className="text-xl font-black text-[#2f1f14]">Scheduler Sections</h2>
              <div className="mt-4 space-y-3">
                {([
                  ["Quick Add", "Add a new scheduled job"],
                  ["Dispatch Board", "Today, week, trade, or all jobs"],
                  ["Calendar", "Month calendar view"],
                  ["Job Editor", "Edit selected job details"],
                  ["Filters", "Search and narrow the board"],
                  ["Admin Tools", "Cloud, imports, export, clear"],
                ] as const).map(([label, description]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActivePanel(label)}
                    className={`flex w-full items-center justify-between border px-4 py-3 text-left transition ${activePanel === label ? "border-[#4d3624] bg-[#4d3624] text-white" : "border-[#c9ab86] bg-white text-[#2f1f14] hover:bg-[#fff8ee]"}`}
                  >
                    <span>
                      <span className="block text-sm font-black">{label}</span>
                      <span className={`mt-1 block text-xs ${activePanel === label ? "text-[#f1e6d8]" : "text-[#7b6044]"}`}>{description}</span>
                    </span>
                    <span className="text-lg">→</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-5 rounded-3xl border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wide text-[#8a6f22]">Current Selection</h3>
              <p className="mt-2 text-lg font-black text-[#2f1f14]">
                {activeProject?.propertyAddress || "No job selected"}
              </p>
              <p className="mt-1 text-sm text-[#5f4a39]">
                {activeProject ? `${activeProject.trade || "No trade"} • ${prettyDate(activeProject.dateScheduled)}` : "Choose a job from the dispatch board or calendar."}
              </p>
            </section>
          </aside>

          <section className="min-w-0 rounded-3xl border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 border-b border-[#c9ab86] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-[#2f1f14]">{activePanel}</h2>
                <p className="mt-1 text-sm text-[#5f4a39]">
                  {activePanel === "Quick Add" && "Create a scheduler item without opening the full editor."}
                  {activePanel === "Dispatch Board" && "Compact working board. Click a row to edit it."}
                  {activePanel === "Calendar" && "Calendar gets its own space."}
                  {activePanel === "Job Editor" && "Full detail editor for the selected item."}
                  {activePanel === "Filters" && "Control what appears on the dispatch board."}
                  {activePanel === "Admin Tools" && "Cloud save, import queues, export, and clear tools."}
                </p>
              </div>
              <button
                type="button"
                onClick={addBlankProject}
                className="rounded-xl bg-[#4d3624] px-4 py-2 text-sm font-black uppercase tracking-wide text-white hover:bg-[#6b4a31]"
              >
                Add Job
              </button>
            </div>

            {activePanel === "Quick Add" ? (
              <div className="max-w-3xl space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-[#4d3624]">Property Address</span>
                  <input
                    value={quickAddress}
                    onChange={(e) => setQuickAddress(e.target.value)}
                    className="w-full rounded-xl border border-[#c9ab86] bg-[#efe3d2] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#c58a3b] focus:bg-white"
                    placeholder="Property address"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-[#4d3624]">Trade</span>
                  <select
                    value={quickTrade}
                    onChange={(e) => setQuickTrade(e.target.value)}
                    className="w-full rounded-xl border border-[#c9ab86] bg-[#efe3d2] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#c58a3b] focus:bg-white"
                  >
                    {TRADE_OPTIONS.filter(Boolean).map((trade) => (
                      <option key={trade} value={trade}>{trade}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-[#4d3624]">Work Requested</span>
                  <textarea
                    value={quickDescription}
                    onChange={(e) => setQuickDescription(e.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-[#c9ab86] bg-[#efe3d2] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#c58a3b] focus:bg-white"
                    placeholder="Description of work requested"
                  />
                </label>
                <button
                  type="button"
                  onClick={addQuickProject}
                  className="rounded-xl bg-[#4d3624] px-5 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-[#6b4a31]"
                >
                  Add Scheduler Item
                </button>
              </div>
            ) : null}

            {activePanel === "Dispatch Board" ? (
              <div className="space-y-5">
                <div className="grid gap-2 sm:grid-cols-4">
                  {(["Today", "Week", "Trade", "All"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setViewMode(tab)}
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${viewMode === tab ? "bg-[#4d3624] text-white" : "border border-[#c9ab86] bg-white text-[#4d3624] hover:bg-[#fff8ee]"}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl border border-[#c9ab86] bg-white p-3 text-sm font-bold text-[#4d3624]">
                  Week: {prettyDate(thisWeekStart.toISOString().slice(0, 10))} - {prettyDate(thisWeekEnd.toISOString().slice(0, 10))} • {dispatchProjects.length} visible item{dispatchProjects.length === 1 ? "" : "s"}
                </div>

                {viewMode === "Trade" ? (
                  <div className="space-y-3">
                    {groupedByTrade.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#c9ab86] bg-[#fff8ee] p-8 text-center text-sm text-[#7b6044]">No grouped items to show.</div>
                    ) : (
                      groupedByTrade.map(([trade, items]) => (
                        <div key={trade} className="overflow-hidden rounded-2xl border border-[#c9ab86] bg-white">
                          <button
                            type="button"
                            onClick={() => toggleTradeGroup(trade)}
                            className="flex w-full items-center justify-between bg-[#fff8ee] px-4 py-3 text-left"
                          >
                            <div>
                              <div className="font-black text-[#2f1f14]">{trade}</div>
                              <div className="text-xs font-semibold text-[#7b6044]">{items.length} item{items.length === 1 ? "" : "s"}</div>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4d3624] shadow-sm ring-1 ring-[#d8d2c4]">{openTradeGroups[trade] ? "Hide" : "Show"}</span>
                          </button>
                          {openTradeGroups[trade] ? (
                            <div className="divide-y divide-[#efe3d2]">
                              {items.map((project) => (
                                <DispatchRow
                                  key={project.id}
                                  project={project}
                                  active={activeId === project.id}
                                  onSelect={() => { setActiveId(project.id); setActivePanel("Job Editor"); }}
                                  onTracker={() => sendToProjectTracker(project)}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : dispatchProjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#c9ab86] bg-[#fff8ee] p-8 text-center text-sm text-[#7b6044]">No scheduler items match this view.</div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#c9ab86] bg-white">
                    <div className="hidden grid-cols-[1.4fr_110px_110px_110px_110px_90px] gap-3 border-b border-[#c9ab86] bg-[#fff8ee] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#7b6044] lg:grid">
                      <div>Address / Work</div><div>Trade</div><div>Scheduled</div><div>Vendor</div><div>Status</div><div>Priority</div>
                    </div>
                    <div className="divide-y divide-[#efe3d2]">
                      {dispatchProjects.map((project) => (
                        <DispatchRow
                          key={project.id}
                          project={project}
                          active={activeId === project.id}
                          onSelect={() => { setActiveId(project.id); setActivePanel("Job Editor"); }}
                          onTracker={() => sendToProjectTracker(project)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {activePanel === "Calendar" ? (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-black text-[#2f1f14]">{monthLabel(calendarMonth)}</h3>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => shiftMonth(-1)} className="rounded-xl border border-[#c9ab86] bg-white px-3 py-2 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee]">Prev</button>
                    <button type="button" onClick={() => shiftMonth(1)} className="rounded-xl border border-[#c9ab86] bg-white px-3 py-2 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee]">Next</button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-[#7b6044]">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="rounded-xl bg-[#fff8ee] px-2 py-2">{d}</div>)}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const dayProjects = jobsForDay(day);
                    const inCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                    const isToday = sameDay(day, today);
                    return (
                      <div key={day.toISOString()} className={`min-h-[120px] rounded-2xl border p-2 ${inCurrentMonth ? "border-[#c9ab86] bg-white" : "border-[#c9ab86] bg-[#fff8ee] text-[#94a3b8]"} ${isToday ? "ring-2 ring-[#c9a227]" : ""}`}>
                        <div className="mb-2 flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-wide">{dayLabel(day)}</div><div className="text-sm font-bold">{shortDateNumber(day)}</div></div>
                        <div className="space-y-1">
                          {dayProjects.slice(0, 4).map((project) => (
                            <button key={project.id} type="button" onClick={() => { setActiveId(project.id); setActivePanel("Job Editor"); }} className={`block w-full rounded-lg border-l-4 bg-[#fff8ee] px-2 py-1 text-left text-[10px] leading-4 text-[#4d3624] hover:bg-[#efe3d2] ${statusBar(project.status)}`}>
                              <div className="font-bold">{truncate(project.trade || "Work", 14)}</div>
                              <div>{truncate(project.propertyAddress || "", 18)}</div>
                            </button>
                          ))}
                          {dayProjects.length > 4 ? <div className="rounded-lg bg-[#efe3d2] px-2 py-1 text-[10px] text-[#5f4a39]">+{dayProjects.length - 4} more</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {activePanel === "Job Editor" ? (
              !activeProject ? (
                <div className="rounded-2xl border border-dashed border-[#c9ab86] bg-[#fff8ee] p-8 text-center text-sm text-[#7b6044]">Select a job to edit.</div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <EditorInput label="Address" value={activeProject.propertyAddress} onChange={(value) => updateProject(activeProject.id, "propertyAddress", value)} />
                    <EditorInput label="Unit" value={activeProject.unit} onChange={(value) => updateProject(activeProject.id, "unit", value)} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <EditorSelect label="Trade" value={activeProject.trade} options={TRADE_OPTIONS} onChange={(value) => updateProject(activeProject.id, "trade", value)} />
                    <EditorSelect label="Status" value={activeProject.status} options={STATUS_OPTIONS} onChange={(value) => updateProject(activeProject.id, "status", value as ProjectStatus)} />
                    <EditorSelect label="Priority" value={activeProject.priority} options={PRIORITY_OPTIONS} onChange={(value) => updateProject(activeProject.id, "priority", value as Priority)} />
                    <EditorInput label="Assigned To" value={activeProject.assignedTo} onChange={(value) => updateProject(activeProject.id, "assignedTo", value)} />
                  </div>
                  <EditorTextArea label="Description" value={activeProject.description} rows={4} onChange={(value) => updateProject(activeProject.id, "description", value)} />
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <EditorInput label="Date Requested" type="date" value={activeProject.dateRequested} onChange={(value) => updateProject(activeProject.id, "dateRequested", value)} />
                    <EditorInput label="Date Scheduled" type="date" value={activeProject.dateScheduled} onChange={(value) => updateProject(activeProject.id, "dateScheduled", value)} />
                    <EditorInput label="Target Completion" type="date" value={activeProject.targetCompletion} onChange={(value) => updateProject(activeProject.id, "targetCompletion", value)} />
                    <EditorInput label="Requested By" value={activeProject.requestedBy} onChange={(value) => updateProject(activeProject.id, "requestedBy", value)} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <EditorInput label="Vendor" value={activeProject.vendor} onChange={(value) => updateProject(activeProject.id, "vendor", value)} />
                    <EditorInput label="Tenant" value={activeProject.tenantName} onChange={(value) => updateProject(activeProject.id, "tenantName", value)} />
                    <EditorInput label="Tenant Phone" value={activeProject.tenantPhone} onChange={(value) => updateProject(activeProject.id, "tenantPhone", value)} />
                  </div>
                  <EditorTextArea label="Access Notes" value={activeProject.accessNotes} rows={3} onChange={(value) => updateProject(activeProject.id, "accessNotes", value)} />
                  <EditorTextArea label="Internal Notes" value={activeProject.notes} rows={4} onChange={(value) => updateProject(activeProject.id, "notes", value)} />
                  {renderTimeLogSummary(activeProject)}
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" onClick={() => duplicateProject(activeProject.id)} className="rounded-xl border border-[#c9ab86] bg-white px-3 py-2 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee]">Copy</button>
                    <button type="button" onClick={() => sendToProjectTracker(activeProject)} className="rounded-xl bg-[#4d3624] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6b4a31]">Send to Tracker</button>
                    <button type="button" onClick={() => deleteProject(activeProject.id)} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Delete</button>
                  </div>
                </div>
              )
            ) : null}

            {activePanel === "Filters" ? (
              <div className="max-w-3xl space-y-4">
                <EditorInput label="Search" value={search} onChange={setSearch} />
                <EditorSelect label="Status" value={filterStatus} options={["All", ...STATUS_OPTIONS]} onChange={setFilterStatus} />
                <EditorSelect label="Trade" value={filterTrade} options={["All", ...Array.from(new Set(projects.map((p) => p.trade).filter(Boolean))) as string[]]} onChange={setFilterTrade} />
                <EditorSelect label="Priority" value={filterPriority} options={["All", ...PRIORITY_OPTIONS]} onChange={setFilterPriority} />
                <label className="inline-flex items-center gap-2 rounded-xl border border-[#c9ab86] bg-[#fff8ee] px-3 py-2 text-sm text-[#4d3624]">
                  <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="h-4 w-4" />
                  Show completed jobs
                </label>
              </div>
            ) : null}

            {activePanel === "Admin Tools" ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <section className="rounded-2xl border border-[#c9ab86] bg-white p-4">
                  <h3 className="text-lg font-black text-[#2f1f14]">Imports / Backup</h3>
                  <div className="mt-4 grid gap-2">
                    <button type="button" onClick={importWorkOrdersFromQueue} className="rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8921f]">Import Work Orders</button>
                    <button type="button" onClick={importSecretaryScheduleDraft} className="rounded-xl border border-[#c9a227] bg-[#fff8ee] px-4 py-2.5 text-sm font-semibold text-[#4d3624] hover:bg-[#efe3d2]">Import Secretary Draft</button>
                    <button type="button" onClick={loadTimeEntries} className="rounded-xl border border-[#c9ab86] bg-white px-4 py-2.5 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee]">Refresh Employee Time</button>
                    <button type="button" onClick={exportJson} className="rounded-xl border border-[#c9ab86] bg-white px-4 py-2.5 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee]">Export JSON Backup</button>
                    <button type="button" onClick={clearAll} className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100">Clear Local Scheduler</button>
                  </div>
                </section>
                <section className="rounded-2xl border border-[#c9ab86] bg-white p-4">
                  <h3 className="text-lg font-black text-[#2f1f14]">Cloud Save</h3>
                  <div className="mt-4 space-y-3">
                    <EditorInput label="Scheduler Name" value={boardName} onChange={setBoardName} />
                    <button type="button" onClick={refreshCloudRecords} disabled={isRefreshingCloud} className="w-full rounded-xl border border-[#c9ab86] bg-white px-4 py-2.5 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee] disabled:opacity-50">{isRefreshingCloud ? "Refreshing..." : "Refresh Cloud List"}</button>
                    <select value={selectedCloudId} onChange={(e) => setSelectedCloudId(e.target.value)} className="w-full rounded-xl border border-[#c9ab86] bg-[#efe3d2] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#c58a3b] focus:bg-white">
                      <option value="">New record / no selection</option>
                      {cloudRecords.map((record) => (
                        <option key={record.id} value={record.id}>{record.board_name || "Unnamed Scheduler"}{record.items_json?.[0]?.propertyAddress ? ` — ${record.items_json[0].propertyAddress}` : ""} — {prettyDate(record.updated_at.slice(0, 10))}</option>
                      ))}
                    </select>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={saveToCloud} disabled={isSavingCloud} className="rounded-xl bg-[#4d3624] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6b4a31] disabled:opacity-50">{isSavingCloud ? "Saving..." : selectedCloudId ? "Update Cloud" : "Save Cloud"}</button>
                      <button type="button" onClick={loadFromCloud} disabled={isLoadingCloud} className="rounded-xl border border-[#c9ab86] bg-white px-4 py-2.5 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee] disabled:opacity-50">{isLoadingCloud ? "Loading..." : "Load Selected"}</button>
                      <button type="button" onClick={createNewCloudRecord} className="rounded-xl border border-[#c9ab86] bg-white px-4 py-2.5 text-sm font-semibold text-[#4d3624] hover:bg-[#fff8ee]">New Cloud Record</button>
                      <button type="button" onClick={deleteCloudRecord} disabled={isDeletingCloud} className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">{isDeletingCloud ? "Deleting..." : "Delete Cloud"}</button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <footer className="no-print border-t border-[#8b6b47] bg-[#3f2a1b] px-8 py-6 text-center text-xs leading-6 text-[#f1e6d8]">
        5 Tools Project Scheduler supports work order imports, vendor
        scheduling, calendar dispatch, employee time review, and project tracker
        handoff.
      </footer>

      <div className="print-only px-8 py-8 text-[#111111]">
        <div className="border-b-2 border-[#c58a3b] pb-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-3xl font-black tracking-tight text-[#2f1f14]">
                5 Tools
              </div>
              <div className="mt-1 text-sm font-black uppercase tracking-[0.22em] text-[#8a6f22]">
                Project Scheduler Report
              </div>
              <h1 className="mt-3 text-2xl font-black">
                {boardName || "Project Scheduler"}
              </h1>
            </div>
            <div className="rounded-xl border border-[#c9ab86] bg-[#fff8ee] p-4 text-right text-xs text-[#5f4a39]">
              <div className="font-bold text-[#2f1f14]">Printed</div>
              <div>{new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          {printProjects.length === 0 ? (
            <div className="rounded-xl border border-[#c9ab86] p-4 text-sm text-[#5f4a39]">
              No scheduler items available.
            </div>
          ) : (
            printProjects.map((project, index) => (
              <div
                key={project.id}
                className="print-card rounded-2xl border border-[#c9ab86] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-[#7b6044]">
                      Project {index + 1}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">
                      {project.propertyAddress || "Untitled project"}
                    </h3>
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      <span className="font-semibold">Status:</span>{" "}
                      {project.status}
                    </div>
                    <div>
                      <span className="font-semibold">Priority:</span>{" "}
                      {project.priority}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-semibold">Trade:</span>{" "}
                    {project.trade || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Vendor:</span>{" "}
                    {project.vendor || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Assigned To:</span>{" "}
                    {project.assignedTo || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">Scheduled:</span>{" "}
                    {prettyDate(project.dateScheduled)}
                  </div>
                </div>
                {project.description ? (
                  <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#fff8ee] p-3 text-sm">
                    {project.description}
                  </div>
                ) : null}
                {project.accessNotes ? (
                  <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#fff8ee] p-3 text-sm">
                    <strong>Access:</strong> {project.accessNotes}
                  </div>
                ) : null}
                {project.notes ? (
                  <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#fff8ee] p-3 text-sm">
                    <strong>Notes:</strong> {project.notes}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DispatchRow({
  project,
  active,
  onSelect,
  onTracker,
}: {
  project: ProjectItem;
  active: boolean;
  onSelect: () => void;
  onTracker: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full gap-3 border-l-4 px-4 py-3 text-left transition hover:bg-[#fff8ee] lg:grid-cols-[1.4fr_110px_110px_110px_110px_90px] ${statusBar(project.status)} ${active ? "bg-[#fff8ee] ring-2 ring-inset ring-[#c9a227]" : "bg-white"}`}
    >
      <div className="min-w-0">
        <div className="font-black text-[#111111]">
          {project.propertyAddress || "Untitled job"}
          {project.unit ? ` #${project.unit}` : ""}
        </div>
        <div className="mt-1 line-clamp-1 text-sm text-[#5f4a39]">
          {project.description || "No description entered"}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 lg:hidden">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(project.status)}`}
          >
            {project.status}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(project.priority)}`}
          >
            {project.priority}
          </span>
          <span className="rounded-full border border-[#c9ab86] bg-[#fff8ee] px-2.5 py-1 text-xs font-semibold text-[#4d3624]">
            {project.trade || "No trade"}
          </span>
        </div>
      </div>
      <div className="hidden items-center text-sm font-semibold text-[#4d3624] lg:flex">
        {project.trade || "-"}
      </div>
      <div className="hidden items-center text-sm font-semibold text-[#4d3624] lg:flex">
        {prettyDate(project.dateScheduled)}
      </div>
      <div className="hidden items-center text-sm font-semibold text-[#4d3624] lg:flex">
        {project.vendor || project.assignedTo || "-"}
      </div>
      <div className="hidden items-center lg:flex">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(project.status)}`}
        >
          {project.status}
        </span>
      </div>
      <div className="hidden items-center justify-between gap-2 lg:flex">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(project.priority)}`}
        >
          {project.priority}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTracker();
          }}
          className="rounded-lg bg-[#4d3624] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#6b4a31]"
        >
          Tracker
        </button>
      </div>
    </button>
  );
}

function EditorInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#4d3624]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#c9ab86] bg-[#efe3d2] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#c58a3b] focus:bg-white"
      />
    </label>
  );
}

function EditorSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#4d3624]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#c9ab86] bg-[#efe3d2] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#c58a3b] focus:bg-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "Select"}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditorTextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#4d3624]">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#c9ab86] bg-[#efe3d2] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#c58a3b] focus:bg-white"
      />
    </label>
  );
}
