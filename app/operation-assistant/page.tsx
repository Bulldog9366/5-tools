"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TabKey = "today" | "calendar" | "reminders" | "schedule" | "all";
type ItemType = "task" | "appointment" | "reminder";
type Status = "pending" | "in_progress" | "waiting" | "completed";
type Priority = "low" | "normal" | "high" | "urgent";
type RepeatRule = "none" | "daily" | "weekly" | "monthly";
type WorkflowTemplate = "move_out_timeline" | "vendor_follow_up" | "inspection_follow_up";

type AssistantItem = {
  id: string;
  title: string;
  type: ItemType;
  category: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  tenantName: string;
  vendorName: string;
  contactName: string;
  assignedTo: string;
  jobStatus: string;
  requiresFollowUp: boolean;
  startDate: string;
  dueDate: string;
  dueTime: string;
  reminderMinutes: string;
  repeatRule: RepeatRule;
  priority: Priority;
  status: Status;
  notes: string;
  sourceModule: string;
  createdAt: string;
  completedAt?: string;
};

type FormState = {
  title: string;
  type: ItemType;
  category: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  tenantName: string;
  vendorName: string;
  contactName: string;
  assignedTo: string;
  jobStatus: string;
  requiresFollowUp: boolean;
  startDate: string;
  dueDate: string;
  dueTime: string;
  reminderMinutes: string;
  repeatRule: RepeatRule;
  priority: Priority;
  status: Status;
  notes: string;
  sourceModule: string;
};

const STORAGE_KEY = "operations-assistant-items-v1";

const emptyForm = (): FormState => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: "",
    type: "task",
    category: "",
    propertyId: "",
    propertyName: "",
    unit: "",
    tenantName: "",
    vendorName: "",
    contactName: "",
    assignedTo: "",
    jobStatus: "new",
    requiresFollowUp: false,
    startDate: today,
    dueDate: today,
    dueTime: "",
    reminderMinutes: "30",
    repeatRule: "none",
    priority: "normal",
    status: "pending",
    notes: "",
    sourceModule: "manual",
  };
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function addDaysISO(baseDate: string, days: number) {
  const safeBase = baseDate || new Date().toISOString().slice(0, 10);
  const dt = new Date(`${safeBase}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTimeLabel(date: string, time: string) {
  if (!date) return "—";
  const raw = `${date}T${time || "00:00"}:00`;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return `${date}${time ? ` ${time}` : ""}`;
  return dt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: time ? "numeric" : undefined,
    minute: time ? "2-digit" : undefined,
  });
}

function isSameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function getItemDate(item: AssistantItem) {
  const base = item.dueDate || item.startDate;
  if (!base) return null;
  const dt = new Date(`${base}T${item.dueTime || "00:00"}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function sortItems(items: AssistantItem[]) {
  return [...items].sort((a, b) => {
    const aDate = getItemDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDate = getItemDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return a.title.localeCompare(b.title);
  });
}

function badgeClass(priority: Priority) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700 border-red-200";
    case "high":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "low":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

function statusClass(status: Status) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "in_progress":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "waiting":
      return "bg-violet-100 text-violet-700 border-violet-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function TabButton({
  label,
  value,
  activeTab,
  onClick,
}: {
  label: string;
  value: TabKey;
  activeTab: TabKey;
  onClick: (value: TabKey) => void;
}) {
  const active = activeTab === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white ${props.className || ""}`}
    />
  );
}

function MetricCard({ title, value, subtext }: { title: string; value: string | number; subtext: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtext}</div>
    </div>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
  onToggleComplete,
}: {
  item: AssistantItem;
  onEdit: (item: AssistantItem) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (item: AssistantItem) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{item.title || "Untitled item"}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass(item.priority)}`}>
              {item.priority}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass(item.status)}`}>
              {item.status.replace("_", " ")}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {item.type}
            </span>
          </div>

          <div className="mt-3 grid gap-3 text-sm text-slate-600 grid-cols-1">
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">DUE</div><div className="text-sm text-slate-800">{formatDateTimeLabel(item.dueDate || item.startDate, item.dueTime)}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">PROPERTY</div><div className="text-sm text-slate-800">{item.propertyName || "—"}{item.unit ? ` / ${item.unit}` : ""}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">PROPERTY ID</div><div className="text-sm text-slate-800">{item.propertyId || "—"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">ASSIGNED</div><div className="text-sm text-slate-800">{item.assignedTo || "—"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">CATEGORY</div><div className="text-sm text-slate-800">{item.category || "—"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">TENANT</div><div className="text-sm text-slate-800">{item.tenantName || "—"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">VENDOR</div><div className="text-sm text-slate-800">{item.vendorName || "—"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">CONTACT</div><div className="text-sm text-slate-800">{item.contactName || "—"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">JOB STATUS</div><div className="text-sm text-slate-800">{item.jobStatus || "—"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">FOLLOW UP</div><div className="text-sm text-slate-800">{item.requiresFollowUp ? "Yes" : "No"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">SOURCE</div><div className="text-sm text-slate-800">{item.sourceModule || "manual"}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">REPEAT</div><div className="text-sm text-slate-800">{item.repeatRule}</div></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-xs font-semibold text-slate-500">REMINDER</div><div className="text-sm text-slate-800">{item.reminderMinutes ? `${item.reminderMinutes} min` : "—"}</div></div>
          </div>

          {item.notes ? (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item.notes}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:ml-4">
          <button
            type="button"
            onClick={() => onToggleComplete(item)}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {item.status === "completed" ? "Reopen" : "Complete"}
          </button>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OperationsAssistantPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [items, setItems] = useState<AssistantItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [followUpFilter, setFollowUpFilter] = useState<string>("all");
  const [message, setMessage] = useState("Local save ready.");
  const [workflowTemplate, setWorkflowTemplate] = useState<WorkflowTemplate>("move_out_timeline");
  const [workflowPropertyName, setWorkflowPropertyName] = useState("");
  const [workflowUnit, setWorkflowUnit] = useState("");
  const [workflowTenantName, setWorkflowTenantName] = useState("");
  const [workflowVendorName, setWorkflowVendorName] = useState("");
  const [workflowAssignedTo, setWorkflowAssignedTo] = useState("");
  const [workflowAnchorDate, setWorkflowAnchorDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AssistantItem[];
      if (Array.isArray(parsed)) {
        setItems(sortItems(parsed));
        setMessage("Saved schedule loaded from this device.");
      }
    } catch {
      setMessage("Could not load saved schedule data.");
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // no-op
    }
  }, [items]);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const assignedPeople = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => item.assignedTo.trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.category,
        item.propertyId,
        item.propertyName,
        item.unit,
        item.tenantName,
        item.vendorName,
        item.contactName,
        item.assignedTo,
        item.notes,
        item.sourceModule,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesAssigned = assignedFilter === "all" || item.assignedTo === assignedFilter;
      const matchesFollowUp =
        followUpFilter === "all" ||
        (followUpFilter === "yes" && item.requiresFollowUp) ||
        (followUpFilter === "no" && !item.requiresFollowUp);
      return matchesSearch && matchesStatus && matchesAssigned && matchesFollowUp;
    });
  }, [items, searchTerm, statusFilter, assignedFilter]);

  const todayItems = useMemo(() => {
    return filteredItems.filter((item) => {
      const dt = getItemDate(item);
      return dt ? isSameDay(dt, todayStart) : false;
    });
  }, [filteredItems, todayStart]);

  const overdueItems = useMemo(() => {
    return filteredItems.filter((item) => {
      const dt = getItemDate(item);
      return dt ? dt < todayStart && item.status !== "completed" : false;
    });
  }, [filteredItems, todayStart]);

  const upcomingWeekItems = useMemo(() => {
    return filteredItems.filter((item) => {
      const dt = getItemDate(item);
      return dt ? dt >= todayStart && dt < weekEnd : false;
    });
  }, [filteredItems, todayStart, weekEnd]);

  const calendarItems = useMemo(() => {
    return filteredItems.filter((item) => item.type === "appointment");
  }, [filteredItems]);

  const reminderItems = useMemo(() => {
    return filteredItems.filter((item) => item.type === "reminder");
  }, [filteredItems]);

  const workScheduleItems = useMemo(() => {
    return filteredItems.filter((item) => item.type === "task" || item.type === "appointment");
  }, [filteredItems]);

  const metrics = useMemo(() => {
    const openItems = items.filter((item) => item.status !== "completed").length;
    const completedThisDevice = items.filter((item) => item.status === "completed").length;
    return {
      today: todayItems.length,
      overdue: overdueItems.length,
      open: openItems,
      completed: completedThisDevice,
    };
  }, [items, overdueItems.length, todayItems.length]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearForm() {
    setForm(emptyForm());
    setEditingId(null);
    setMessage("Form cleared.");
  }

  function seedExamples() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const demo: AssistantItem[] = [
      {
        id: uid(),
        title: "Vendor appointment - Unit 7",
        type: "appointment",
        category: "maintenance",
        propertyId: "orchard-7",
        propertyName: "North Orchard Street",
        unit: "Unit 7",
        tenantName: "",
        vendorName: "Vendor",
        contactName: "Vendor",
        assignedTo: "Eric",
        jobStatus: "scheduled",
        requiresFollowUp: true,
        startDate: todayStr,
        dueDate: todayStr,
        dueTime: "10:00",
        reminderMinutes: "60",
        repeatRule: "none",
        priority: "high",
        status: "pending",
        notes: "Confirm access with tenant before arrival.",
        sourceModule: "work-order",
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: "Follow up on garage door issue",
        type: "reminder",
        category: "tenant follow-up",
        propertyId: "maple-3",
        propertyName: "Maple Court",
        unit: "Unit 3",
        tenantName: "Current Tenant",
        vendorName: "",
        contactName: "Tenant",
        assignedTo: "Eric",
        jobStatus: "waiting_on_tenant",
        requiresFollowUp: true,
        startDate: todayStr,
        dueDate: todayStr,
        dueTime: "14:00",
        reminderMinutes: "30",
        repeatRule: "none",
        priority: "normal",
        status: "pending",
        notes: "Verify contractor made contact.",
        sourceModule: "manual",
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: "Prepare move-out turn schedule",
        type: "task",
        category: "turn prep",
        propertyId: "812-orchard-main",
        propertyName: "812 N Orchard Street",
        unit: "Main",
        tenantName: "",
        vendorName: "",
        contactName: "Owner",
        assignedTo: "Eric",
        jobStatus: "in_progress",
        requiresFollowUp: false,
        startDate: tomorrowStr,
        dueDate: tomorrowStr,
        dueTime: "09:00",
        reminderMinutes: "120",
        repeatRule: "none",
        priority: "urgent",
        status: "in_progress",
        notes: "Line up cleaners, inspection, and maintenance walk.",
        sourceModule: "move-out",
        createdAt: new Date().toISOString(),
      },
    ];

    setItems(sortItems(demo));
    setMessage("Sample schedule loaded.");
    setActiveTab("today");
  }

  function generateWorkflow() {
    const propertyName = workflowPropertyName.trim();
    const unit = workflowUnit.trim();
    const tenantName = workflowTenantName.trim();
    const vendorName = workflowVendorName.trim();
    const assignedTo = workflowAssignedTo.trim();
    const anchorDate = workflowAnchorDate;

    if (!propertyName) {
      setMessage("Workflow generator needs a property name.");
      return;
    }

    const common = {
      propertyId: "",
      propertyName,
      unit,
      tenantName,
      vendorName,
      contactName: tenantName || vendorName || "",
      assignedTo,
      reminderMinutes: "30",
      repeatRule: "none" as RepeatRule,
      priority: "normal" as Priority,
      status: "pending" as Status,
      sourceModule: "workflow-generator",
      createdAt: new Date().toISOString(),
    };

    let generated: AssistantItem[] = [];

    if (workflowTemplate === "move_out_timeline") {
      generated = [
        {
          id: uid(),
          title: `Send move-out confirmation${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "move-out",
          jobStatus: "new",
          requiresFollowUp: true,
          startDate: addDaysISO(anchorDate, -7),
          dueDate: addDaysISO(anchorDate, -7),
          dueTime: "09:00",
          notes: "Confirm notice received and outline next steps.",
          ...common,
        },
        {
          id: uid(),
          title: `Send move-out checklist${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "move-out",
          jobStatus: "new",
          requiresFollowUp: true,
          startDate: addDaysISO(anchorDate, -7),
          dueDate: addDaysISO(anchorDate, -7),
          dueTime: "10:00",
          notes: "Provide cleaning, key return, and utility expectations.",
          ...common,
        },
        {
          id: uid(),
          title: `Final move-out inspection${unit ? ` - ${unit}` : ""}`,
          type: "appointment",
          category: "move-out inspection",
          jobStatus: "scheduled",
          requiresFollowUp: false,
          startDate: anchorDate,
          dueDate: anchorDate,
          dueTime: "14:00",
          notes: "Verify condition, photos, and possession status.",
          ...common,
        },
        {
          id: uid(),
          title: `Confirm key return and vacancy${unit ? ` - ${unit}` : ""}`,
          type: "reminder",
          category: "move-out",
          jobStatus: "waiting_on_tenant",
          requiresFollowUp: true,
          startDate: anchorDate,
          dueDate: anchorDate,
          dueTime: "17:00",
          notes: "Confirm keys are received and unit is fully surrendered.",
          ...common,
        },
        {
          id: uid(),
          title: `Turnover walkthrough${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "turn prep",
          jobStatus: "new",
          requiresFollowUp: false,
          startDate: addDaysISO(anchorDate, 1),
          dueDate: addDaysISO(anchorDate, 1),
          dueTime: "09:00",
          notes: "Walk the unit and identify make-ready scope.",
          ...common,
        },
        {
          id: uid(),
          title: `Build make-ready scope${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "make ready",
          jobStatus: "new",
          requiresFollowUp: false,
          startDate: addDaysISO(anchorDate, 2),
          dueDate: addDaysISO(anchorDate, 2),
          dueTime: "11:00",
          notes: "Create turnover scope, vendors, and target completion date.",
          ...common,
        },
        {
          id: uid(),
          title: `Start marketing and listing prep${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "leasing",
          jobStatus: "new",
          requiresFollowUp: false,
          startDate: addDaysISO(anchorDate, 3),
          dueDate: addDaysISO(anchorDate, 3),
          dueTime: "13:00",
          notes: "Prepare photos, pricing review, and listing plan.",
          ...common,
        },
        {
          id: uid(),
          title: `Deposit disposition deadline reminder${unit ? ` - ${unit}` : ""}`,
          type: "reminder",
          category: "deposit disposition",
          jobStatus: "new",
          requiresFollowUp: true,
          startDate: addDaysISO(anchorDate, 14),
          dueDate: addDaysISO(anchorDate, 14),
          dueTime: "09:00",
          notes: "Review deposit accounting and final disposition deadline.",
          ...common,
        },
      ];
    }

    if (workflowTemplate === "vendor_follow_up") {
      generated = [
        {
          id: uid(),
          title: `Confirm vendor appointment${unit ? ` - ${unit}` : ""}`,
          type: "appointment",
          category: "vendor follow-up",
          jobStatus: "scheduled",
          requiresFollowUp: true,
          startDate: anchorDate,
          dueDate: anchorDate,
          dueTime: "10:00",
          notes: "Confirm access, scope, and ETA with vendor.",
          ...common,
        },
        {
          id: uid(),
          title: `Verify work completed${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "vendor follow-up",
          jobStatus: "waiting_on_vendor",
          requiresFollowUp: true,
          startDate: addDaysISO(anchorDate, 1),
          dueDate: addDaysISO(anchorDate, 1),
          dueTime: "15:00",
          notes: "Check if work was completed and whether return visit is needed.",
          ...common,
        },
        {
          id: uid(),
          title: `Collect invoice and photos${unit ? ` - ${unit}` : ""}`,
          type: "reminder",
          category: "vendor follow-up",
          jobStatus: "waiting_on_vendor",
          requiresFollowUp: true,
          startDate: addDaysISO(anchorDate, 2),
          dueDate: addDaysISO(anchorDate, 2),
          dueTime: "11:00",
          notes: "Collect invoice, receipts, and completion photos.",
          ...common,
        },
      ];
    }

    if (workflowTemplate === "inspection_follow_up") {
      generated = [
        {
          id: uid(),
          title: `Review inspection findings${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "inspection follow-up",
          jobStatus: "new",
          requiresFollowUp: false,
          startDate: anchorDate,
          dueDate: anchorDate,
          dueTime: "16:00",
          notes: "Review photos, notes, and prioritized repair items.",
          ...common,
        },
        {
          id: uid(),
          title: `Create work orders from inspection${unit ? ` - ${unit}` : ""}`,
          type: "task",
          category: "inspection follow-up",
          jobStatus: "new",
          requiresFollowUp: false,
          startDate: addDaysISO(anchorDate, 1),
          dueDate: addDaysISO(anchorDate, 1),
          dueTime: "09:00",
          notes: "Create vendor tasks and assign priority.",
          ...common,
        },
        {
          id: uid(),
          title: `Follow up on inspection repairs${unit ? ` - ${unit}` : ""}`,
          type: "reminder",
          category: "inspection follow-up",
          jobStatus: "waiting_on_vendor",
          requiresFollowUp: true,
          startDate: addDaysISO(anchorDate, 3),
          dueDate: addDaysISO(anchorDate, 3),
          dueTime: "10:00",
          notes: "Check vendor scheduling and repair completion progress.",
          ...common,
        },
      ];
    }

    setItems((prev) => sortItems([...prev, ...generated]));
    setMessage(`${generated.length} workflow items generated.`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim()) {
      setMessage("Title is required.");
      return;
    }

    const payload: AssistantItem = {
      id: editingId || uid(),
      title: form.title.trim(),
      type: form.type,
      category: form.category.trim(),
      propertyId: form.propertyId.trim(),
      propertyName: form.propertyName.trim(),
      unit: form.unit.trim(),
      tenantName: form.tenantName.trim(),
      vendorName: form.vendorName.trim(),
      contactName: form.contactName.trim(),
      assignedTo: form.assignedTo.trim(),
      jobStatus: form.jobStatus.trim() || "new",
      requiresFollowUp: form.requiresFollowUp,
      startDate: form.startDate,
      dueDate: form.dueDate,
      dueTime: form.dueTime,
      reminderMinutes: form.reminderMinutes,
      repeatRule: form.repeatRule,
      priority: form.priority,
      status: form.status,
      notes: form.notes.trim(),
      sourceModule: form.sourceModule.trim() || "manual",
      createdAt: editingId
        ? items.find((item) => item.id === editingId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      completedAt:
        form.status === "completed"
          ? items.find((item) => item.id === editingId)?.completedAt || new Date().toISOString()
          : undefined,
    };

    setItems((prev) => {
      const next = editingId
        ? prev.map((item) => (item.id === editingId ? payload : item))
        : [...prev, payload];
      return sortItems(next);
    });

    setMessage(editingId ? "Item updated." : "Item added.");
    clearForm();
  }

  function handleEdit(item: AssistantItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      type: item.type,
      category: item.category,
      propertyId: item.propertyId,
      propertyName: item.propertyName,
      unit: item.unit,
      tenantName: item.tenantName,
      vendorName: item.vendorName,
      contactName: item.contactName,
      assignedTo: item.assignedTo,
      jobStatus: item.jobStatus,
      requiresFollowUp: item.requiresFollowUp,
      startDate: item.startDate,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      reminderMinutes: item.reminderMinutes,
      repeatRule: item.repeatRule,
      priority: item.priority,
      status: item.status,
      notes: item.notes,
      sourceModule: item.sourceModule,
    });
    setMessage(`Editing: ${item.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) clearForm();
    setMessage("Item deleted.");
  }

  function handleToggleComplete(item: AssistantItem) {
    setItems((prev) =>
      sortItems(
        prev.map((current) =>
          current.id === item.id
            ? {
                ...current,
                status: current.status === "completed" ? "pending" : "completed",
                completedAt: current.status === "completed" ? undefined : new Date().toISOString(),
              }
            : current,
        ),
      ),
    );
    setMessage(item.status === "completed" ? "Item reopened." : "Item completed.");
  }

  function clearAllData() {
    setItems([]);
    clearForm();
    window.localStorage.removeItem(STORAGE_KEY);
    setMessage("All local schedule data cleared.");
  }

  const displayedItems =
    activeTab === "today"
      ? sortItems([...todayItems, ...overdueItems.filter((item) => !todayItems.some((t) => t.id === item.id))])
      : activeTab === "calendar"
      ? sortItems(calendarItems)
      : activeTab === "reminders"
      ? sortItems(reminderItems)
      : activeTab === "schedule"
      ? sortItems(workScheduleItems)
      : sortItems(filteredItems);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
                Operations Assistant
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Calendar, reminders, and work schedule</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                First-pass assistant hub for appointments, reminders, property tasks, and daily operations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                Back to Dashboard
              </Link>
              <button
                type="button"
                onClick={seedExamples}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Load Sample Data
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Today" value={metrics.today} subtext="Items due today" />
          <MetricCard title="Overdue" value={metrics.overdue} subtext="Open items behind schedule" />
          <MetricCard title="Open" value={metrics.open} subtext="Active schedule items" />
          <MetricCard title="Completed" value={metrics.completed} subtext="Finished on this device" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{editingId ? "Edit item" : "Add item"}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create tasks, reminders, or calendar appointments.
                </p>
              </div>
              <button
                type="button"
                onClick={clearForm}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {message}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Quick Workflow Generator</h3>
                  <p className="mt-1 text-sm text-slate-500">Generate bundled tasks from a common property-management workflow.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Workflow template</FieldLabel>
                  <Select value={workflowTemplate} onChange={(e) => setWorkflowTemplate(e.target.value as WorkflowTemplate)}>
                    <option value="move_out_timeline">Move-Out Timeline</option>
                    <option value="vendor_follow_up">Vendor Follow-Up</option>
                    <option value="inspection_follow_up">Inspection Follow-Up</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Anchor date</FieldLabel>
                  <TextInput type="date" value={workflowAnchorDate} onChange={(e) => setWorkflowAnchorDate(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Property name</FieldLabel>
                  <TextInput value={workflowPropertyName} onChange={(e) => setWorkflowPropertyName(e.target.value)} placeholder="Dunbar" />
                </div>
                <div>
                  <FieldLabel>Unit</FieldLabel>
                  <TextInput value={workflowUnit} onChange={(e) => setWorkflowUnit(e.target.value)} placeholder="8115 or Unit 7" />
                </div>
                <div>
                  <FieldLabel>Tenant name</FieldLabel>
                  <TextInput value={workflowTenantName} onChange={(e) => setWorkflowTenantName(e.target.value)} placeholder="Tenant name" />
                </div>
                <div>
                  <FieldLabel>Vendor name</FieldLabel>
                  <TextInput value={workflowVendorName} onChange={(e) => setWorkflowVendorName(e.target.value)} placeholder="Vendor / contractor" />
                </div>
                <div>
                  <FieldLabel>Assigned to</FieldLabel>
                  <TextInput value={workflowAssignedTo} onChange={(e) => setWorkflowAssignedTo(e.target.value)} placeholder="Eric" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateWorkflow}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Generate Workflow
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="Ex: Vendor appointment for Unit 7"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <Select value={form.type} onChange={(e) => updateForm("type", e.target.value as ItemType)}>
                    <option value="task">Task</option>
                    <option value="appointment">Appointment</option>
                    <option value="reminder">Reminder</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <TextInput
                    value={form.category}
                    onChange={(e) => updateForm("category", e.target.value)}
                    placeholder="maintenance, move-out, lease, owner follow-up"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Property ID</FieldLabel>
                  <TextInput
                    value={form.propertyId}
                    onChange={(e) => updateForm("propertyId", e.target.value)}
                    placeholder="orchard-7 or appfolio property id"
                  />
                </div>
                <div>
                  <FieldLabel>Property name</FieldLabel>
                  <TextInput
                    value={form.propertyName}
                    onChange={(e) => updateForm("propertyName", e.target.value)}
                    placeholder="North Orchard Street"
                  />
                </div>
                <div>
                  <FieldLabel>Unit</FieldLabel>
                  <TextInput value={form.unit} onChange={(e) => updateForm("unit", e.target.value)} placeholder="Unit 7" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Tenant name</FieldLabel>
                  <TextInput
                    value={form.tenantName}
                    onChange={(e) => updateForm("tenantName", e.target.value)}
                    placeholder="Tenant name"
                  />
                </div>
                <div>
                  <FieldLabel>Vendor name</FieldLabel>
                  <TextInput
                    value={form.vendorName}
                    onChange={(e) => updateForm("vendorName", e.target.value)}
                    placeholder="Vendor / contractor"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Contact / person</FieldLabel>
                  <TextInput
                    value={form.contactName}
                    onChange={(e) => updateForm("contactName", e.target.value)}
                    placeholder="tenant, owner, vendor"
                  />
                </div>
                <div>
                  <FieldLabel>Assigned to</FieldLabel>
                  <TextInput
                    value={form.assignedTo}
                    onChange={(e) => updateForm("assignedTo", e.target.value)}
                    placeholder="Eric"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Start date</FieldLabel>
                  <TextInput type="date" value={form.startDate} onChange={(e) => updateForm("startDate", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Due date</FieldLabel>
                  <TextInput type="date" value={form.dueDate} onChange={(e) => updateForm("dueDate", e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Due time</FieldLabel>
                  <TextInput type="time" value={form.dueTime} onChange={(e) => updateForm("dueTime", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Reminder before due</FieldLabel>
                  <Select value={form.reminderMinutes} onChange={(e) => updateForm("reminderMinutes", e.target.value)}>
                    <option value="">None</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="1440">1 day</option>
                    <option value="2880">2 days</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Repeat</FieldLabel>
                  <Select value={form.repeatRule} onChange={(e) => updateForm("repeatRule", e.target.value as RepeatRule)}>
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Priority</FieldLabel>
                  <Select value={form.priority} onChange={(e) => updateForm("priority", e.target.value as Priority)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Job status</FieldLabel>
                  <Select value={form.jobStatus} onChange={(e) => updateForm("jobStatus", e.target.value)}>
                    <option value="new">New</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_on_tenant">Waiting on Tenant</option>
                    <option value="waiting_on_vendor">Waiting on Vendor</option>
                    <option value="waiting_on_owner">Waiting on Owner</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.requiresFollowUp}
                      onChange={(e) => updateForm("requiresFollowUp", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Requires follow up
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <Select value={form.status} onChange={(e) => updateForm("status", e.target.value as Status)}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting">Waiting</option>
                    <option value="completed">Completed</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Linked source module</FieldLabel>
                  <TextInput
                    value={form.sourceModule}
                    onChange={(e) => updateForm("sourceModule", e.target.value)}
                    placeholder="manual, move-out, inspection, work-order"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <TextArea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  placeholder="Anything important about access, follow-up, deadline, or special handling"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {editingId ? "Update Item" : "Add Item"}
                </button>
                <button
                  type="button"
                  onClick={clearAllData}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Clear All Local Data
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <TabButton label="Today" value="today" activeTab={activeTab} onClick={setActiveTab} />
                  <TabButton label="Calendar" value="calendar" activeTab={activeTab} onClick={setActiveTab} />
                  <TabButton label="Reminders" value="reminders" activeTab={activeTab} onClick={setActiveTab} />
                  <TabButton label="Work Schedule" value="schedule" activeTab={activeTab} onClick={setActiveTab} />
                  <TabButton label="All Items" value="all" activeTab={activeTab} onClick={setActiveTab} />
                </div>

                <div className="text-sm text-slate-500">
                  Today is <span className="font-semibold text-slate-700">{formatDateLabel(new Date().toISOString().slice(0, 10))}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
                <TextInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search title, property, person, notes..."
                />
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting">Waiting</option>
                  <option value="completed">Completed</option>
                </Select>
                <Select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}>
                  <option value="all">All Assigned</option>
                  {assignedPeople.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
                <Select value={followUpFilter} onChange={(e) => setFollowUpFilter(e.target.value)}>
                  <option value="all">All Follow Up</option>
                  <option value="yes">Needs Follow Up</option>
                  <option value="no">No Follow Up</option>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
                {displayedItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                    <div className="text-lg font-semibold text-slate-900">No items in this view</div>
                    <p className="mt-2 text-sm text-slate-500">
                      Add your first task, appointment, or reminder on the left.
                    </p>
                  </div>
                ) : (
                  displayedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleComplete={handleToggleComplete}
                    />
                  ))
                )}

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">This week</h3>
                  <p className="mt-1 text-sm text-slate-500">Upcoming items in the next 7 days.</p>
                  <div className="mt-4 space-y-3">
                    {upcomingWeekItems.length === 0 ? (
                      <div className="text-sm text-slate-500">No upcoming items this week.</div>
                    ) : (
                      upcomingWeekItems.slice(0, 8).map((item) => (
                        <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            {formatDateTimeLabel(item.dueDate || item.startDate, item.dueTime)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.propertyName || "No property"}
                            {item.unit ? ` / ${item.unit}` : ""}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Today summary</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Due today</div>
                      <div className="mt-1">{todayItems.length} items</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Overdue</div>
                      <div className="mt-1">{overdueItems.length} open items</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Planned next phase</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>• Supabase cloud save / load</li>
                    <li>• True calendar month view</li>
                    <li>• Auto reminders and recurring generation</li>
                    <li>• Property-linked workflow templates</li>
                    <li>• Import from move-out / inspection / work order tools</li>
                  </ul>
                </div>
              </div>
           
  );
}
