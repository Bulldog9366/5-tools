"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase";

type TabKey = "due_today" | "overdue" | "upcoming" | "waiting_vendor" | "waiting_tenant" | "all";
type ItemType = "task" | "appointment" | "reminder" | "work_order" | "vendor_follow_up";
type Status = "pending" | "in_progress" | "waiting" | "completed";
type Priority = "low" | "normal" | "high" | "urgent";
type RepeatRule = "none" | "daily" | "weekly" | "monthly";

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

type CommandSchedulerItem = {
  id?: string;
  propertyAddress?: string;
  trade?: string;
  vendor?: string;
  assignedTo?: string;
  dateScheduled?: string;
  status?: string;
  priority?: string;
  description?: string;
};

type CommandTimeEntry = {
  id: string;
  employee_name?: string | null;
  property_name?: string | null;
  property_address?: string | null;
  work_description?: string | null;
  clock_in?: string | null;
  clock_out?: string | null;
  break_minutes?: number | null;
  total_hours?: number | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type InspectionScheduleItem = {
  id?: string | null;
  task_id: string;
  property_id?: string | null;
  status?: string | null;
  report_type?: string | null;
  scheduled_date?: string | null;
  route_day?: string | null;
  route_group?: string | null;
  property_name?: string | null;
  unit?: string | null;
  report_address?: string | null;
  assigned_to?: string | null;
  priority?: string | null;
  field_scope?: string | null;
  repair_follow_up_needed?: string | null;
  repair_ticket_created?: string | null;
  completion_notes?: string | null;
  created_at?: string | null;
};

type ImportSourceKey = "move_out" | "inspection" | "work_order";

type ImportPreviewItem = {
  id: string;
  source: ImportSourceKey;
  tableName: string;
  title: string;
  propertyName: string;
  propertyAddress: string;
  unit: string;
  dueDate: string;
  assignedTo: string;
  priority: Priority;
  category: string;
  status: string;
  notes: string;
  raw: Record<string, any>;
};

const STORAGE_KEY = "operations-assistant-items-v1";
const SCHEDULER_TABLE = "project_scheduler";
const TIME_TABLE = "operations_time_entries";
const INSPECTION_TABLE = "inspection_schedule_v2";
const PHOTO_REVIEW_TABLE = "photo_review_tasks";

const IMPORT_SOURCE_TABLES: Record<ImportSourceKey, string[]> = {
  move_out: ["move_outs", "move_out_board", "move_out_projects", "move_out_tasks"],
  inspection: ["photo_review_tasks", "inspection_reports", "inspections", "inspection_schedule_v2"],
  work_order: ["service_tickets", "work_orders", "work_order_pricing_records", "project_tracker"],
};

const supabase = createClient();

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
    month: "short",
    day: "numeric",
    hour: time ? "numeric" : undefined,
    minute: time ? "2-digit" : undefined,
  });
}

function formatCommandDateTime(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCommandHours(value?: number | null) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function normalizeScheduleStatus(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isActiveInspection(item: InspectionScheduleItem) {
  const status = normalizeScheduleStatus(item.status);
  return status !== "inactive" && status !== "archived" && status !== "completed" && status !== "cancelled";
}

function isCompletedInspection(item: InspectionScheduleItem) {
  return normalizeScheduleStatus(item.status) === "completed";
}

function getInspectionDate(item: InspectionScheduleItem) {
  const raw = item.scheduled_date;
  if (!raw) return null;
  const dt = new Date(`${raw}T12:00:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getInspectionNoticeDays(item: InspectionScheduleItem) {
  const due = getInspectionDate(item);
  if (!due) return null;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  return Math.ceil((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

function isInHomeInspection(item: InspectionScheduleItem) {
  return String(item.report_type || "").toLowerCase().includes("in-home");
}

function needsTenantEntryNotice(item: InspectionScheduleItem) {
  const noticeDays = getInspectionNoticeDays(item);
  return isInHomeInspection(item) && noticeDays !== null && noticeDays < 10;
}

function safeText(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function safeDate(value: any) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  const dt = new Date(`${text}T12:00:00`);
  return Number.isNaN(dt.getTime()) ? new Date().toISOString().slice(0, 10) : text;
}

function normalizeImportPriority(value: any): Priority {
  const text = String(value || "").toLowerCase();
  if (text.includes("urgent") || text.includes("emergency")) return "urgent";
  if (text.includes("high")) return "high";
  if (text.includes("low")) return "low";
  return "normal";
}

function buildImportPreviewItem(source: ImportSourceKey, tableName: string, row: Record<string, any>, index: number): ImportPreviewItem {
  const rowId = safeText(row.id, row.task_id, row.report_id, row.ticket_id, row.project_id, index);
  const propertyName = safeText(row.property_name, row.propertyName, row.property, row.project_title, row.title);
  const propertyAddress = safeText(row.property_address, row.propertyAddress, row.address, row.report_address, row.service_address);
  const unit = safeText(row.unit, row.Unit, row.unit_number, row.unitName);
  const dueDate = safeDate(row.due_date || row.dueDate || row.scheduled_date || row.report_date || row.date_scheduled || row.dateScheduled || row.created_at);
  const category = source === "move_out" ? "move-out import" : source === "inspection" ? "inspection import" : "work order import";
  const title = safeText(
    row.title,
    row.subject,
    row.report_type,
    row.trade,
    row.service_type,
    source === "move_out" ? `Move-out follow-up - ${propertyName || propertyAddress || "Imported item"}` : "",
    source === "inspection" ? `Inspection follow-up - ${propertyName || propertyAddress || "Imported item"}` : "",
    source === "work_order" ? `Work order follow-up - ${propertyName || propertyAddress || "Imported item"}` : "",
  );

  return {
    id: `${tableName}-${rowId}`,
    source,
    tableName,
    title,
    propertyName,
    propertyAddress,
    unit,
    dueDate,
    assignedTo: safeText(row.assigned_to, row.assignedTo, row.assigned, row.employee_name),
    priority: normalizeImportPriority(row.priority || row.Priority),
    category,
    status: safeText(row.status, row.Status, row.task_status, row.job_status, "pending"),
    notes: safeText(row.notes, row.description, row.scope, row.field_scope, row.completion_notes),
    raw: row,
  };
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

function priorityClass(priority: Priority) {
  switch (priority) {
    case "urgent":
      return "border-red-200 bg-red-50 text-red-700";
    case "high":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "low":
      return "border-[#e5d8c8] bg-[#fbf6ef] text-[#6b4b2d]";
    default:
      return "border-[#e5d8c8] bg-[#fbf6ef] text-[#7a4d20]";
  }
}

function statusClass(status: Status) {
  switch (status) {
    case "completed":
      return "border-green-200 bg-green-50 text-green-700";
    case "in_progress":
      return "border-[#c9914b] bg-[#fff6e9] text-[#8a541c]";
    case "waiting":
      return "border-[#d8c4aa] bg-[#f7efe5] text-[#6b4b2d]";
    default:
      return "border-[#e5d8c8] bg-white text-[#4a2f1d]";
  }
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[15px] leading-none">
      {children}
    </span>
  );
}

function SidebarLink({ icon, label, href, active = false }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-[#a56a2a] text-white shadow-sm"
          : "text-[#3c2719] hover:bg-[#f4e6d5]"
      }`}
    >
      <Icon>{icon}</Icon>
      {label}
    </Link>
  );
}

function QuickCreateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef]"
    >
      <span className="text-lg leading-none">＋</span>
      {label}
    </button>
  );
}

function TopNavLink({ href, children, active = false }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526] ${
        active ? "bg-[#6f4526] border-b-4 border-[#c9914b]" : ""
      }`}
    >
      {children}
    </Link>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "brown",
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "brown" | "red" | "green" | "orange";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "green"
      ? "text-green-700"
      : tone === "orange"
      ? "text-orange-600"
      : "text-[#9a5a16]";

  return (
    <div className="rounded-xl border border-[#e2cdb4] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-xs font-bold ${toneClass}`}>{label}</div>
          <div className="mt-3 text-3xl font-black text-[#111111]">{value}</div>
        </div>
        <div className={`text-3xl ${toneClass}`}>{icon}</div>
      </div>
    </div>
  );
}

function ActionTile({ icon, title, description, href }: { icon: React.ReactNode; title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex min-h-[96px] items-center gap-4 border-r border-[#e5d8c8] bg-white p-5 last:border-r-0 transition hover:bg-[#fbf6ef]"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#f4e6d5] text-3xl text-[#9a5a16]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-black text-[#111111]">{title}</div>
        <div className="mt-1 text-xs leading-5 text-[#3f3328]">{description}</div>
      </div>
      <div className="text-2xl text-[#4a2f1d] group-hover:translate-x-1 transition">›</div>
    </Link>
  );
}

function Panel({ title, badge, children, tone = "default" }: { title: string; badge?: React.ReactNode; children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <section className={`rounded-xl border bg-white p-4 shadow-sm ${tone === "danger" ? "border-red-200" : "border-[#e2cdb4]"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className={`text-base font-black ${tone === "danger" ? "text-red-700" : "text-[#111111]"}`}>{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

function MiniBadge({ children, tone = "brown" }: { children: React.ReactNode; tone?: "brown" | "red" | "orange" | "green" }) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "orange"
      ? "bg-[#fff1d7] text-[#8a541c]"
      : tone === "green"
      ? "bg-green-50 text-green-700"
      : "bg-[#fbf6ef] text-[#6b4b2d]";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{children}</span>;
}

function TimeMetric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e2cdb4] bg-[#fffaf4] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4d20]">{label}</div>
          <div className="mt-2 text-3xl font-black text-[#111111]">
            {value}
            {label === "Today Labor" ? <span className="ml-2 text-sm font-bold">hrs</span> : null}
          </div>
        </div>
        <div className="text-3xl text-[#9a5a16]">{icon}</div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-bold text-[#3c2719]">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none transition placeholder:text-[#9c8d7d] focus:border-[#a56a2a] focus:ring-2 focus:ring-[#f4e6d5] ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none transition placeholder:text-[#9c8d7d] focus:border-[#a56a2a] focus:ring-2 focus:ring-[#f4e6d5] ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none transition focus:border-[#a56a2a] focus:ring-2 focus:ring-[#f4e6d5] ${props.className || ""}`}
    />
  );
}

function ToolbarButton({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-2.5 text-sm font-bold transition ${
        primary
          ? "border-[#a56a2a] bg-[#8a541c] text-white hover:bg-[#6f4526]"
          : "border-[#d8c4aa] bg-white text-[#3c2719] hover:bg-[#fbf6ef]"
      }`}
    >
      {children}
    </button>
  );
}

function QueueTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-4 py-2 text-xs font-black transition ${
        active
          ? "border-[#a56a2a] bg-[#a56a2a] text-white"
          : "border-[#d8c4aa] bg-white text-[#3c2719] hover:bg-[#fbf6ef]"
      }`}
    >
      {label} <span className={`ml-2 rounded-full px-2 py-0.5 ${active ? "bg-white/25" : "bg-[#fbf6ef]"}`}>{count}</span>
    </button>
  );
}

function QueueRow({
  item,
  isExpanded,
  onToggleExpanded,
  onEdit,
  onDelete,
  onDeleteFromCloud,
  onToggleComplete,
}: {
  item: AssistantItem;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  onEdit: (item: AssistantItem) => void;
  onDelete: (id: string) => void;
  onDeleteFromCloud: (item: AssistantItem) => void;
  onToggleComplete: (item: AssistantItem) => void;
}) {
  const propertyLabel = `${item.propertyName || "No property"}${item.unit ? ` / ${item.unit}` : ""}`;

  return (
    <div className={`border-t border-[#eadbc8] ${isExpanded ? "bg-[#fffaf4]" : "bg-white"}`}>
      <button
        type="button"
        onClick={() => onToggleExpanded(item.id)}
        className="grid w-full gap-3 px-4 py-3 text-left text-sm transition hover:bg-[#fbf6ef] lg:grid-cols-[95px_115px_minmax(180px,1.2fr)_minmax(180px,1.2fr)_140px_130px_110px_90px] lg:items-center"
      >
        <div>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${priorityClass(item.priority)}`}>
            {item.priority}
          </span>
        </div>
        <div className="font-bold capitalize text-[#3c2719]">{item.type.replace("_", " ")}</div>
        <div className="min-w-0">
          <div className="truncate font-black text-[#111111]">{item.title || "Untitled item"}</div>
          <div className="truncate text-xs text-[#6b4b2d]">{item.category || "No category"}</div>
        </div>
        <div className="min-w-0 truncate font-semibold text-[#3c2719]">{propertyLabel}</div>
        <div className="truncate text-[#3c2719]">{item.assignedTo || "Unassigned"}</div>
        <div className="font-semibold text-[#3c2719]">{formatDateTimeLabel(item.dueDate || item.startDate, item.dueTime)}</div>
        <div>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusClass(item.status)}`}>
            {item.status.replace("_", " ")}
          </span>
        </div>
        <div className="text-right font-black text-[#9a5a16]">{isExpanded ? "▲" : "▼"}</div>
      </button>

      {isExpanded ? (
        <div className="border-t border-[#eadbc8] bg-[#fffaf4] px-4 py-4">
          <div className="grid gap-3 text-sm text-[#3f3328] md:grid-cols-2 xl:grid-cols-4">
            <div><span className="font-black text-[#111111]">Tenant:</span> {item.tenantName || "—"}</div>
            <div><span className="font-black text-[#111111]">Vendor:</span> {item.vendorName || "—"}</div>
            <div><span className="font-black text-[#111111]">Contact:</span> {item.contactName || "—"}</div>
            <div><span className="font-black text-[#111111]">Job:</span> {item.jobStatus || "—"}</div>
            <div><span className="font-black text-[#111111]">Property ID:</span> {item.propertyId || "—"}</div>
            <div><span className="font-black text-[#111111]">Source:</span> {item.sourceModule || "manual"}</div>
            <div><span className="font-black text-[#111111]">Repeat:</span> {item.repeatRule}</div>
            <div><span className="font-black text-[#111111]">Reminder:</span> {item.reminderMinutes ? `${item.reminderMinutes} min` : "—"}</div>
          </div>

          {item.notes ? (
            <div className="mt-3 whitespace-pre-line rounded-lg border border-[#e2cdb4] bg-white px-3 py-2 text-sm text-[#3f3328]">
              {item.notes}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <ToolbarButton primary onClick={() => onToggleComplete(item)}>
              {item.status === "completed" ? "Reopen" : "Complete"}
            </ToolbarButton>
            <ToolbarButton onClick={() => onEdit(item)}>Edit</ToolbarButton>
            <ToolbarButton>Send to Scheduler</ToolbarButton>
            <ToolbarButton>Create Work Order</ToolbarButton>
            <ToolbarButton>Email Owner</ToolbarButton>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
            >
              Delete Local
            </button>
            <button
              type="button"
              onClick={() => onDeleteFromCloud(item)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
            >
              Delete Cloud
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OperationsAssistantPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("due_today");
  const [items, setItems] = useState<AssistantItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [showFormPanel, setShowFormPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("Local save ready.");

  const [commandTodayJobs, setCommandTodayJobs] = useState<CommandSchedulerItem[]>([]);
  const [commandActiveEntries, setCommandActiveEntries] = useState<CommandTimeEntry[]>([]);
  const [commandTodayTimeEntries, setCommandTodayTimeEntries] = useState<CommandTimeEntry[]>([]);
  const [commandMessage, setCommandMessage] = useState("Command center ready.");
  const [isLoadingCommandCenter, setIsLoadingCommandCenter] = useState(false);

  const [inspectionItems, setInspectionItems] = useState<InspectionScheduleItem[]>([]);
  const [inspectionMessage, setInspectionMessage] = useState("Inspection schedule ready.");
  const [isLoadingInspections, setIsLoadingInspections] = useState(false);
  const [sendingInspectionId, setSendingInspectionId] = useState<string | null>(null);
  const [showInspectionControl, setShowInspectionControl] = useState(false);

  const [importSource] = useState<ImportSourceKey>("move_out");
  const [importPreviewItems, setImportPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [isLoadingImports, setIsLoadingImports] = useState(false);

  const todayLaborHours = useMemo(
    () => commandTodayTimeEntries.reduce((total, entry) => total + Number(entry.total_hours || 0), 0),
    [commandTodayTimeEntries],
  );
  const activeLaborCount = commandActiveEntries.length;
  const completedTodayCount = commandTodayTimeEntries.filter((entry) => normalizeScheduleStatus(entry.status) === "completed").length;

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
      // localStorage may be unavailable in private browsing.
    }
  }, [items]);

  useEffect(() => {
    loadCommandCenter();
    loadInspectionSchedule();
  }, []);

  function toggleExpanded(id: string) {
    setExpandedRows((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  }

  async function loadCommandCenter() {
    setIsLoadingCommandCenter(true);
    setCommandMessage("");

    try {
      const todayISO = new Date().toISOString().slice(0, 10);

      const { data: schedulerRows, error: schedulerError } = await supabase
        .from(SCHEDULER_TABLE)
        .select("items_json")
        .order("updated_at", { ascending: false });

      if (schedulerError) throw schedulerError;

      const allSchedulerItems: CommandSchedulerItem[] = (schedulerRows || []).flatMap((row: any) =>
        Array.isArray(row.items_json) ? row.items_json : [],
      );

      setCommandTodayJobs(allSchedulerItems.filter((job) => job.dateScheduled === todayISO));

      const tomorrow = new Date(`${todayISO}T12:00:00`);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().slice(0, 10);

      const { data: activeEntries, error: activeError } = await supabase
        .from(TIME_TABLE)
        .select("*")
        .eq("status", "Active")
        .order("clock_in", { ascending: false });

      if (activeError) throw activeError;
      setCommandActiveEntries((activeEntries || []) as CommandTimeEntry[]);

      const { data: todayTimeEntries, error: todayTimeError } = await supabase
        .from(TIME_TABLE)
        .select("*")
        .gte("clock_in", `${todayISO}T00:00:00`)
        .lt("clock_in", `${tomorrowISO}T00:00:00`)
        .order("clock_in", { ascending: false });

      if (todayTimeError) throw todayTimeError;
      setCommandTodayTimeEntries((todayTimeEntries || []) as CommandTimeEntry[]);

      setCommandMessage("Command center updated.");
    } catch (error: any) {
      setCommandMessage(`Command center load failed: ${error.message || error}`);
    } finally {
      setIsLoadingCommandCenter(false);
    }
  }

  async function loadInspectionSchedule() {
    setIsLoadingInspections(true);
    setInspectionMessage("");

    try {
      const { data, error } = await supabase
        .from(INSPECTION_TABLE)
        .select("*")
        .order("scheduled_date", { ascending: true });

      if (error) throw error;

      setInspectionItems((data || []) as InspectionScheduleItem[]);
      setInspectionMessage("Inspection schedule loaded.");
    } catch (error: any) {
      setInspectionMessage(`Inspection schedule load failed: ${error.message || error}`);
    } finally {
      setIsLoadingInspections(false);
    }
  }

  async function sendInspectionToPhotoReview(item: InspectionScheduleItem, overrideTenantNotice = false) {
    const scheduleId = item.id;
    const taskId = item.task_id;

    if (!scheduleId) {
      setInspectionMessage("Send to Inspections failed: missing inspection schedule UUID.");
      return;
    }

    if (needsTenantEntryNotice(item) && !overrideTenantNotice) {
      const noticeDays = getInspectionNoticeDays(item);
      setInspectionMessage(
        `In-home reports normally require at least 10 days tenant notice before sending to Inspections. This report is ${noticeDays ?? 0} day${noticeDays === 1 ? "" : "s"} out. Use Override / Field Visit when you are already onsite for maintenance or otherwise have approved access.`,
      );
      return;
    }

    setSendingInspectionId(scheduleId);
    setInspectionMessage("Sending report to Inspections...");

    try {
      const { data: existingTasks, error: checkError } = await supabase
        .from(PHOTO_REVIEW_TABLE)
        .select("id, task_status")
        .eq("inspection_schedule_id", scheduleId);

      if (checkError) throw checkError;

      const activeDuplicate = (existingTasks || []).find((task: any) => {
        const status = String(task.task_status || "Open").toLowerCase();
        return status !== "completed" && status !== "cancelled" && status !== "closed";
      });

      if (activeDuplicate) {
        setInspectionMessage("This report is already in Inspections. Duplicate was not created.");
        await loadInspectionSchedule();
        return;
      }

      const { error: insertError } = await supabase.from(PHOTO_REVIEW_TABLE).insert({
        inspection_schedule_id: scheduleId,
        property_name: item.property_name || "",
        unit: item.unit || "",
        address: item.report_address || "",
        report_type: item.report_type || "",
        due_date: item.scheduled_date || null,
        task_status: "Open",
        notes: `Source inspection task: ${taskId || scheduleId}. ${item.field_scope || ""}`.trim(),
      });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from(INSPECTION_TABLE)
        .update({ status: "Sent to Inspections" })
        .eq("id", scheduleId);

      if (updateError) throw updateError;

      setInspectionMessage("Sent to Inspections. Open the Inspections page and click Refresh Scheduled Tasks.");
      await loadInspectionSchedule();
    } catch (error: any) {
      setInspectionMessage(`Send to Inspections failed: ${error.message || error}`);
    } finally {
      setSendingInspectionId(null);
    }
  }

  async function deactivateInspectionProperty(item: InspectionScheduleItem) {
    const scheduleId = item.id;
    const propertyName = item.property_name || "this property";
    const confirmed = window.confirm(`Deactivate ${propertyName}? This removes it from future report scheduling but keeps history.`);

    if (!confirmed || !scheduleId) return;

    try {
      const { error } = await supabase
        .from(INSPECTION_TABLE)
        .update({ status: "Inactive" })
        .eq("id", scheduleId);

      if (error) throw error;

      setInspectionMessage("Property/report task deactivated.");
      await loadInspectionSchedule();
    } catch (error: any) {
      setInspectionMessage(`Deactivate failed: ${error.message || error}`);
    }
  }

  async function loadImportPreview(source: ImportSourceKey = importSource) {
    setIsLoadingImports(true);

    const tables = IMPORT_SOURCE_TABLES[source];
    const results: ImportPreviewItem[] = [];

    for (const tableName of tables) {
      try {
        const response = await supabase.from(tableName).select("*").limit(12);
        if (response.error) continue;
        const rows = Array.isArray(response.data) ? response.data : [];
        rows.forEach((row: any, index: number) => {
          results.push(buildImportPreviewItem(source, tableName, row, index));
        });
      } catch {
        // Skip unavailable optional tables.
      }
    }

    setImportPreviewItems(results.slice(0, 24));
    setIsLoadingImports(false);
  }

  function importPreviewItemToOperations(item: ImportPreviewItem) {
    const imported: AssistantItem = {
      id: uid(),
      title: item.title || "Imported operations item",
      type: "task",
      category: item.category,
      propertyId: safeText(item.raw.property_id, item.raw.propertyId, item.raw["Property ID"]),
      propertyName: item.propertyName || item.propertyAddress,
      unit: item.unit,
      tenantName: safeText(item.raw.tenant_name, item.raw.tenantName, item.raw.tenant),
      vendorName: safeText(item.raw.vendor_name, item.raw.vendorName, item.raw.vendor),
      contactName: safeText(item.raw.contact_name, item.raw.contactName, item.raw.contact),
      assignedTo: item.assignedTo,
      jobStatus: item.status || "imported",
      requiresFollowUp: true,
      startDate: item.dueDate,
      dueDate: item.dueDate,
      dueTime: "",
      reminderMinutes: "30",
      repeatRule: "none",
      priority: item.priority,
      status: "pending",
      notes: [item.notes, item.propertyAddress ? `Address: ${item.propertyAddress}` : "", `Imported from ${item.tableName}.`]
        .filter(Boolean)
        .join("\n"),
      sourceModule: item.source,
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => sortItems([...prev, imported]));
    setMessage(`Imported: ${imported.title}`);
    setActiveTab("all");
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const tenantNoticeEnd = new Date(todayStart);
  tenantNoticeEnd.setDate(tenantNoticeEnd.getDate() + 10);

  const inspectionTenantNoticeNeeded = useMemo(() => {
    return inspectionItems
      .filter(isActiveInspection)
      .filter((item) => {
        const due = getInspectionDate(item);
        return due ? isInHomeInspection(item) && due >= todayStart && due < tenantNoticeEnd : false;
      })
      .sort((a, b) => (getInspectionDate(a)?.getTime() || 0) - (getInspectionDate(b)?.getTime() || 0));
  }, [inspectionItems, todayStart, tenantNoticeEnd]);

  const inspectionUpcoming = useMemo(() => {
    return inspectionItems
      .filter(isActiveInspection)
      .filter((item) => {
        const due = getInspectionDate(item);
        return due ? due >= todayStart && due < weekEnd : false;
      })
      .sort((a, b) => (getInspectionDate(a)?.getTime() || 0) - (getInspectionDate(b)?.getTime() || 0));
  }, [inspectionItems, todayStart, weekEnd]);

  const inspectionOverdue = useMemo(() => {
    return inspectionItems
      .filter((item) => !isCompletedInspection(item))
      .filter((item) => {
        const status = normalizeScheduleStatus(item.status);
        if (status === "inactive" || status === "archived" || status === "cancelled") return false;
        const due = getInspectionDate(item);
        return due ? due < todayStart : false;
      })
      .sort((a, b) => (getInspectionDate(a)?.getTime() || 0) - (getInspectionDate(b)?.getTime() || 0));
  }, [inspectionItems, todayStart]);

  const inspectionActiveCount = useMemo(() => inspectionItems.filter(isActiveInspection).length, [inspectionItems]);

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

      return haystack.includes(searchTerm.toLowerCase());
    });
  }, [items, searchTerm]);

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

  const waitingVendorItems = useMemo(() => {
    return filteredItems.filter((item) => item.jobStatus === "waiting_on_vendor" || item.vendorName);
  }, [filteredItems]);

  const waitingTenantItems = useMemo(() => {
    return filteredItems.filter((item) => item.jobStatus === "waiting_on_tenant" || item.tenantName);
  }, [filteredItems]);

  const activeQueueItems = useMemo(() => {
    switch (activeTab) {
      case "due_today":
        return todayItems;
      case "overdue":
        return overdueItems;
      case "upcoming":
        return upcomingWeekItems;
      case "waiting_vendor":
        return waitingVendorItems;
      case "waiting_tenant":
        return waitingTenantItems;
      default:
        return filteredItems;
    }
  }, [activeTab, filteredItems, overdueItems, todayItems, upcomingWeekItems, waitingTenantItems, waitingVendorItems]);

  const openCount = items.filter((item) => item.status !== "completed").length;
  const completedCount = items.filter((item) => item.status === "completed").length;

  const openWorkOrderCount = items.filter((item) => item.type === "work_order" && item.status !== "completed").length;
  const scheduledVisitCount = items.filter((item) => item.type === "appointment" && item.status !== "completed").length + commandTodayJobs.length;
  const ownerFollowUpCount = items.filter((item) => {
    const haystack = `${item.title} ${item.category} ${item.contactName} ${item.notes} ${item.sourceModule}`.toLowerCase();
    return item.status !== "completed" && (haystack.includes("owner") || item.jobStatus === "waiting_on_owner");
  }).length;
  const vendorCallbackCount = items.filter((item) => item.type === "vendor_follow_up" && item.status !== "completed").length + waitingVendorItems.length;
  const secretaryFeedItems = items
    .filter((item) => String(item.sourceModule || "").toLowerCase().includes("secretary"))
    .slice(0, 5);
  const todayActionItems = sortItems([...todayItems, ...overdueItems]).slice(0, 8);
  const workOrderStatusRows = [
    { label: "Waiting Approval", count: items.filter((item) => item.type === "work_order" && item.jobStatus === "waiting_on_owner").length },
    { label: "Waiting Vendor", count: items.filter((item) => item.type === "work_order" && item.jobStatus === "waiting_on_vendor").length },
    { label: "Scheduled", count: items.filter((item) => item.type === "work_order" && item.jobStatus === "scheduled").length },
    { label: "In Progress", count: items.filter((item) => item.type === "work_order" && (item.jobStatus === "in_progress" || item.status === "in_progress")).length },
    { label: "Completed", count: items.filter((item) => item.type === "work_order" && item.status === "completed").length },
  ];

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function openQuickCreate(type: ItemType) {
    clearForm();
    setForm((prev) => ({ ...prev, type, title: type === "vendor_follow_up" ? "Vendor Follow-Up" : "" }));
    setShowFormPanel(true);
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
    setActiveTab("due_today");
  }

  function generateMoveOutWorkflow() {
    const propertyName = form.propertyName.trim();

    if (!propertyName) {
      setMessage("Enter a property name before generating a move-out workflow.");
      return;
    }

    const anchorDate = form.dueDate || new Date().toISOString().slice(0, 10);
    const common = {
      propertyId: form.propertyId.trim(),
      propertyName,
      unit: form.unit.trim(),
      tenantName: form.tenantName.trim(),
      vendorName: "",
      contactName: form.tenantName.trim(),
      assignedTo: form.assignedTo.trim(),
      reminderMinutes: "30",
      repeatRule: "none" as RepeatRule,
      priority: "normal" as Priority,
      status: "pending" as Status,
      sourceModule: "workflow-generator",
      createdAt: new Date().toISOString(),
    };

    const generated: AssistantItem[] = [
      {
        id: uid(),
        title: "Send move-out checklist",
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
        title: "Final move-out report",
        type: "appointment",
        category: "move-out report",
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
        title: "Deposit disposition deadline reminder",
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

    setItems((prev) => sortItems([...prev, ...generated]));
    setMessage(`${generated.length} move-out workflow items generated.`);
    setShowFormPanel(false);
    clearForm();
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

    setItems((prev) => sortItems(editingId ? prev.map((item) => (item.id === editingId ? payload : item)) : [...prev, payload]));
    setMessage(editingId ? "Item updated." : "Item added.");
    setShowFormPanel(false);
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
    setShowFormPanel(true);
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setExpandedRows((prev) => prev.filter((itemId) => itemId !== id));
    if (editingId === id) clearForm();
    setMessage("Item deleted from this device.");
  }

  async function handleDeleteFromCloud(item: AssistantItem) {
    const confirmed = window.confirm(`Delete "${item.title || "this item"}" from cloud and this device? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("operations_assistant_items").delete().eq("id", item.id);

      if (error) {
        setMessage(`Cloud delete failed or table is not connected: ${error.message}`);
        return;
      }

      setItems((prev) => prev.filter((current) => current.id !== item.id));
      setExpandedRows((prev) => prev.filter((itemId) => itemId !== item.id));
      if (editingId === item.id) clearForm();
      setMessage("Item deleted from cloud and this device.");
    } catch {
      setMessage("Cloud delete failed. Check Supabase table and policies.");
    }
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

  function renderQueueRows(rowItems: AssistantItem[]) {
    if (rowItems.length === 0) {
      return (
        <div className="flex min-h-[210px] flex-col items-center justify-center gap-2 border-t border-[#eadbc8] bg-white px-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#e2cdb4] bg-[#fbf6ef] text-3xl text-[#9a5a16]">▣</div>
          <div className="text-xl font-black text-[#111111]">No items due today.</div>
          <div className="text-sm text-[#3f3328]">Great job staying on top of your work!</div>
        </div>
      );
    }

    return (
      <div>
        {sortItems(rowItems).map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            isExpanded={expandedRows.includes(item.id)}
            onToggleExpanded={toggleExpanded}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDeleteFromCloud={handleDeleteFromCloud}
            onToggleComplete={handleToggleComplete}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3eadf] text-[#111111]">
      <header className="border-b border-[#d8c4aa] bg-[#f7efe5]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-8 py-5">
          <div>
            <div className="text-4xl font-black tracking-tight text-[#2b190f]">5Tools</div>
            <div className="mt-1 text-[11px] font-black uppercase tracking-[0.42em] text-[#9a5a16]">
              Repair & Maintenance Workspace
            </div>
          </div>
          <div className="flex items-center gap-12 text-right text-sm font-black text-[#2b190f]">
            <div>
              <div>253.584.8200</div>
              <div className="text-xs font-bold uppercase text-[#7a4d20]">Call Us</div>
            </div>
            <div>
              <div>Tacoma, Washington</div>
              <div className="text-xs font-bold uppercase text-[#7a4d20]">Service Area</div>
            </div>
          </div>
        </div>
        <nav className="bg-[#4a2f1d]">
          <div className="mx-auto flex max-w-[1500px] items-center px-8">
            <TopNavLink href="/">Home</TopNavLink>
            <TopNavLink href="/work-order" active>Work Orders</TopNavLink>
            <TopNavLink href="/work-order-pricing">Pricing Notebook</TopNavLink>
            <TopNavLink href="/charges-estimator">Cost Estimator</TopNavLink>
            <TopNavLink href="/project-scheduler">Scheduler</TopNavLink>
            <TopNavLink href="/project-tracker">Projects</TopNavLink>
            <TopNavLink href="/truck-inventory">Truck Inventory</TopNavLink>
          </div>
        </nav>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex min-h-[calc(100vh-121px)] flex-col border-r border-[#d8c4aa] bg-[#fbf6ef]">
          <div className="space-y-1 p-3">
            <SidebarLink icon="☊" label="Operations Hub" href="/operation-assistant" active />
            <SidebarLink icon="⌂" label="Dashboard" href="/" />
            <SidebarLink icon="▣" label="Project Scheduler" href="/project-scheduler" />
            <SidebarLink icon="◷" label="Time Clock" href="/time-clock-employees" />
            <SidebarLink icon="◎" label="Trackers" href="/project-tracker" />
            <SidebarLink icon="▧" label="Work Orders" href="/work-order-engine" />
            <SidebarLink icon="☑" label="Inspections" href="/inspections" />
            <SidebarLink icon="✎" label="Punch List" href="/punch-list" />
            <SidebarLink icon="▧" label="Pricing" href="/work-order-pricing" />
            <SidebarLink icon="▥" label="Reports" href="/inspections" />
          </div>

          <div className="mt-2 border-t border-[#d8c4aa] p-4">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#9a5a16]">Quick Create</div>
            <div className="space-y-2">
              <QuickCreateButton label="Task" onClick={() => openQuickCreate("task")} />
              <QuickCreateButton label="Reminder" onClick={() => openQuickCreate("reminder")} />
              <QuickCreateButton label="Appointment" onClick={() => openQuickCreate("appointment")} />
              <QuickCreateButton label="Work Order" onClick={() => openQuickCreate("work_order")} />
              <QuickCreateButton label="Vendor Follow-Up" onClick={() => openQuickCreate("vendor_follow_up")} />
            </div>
          </div>

          <div className="mt-auto border-t border-[#d8c4aa] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a56a2a] text-lg font-black text-white">
                DA
              </div>
              <div>
                <div className="text-sm font-black text-[#111111]">Demo Admin</div>
                <div className="text-xs font-semibold text-[#3f3328]">Administrator</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="px-8 py-7">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide text-[#2b190f]">Operations Hub v2</h1>
              <p className="mt-2 text-lg font-semibold text-[#2b190f]">Daily command center for tasks, work orders, schedules, reports, and secretary intake.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-lg border border-[#d8c4aa] bg-white px-6 py-3 text-sm font-black text-[#3c2719] hover:bg-[#fbf6ef]"
              >
                ← Back to Dashboard
              </Link>
              <button
                type="button"
                onClick={() => {
                  clearForm();
                  setShowFormPanel(true);
                }}
                className="rounded-lg border border-[#a56a2a] bg-[#8a541c] px-6 py-3 text-sm font-black text-white hover:bg-[#6f4526]"
              >
                ＋ Add Item
              </button>
              <button
                type="button"
                onClick={() => loadImportPreview(importSource)}
                disabled={isLoadingImports}
                className="rounded-lg border border-[#d8c4aa] bg-white px-6 py-3 text-sm font-black text-[#3c2719] hover:bg-[#fbf6ef] disabled:opacity-60"
              >
                ⇧ Import Data
              </button>
              <button
                type="button"
                onClick={seedExamples}
                className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-sm font-black text-[#3c2719] hover:bg-[#fbf6ef]"
              >
                ⚙
              </button>
            </div>
          </div>

          <section className="mb-8 rounded-xl border border-[#e2cdb4] bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-black uppercase tracking-wide text-[#2b190f]">Today&apos;s Command View</h2>
                <p className="mt-2 text-sm leading-6 text-[#3f3328]">
                  One daily view for work orders, due items, vendor callbacks, owner follow-ups, reports, and scheduled field activity.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/work-order-engine" className="rounded-lg border border-[#a56a2a] bg-[#8a541c] px-4 py-2.5 text-sm font-black text-white hover:bg-[#6f4526]">
                  New Work Order
                </Link>
                <Link href="/service-ticket" className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-2.5 text-sm font-black text-[#3c2719] hover:bg-[#fbf6ef]">
                  New Service Ticket
                </Link>
                <Link href="/inspections" className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-2.5 text-sm font-black text-[#3c2719] hover:bg-[#fbf6ef]">
                  New Report
                </Link>
                <Link href="/5tools-secretary" className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-2.5 text-sm font-black text-[#3c2719] hover:bg-[#fbf6ef]">
                  Open Secretary
                </Link>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Open Work Orders" value={openWorkOrderCount} icon="▧" />
              <StatCard label="Due Today" value={todayItems.length} icon="▣" tone="orange" />
              <StatCard label="Overdue" value={overdueItems.length} icon="⚠" tone="red" />
              <StatCard label="Scheduled Visits" value={scheduledVisitCount} icon="◷" />
              <StatCard label="Owner Follow-Ups" value={ownerFollowUpCount} icon="◎" />
              <StatCard label="Vendor Callbacks" value={vendorCallbackCount} icon="☎" />
            </div>
          </section>

          <div className="mb-8 grid gap-5 xl:grid-cols-[1.1fr_1fr_1fr]">
            <Panel title="Today&apos;s Action Items" badge={<MiniBadge>{todayActionItems.length}</MiniBadge>}>
              {todayActionItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d8c4aa] bg-[#fffaf4] p-4 text-sm text-[#3f3328]">
                  No due or overdue action items found.
                </div>
              ) : (
                <div className="space-y-2">
                  {todayActionItems.map((item) => (
                    <div key={`action-${item.id}`} className="rounded-xl border border-[#e2cdb4] bg-[#fffaf4] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-[#111111]">{item.title || "Untitled item"}</div>
                          <div className="mt-1 text-xs text-[#3f3328]">
                            {item.propertyName || item.category || "Operations"} • {formatDateTimeLabel(item.dueDate || item.startDate, item.dueTime)}
                          </div>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${priorityClass(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Work Order Status" badge={<MiniBadge>{openWorkOrderCount} Open</MiniBadge>}>
              <div className="space-y-2">
                {workOrderStatusRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl border border-[#e2cdb4] bg-[#fffaf4] px-4 py-3">
                    <span className="text-sm font-black text-[#111111]">{row.label}</span>
                    <span className="rounded-full bg-[#fbf6ef] px-3 py-1 text-xs font-black text-[#6b4b2d]">{row.count}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Secretary Activity Feed" badge={<MiniBadge>{secretaryFeedItems.length}</MiniBadge>}>
              {secretaryFeedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d8c4aa] bg-[#fffaf4] p-4 text-sm text-[#3f3328]">
                  No secretary intake has been sent to the hub yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {secretaryFeedItems.map((item) => (
                    <div key={`secretary-${item.id}`} className="rounded-xl border border-[#e2cdb4] bg-[#fffaf4] p-3">
                      <div className="text-sm font-black text-[#111111]">{item.title}</div>
                      <div className="mt-1 text-xs text-[#3f3328]">{item.type.replace("_", " ")} • {formatDateLabel(item.createdAt.slice(0, 10))}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_220px]">
            <StatCard label="Due Today" value={todayItems.length} icon="▣" tone="orange" />
            <StatCard label="Overdue" value={overdueItems.length} icon="⚠" tone="red" />
            <StatCard label="Open" value={openCount} icon="▱" />
            <StatCard label="Completed" value={completedCount} icon="✓" tone="green" />
            <StatCard label="Inspections" value={inspectionActiveCount} icon="▤" />
            <div className="flex items-center">
              <button
                type="button"
                onClick={loadCommandCenter}
                disabled={isLoadingCommandCenter}
                className="h-[56px] w-full rounded-lg bg-[#8a541c] px-5 text-sm font-black text-white shadow-sm hover:bg-[#6f4526] disabled:opacity-60"
              >
                ⟳ {isLoadingCommandCenter ? "Refreshing..." : "Refresh Command Center"}
              </button>
            </div>
          </div>

          <section className="mb-8 overflow-hidden rounded-xl border border-[#e2cdb4] bg-white shadow-sm">
            <div className="grid xl:grid-cols-4">
              <ActionTile icon="▣" title="Project Scheduler" description="Create and manage scheduled project work." href="/project-scheduler" />
              <ActionTile icon="◷" title="Time Clock Employees" description="Clock employees in and out against scheduled projects." href="/time-clock-employees" />
              <ActionTile icon="▤" title="Punch List" description="Track remodel, turn, and repair completion items." href="/punch-list" />
              <ActionTile icon="$" title="Work Order Pricing" description="Reference internal repair and work order pricing." href="/work-order-pricing" />
            </div>
          </section>

          <div className="mb-8 grid gap-5 xl:grid-cols-[1fr_1fr_1.1fr]">
            <Panel title="Today's Jobs" badge={<MiniBadge>{commandTodayJobs.length}</MiniBadge>}>
              {commandTodayJobs.length === 0 ? (
                <div className="flex min-h-[84px] items-center gap-4 rounded-xl border border-dashed border-[#d8c4aa] bg-[#fffaf4] p-4 text-sm text-[#3f3328]">
                  <div className="text-2xl text-[#9a5a16]">▣</div>
                  <div>No scheduler jobs found for today.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {commandTodayJobs.slice(0, 5).map((job, index) => (
                    <div key={`${job.id || index}-${index}`} className="rounded-xl border border-[#e2cdb4] bg-[#fffaf4] p-3">
                      <div className="text-sm font-black text-[#111111]">{job.propertyAddress || "No address"}</div>
                      <div className="mt-1 text-xs text-[#3f3328]">{job.trade || "No trade"} • {job.status || "No status"}</div>
                      {job.assignedTo ? <div className="mt-1 text-xs text-[#6b4b2d]">Assigned: {job.assignedTo}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Active Clock-Ins" badge={<MiniBadge tone="orange">{commandActiveEntries.length}</MiniBadge>}>
              {commandActiveEntries.length === 0 ? (
                <div className="flex min-h-[84px] items-center gap-4 rounded-xl border border-dashed border-[#d8c4aa] bg-[#fffaf4] p-4 text-sm text-[#3f3328]">
                  <div className="text-2xl text-[#9a5a16]">♙</div>
                  <div>No employees currently clocked in.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {commandActiveEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-[#e2cdb4] bg-[#fffaf4] p-3">
                      <div className="text-sm font-black text-[#111111]">{entry.employee_name || "Employee"}</div>
                      <div className="mt-1 text-xs text-[#3f3328]">{entry.property_address || entry.property_name || "No property"}</div>
                      <div className="mt-1 text-xs font-bold text-[#7a4d20]">In: {formatCommandDateTime(entry.clock_in)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Time Tracking"
              badge={
                <Link
                  href="/time-clock-employees"
                  className="rounded-md border border-[#d8c4aa] bg-white px-4 py-2 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]"
                >
                  Open
                </Link>
              }
            >
              <div className="space-y-3">
                <TimeMetric label="Today Labor" value={formatCommandHours(todayLaborHours)} icon="◷" />
                <TimeMetric label="Active Clock-Ins" value={activeLaborCount} icon="♙" />
                <TimeMetric label="Completed Today" value={completedTodayCount} icon="✓" />
              </div>
            </Panel>
          </div>

          <div className="mb-8 grid gap-5 xl:grid-cols-[1.1fr_1fr]">
            <Panel
              title="Inspection Reports"
              badge={
                <div className="flex flex-wrap gap-2">
                  <MiniBadge>{inspectionActiveCount} Active</MiniBadge>
                  <MiniBadge tone="orange">{inspectionUpcoming.length} Due This Week</MiniBadge>
                  <MiniBadge tone="red">{inspectionTenantNoticeNeeded.length} Need 10-Day Notice</MiniBadge>
                </div>
              }
            >
              <p className="max-w-xl text-sm leading-6 text-[#3f3328]">
                Scheduled in-home visual reports and drive-by exterior reports from AppFolio import.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ToolbarButton onClick={loadInspectionSchedule}>{isLoadingInspections ? "Refreshing..." : "Refresh Reports"}</ToolbarButton>
                <Link
                  href="/inspections"
                  className="rounded-lg border border-[#a56a2a] bg-[#8a541c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#6f4526]"
                >
                  Open Inspections
                </Link>
                <ToolbarButton onClick={() => setShowInspectionControl((prev) => !prev)}>
                  {showInspectionControl ? "Hide Controls" : "View / Control Reports"}
                </ToolbarButton>
              </div>

              {inspectionMessage ? (
                <div className="mt-4 rounded-lg border border-[#d8c4aa] bg-[#fffaf4] px-4 py-3 text-sm font-bold text-[#4a2f1d]">
                  {inspectionMessage}
                </div>
              ) : null}

              {showInspectionControl ? (
                <div className="mt-5 rounded-xl border border-[#e2cdb4] bg-[#fffaf4] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-black text-[#111111]">Inspection Control</div>
                    <div className="text-xs font-bold text-[#6b4b2d]">
                      Showing upcoming and overdue report controls
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[...inspectionOverdue, ...inspectionUpcoming].slice(0, 10).map((item) => {
                      const noticeNeeded = needsTenantEntryNotice(item);
                      const noticeDays = getInspectionNoticeDays(item);
                      return (
                        <div key={`inspection-control-${item.task_id}`} className="rounded-lg border border-[#e2cdb4] bg-white p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="font-black text-[#111111]">
                                {item.property_name || "No property"}
                                {item.unit ? ` / ${item.unit}` : ""}
                              </div>
                              <div className="mt-1 text-xs font-bold text-[#6b4b2d]">
                                {item.report_type || "Report"} • Due {item.scheduled_date || "No date"}
                                {noticeNeeded ? ` • ${noticeDays ?? 0} day${noticeDays === 1 ? "" : "s"} out` : ""}
                              </div>
                              <div className="mt-1 text-xs text-[#3f3328]">{item.report_address || "No report address"}</div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Link
                                href="/inspections"
                                className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]"
                              >
                                Open
                              </Link>
                              <button
                                type="button"
                                onClick={() => sendInspectionToPhotoReview(item)}
                                disabled={sendingInspectionId === item.id}
                                className="rounded-lg bg-[#4a2f1d] px-3 py-2 text-xs font-black text-white hover:bg-[#6f4526] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {sendingInspectionId === item.id ? "Sending..." : "Send"}
                              </button>
                              {noticeNeeded ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ok = window.confirm("Override the 10-day notice control and send this report because you are already onsite for maintenance or have approved access?");
                                    if (ok) sendInspectionToPhotoReview(item, true);
                                  }}
                                  className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-black text-orange-800 hover:bg-orange-100"
                                >
                                  Override / Field Visit
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => deactivateInspectionProperty(item)}
                                className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50"
                              >
                                Deactivate
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {[...inspectionOverdue, ...inspectionUpcoming].length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#d8c4aa] bg-white p-4 text-sm text-[#6b4b2d]">
                        No upcoming or overdue inspection reports loaded.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 rounded-xl border border-orange-200 bg-[#fffaf4] p-4">
                <div className="flex items-start gap-4">
                  <div className="text-3xl text-orange-600">⚠</div>
                  <div>
                    <div className="font-black text-[#111111]">10-day tenant notice needed</div>
                    <div className="mt-2 text-sm leading-6 text-[#3f3328]">
                      In-home visual reports inside the next 10 days are listed here. These are blocked from Inspections until the 10-day notice period is satisfied.
                    </div>
                  </div>
                  <div className="ml-auto text-2xl text-[#9a5a16]">›</div>
                </div>
              </div>
            </Panel>

            <Panel title="Overdue Reports" tone="danger" badge={<MiniBadge tone="red">{inspectionOverdue.length}</MiniBadge>}>
              {inspectionOverdue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  No overdue inspection reports found.
                </div>
              ) : (
                <div className="space-y-3">
                  {inspectionOverdue.slice(0, 5).map((item) => (
                    <div key={item.task_id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="font-black text-[#111111]">{item.property_name || "No property"}</div>
                      <div className="mt-2 text-sm font-bold text-red-700">
                        {item.report_type || "Report"} • Due {item.scheduled_date || "No date"}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => sendInspectionToPhotoReview(item)}
                          disabled={sendingInspectionId === item.id}
                          className="rounded-lg bg-[#4a2f1d] px-4 py-2 text-xs font-black text-white hover:bg-[#6f4526] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingInspectionId === item.id ? "Sending..." : "Send to Inspections"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deactivateInspectionProperty(item)}
                          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                        >
                          Deactivate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <section className="overflow-hidden rounded-xl border border-[#e2cdb4] bg-white shadow-sm">
            <div className="border-b border-[#eadbc8] p-4">
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <h2 className="text-lg font-black uppercase tracking-wide text-[#2b190f]">Operations Queues</h2>
                <div className="flex flex-wrap gap-2">
                  <QueueTab label="Due Today" count={todayItems.length} active={activeTab === "due_today"} onClick={() => setActiveTab("due_today")} />
                  <QueueTab label="Overdue" count={overdueItems.length} active={activeTab === "overdue"} onClick={() => setActiveTab("overdue")} />
                  <QueueTab label="Upcoming" count={upcomingWeekItems.length} active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")} />
                  <QueueTab label="Waiting on Vendor" count={waitingVendorItems.length} active={activeTab === "waiting_vendor"} onClick={() => setActiveTab("waiting_vendor")} />
                  <QueueTab label="Waiting on Tenant" count={waitingTenantItems.length} active={activeTab === "waiting_tenant"} onClick={() => setActiveTab("waiting_tenant")} />
                  <QueueTab label="All Items" count={filteredItems.length} active={activeTab === "all"} onClick={() => setActiveTab("all")} />
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(280px,480px)_120px_120px]">
                <TextInput value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search items..." />
                <ToolbarButton>Filters</ToolbarButton>
                <ToolbarButton>⚙⌄</ToolbarButton>
              </div>
            </div>

            <div className="hidden grid-cols-[95px_115px_minmax(180px,1.2fr)_minmax(180px,1.2fr)_140px_130px_110px_90px] border-b border-[#eadbc8] bg-[#fffaf4] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#3f3328] lg:grid">
              <div>Priority</div>
              <div>Type</div>
              <div>Title</div>
              <div>Property / Unit</div>
              <div>Assigned To</div>
              <div>Due Date</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>

            {renderQueueRows(activeQueueItems)}

            <div className="flex items-center justify-between border-t border-[#eadbc8] bg-[#fffaf4] px-4 py-3 text-xs text-[#3f3328]">
              <div>Showing {activeQueueItems.length} of {filteredItems.length} items</div>
              <div className="flex items-center gap-4">
                <span>Rows per page:</span>
                <select className="rounded border border-[#d8c4aa] bg-white px-2 py-1">
                  <option>20</option>
                  <option>50</option>
                  <option>100</option>
                </select>
                <span className="text-lg">‹</span>
                <span className="text-lg">›</span>
              </div>
            </div>
          </section>

          {importPreviewItems.length > 0 ? (
            <section className="mt-8 rounded-xl border border-[#e2cdb4] bg-white p-4 shadow-sm">
              <h3 className="text-lg font-black uppercase tracking-wide text-[#2b190f]">Imported Items</h3>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {importPreviewItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#e2cdb4] bg-[#fffaf4] p-4">
                    <div className="font-black text-[#111111]">{item.title}</div>
                    <div className="mt-1 text-xs text-[#3f3328]">
                      {item.propertyName || item.propertyAddress || "No property listed"}
                      {item.unit ? ` / ${item.unit}` : ""}
                    </div>
                    <div className="mt-3">
                      <ToolbarButton onClick={() => importPreviewItemToOperations(item)}>Import Task</ToolbarButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="mt-12 flex items-center justify-between border-t border-[#d8c4aa] py-6 text-xs text-[#3f3328]">
            <div>© 2026 5Tools Operations. All rights reserved.</div>
            <div>
              Local Save: <span className="font-black text-green-700">Ready</span>
              <span className="mx-3">|</span>
              Cloud Save: <span className="font-black text-green-700">{commandMessage.includes("failed") || inspectionMessage.includes("failed") ? "Check Tables" : "Ready"}</span>
            </div>
          </footer>
        </main>
      </div>

      {showFormPanel ? (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-[#fbf6ef] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#d8c4aa] pb-4">
              <div>
                <h2 className="text-xl font-black text-[#111111]">{editingId ? "Edit Item" : "Add Item"}</h2>
                <p className="mt-1 text-sm text-[#3f3328]">Create tasks, reminders, appointments, or workflow items.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFormPanel(false);
                  clearForm();
                }}
                className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm font-black text-[#3c2719] hover:bg-[#fffaf4]"
              >
                Close
              </button>
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
                    <option value="work_order">Work Order</option>
                    <option value="vendor_follow_up">Vendor Follow-Up</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <TextInput
                    value={form.category}
                    onChange={(e) => updateForm("category", e.target.value)}
                    placeholder="maintenance, move-out, owner follow-up"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Property ID</FieldLabel>
                  <TextInput value={form.propertyId} onChange={(e) => updateForm("propertyId", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Property name</FieldLabel>
                  <TextInput value={form.propertyName} onChange={(e) => updateForm("propertyName", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Unit</FieldLabel>
                  <TextInput value={form.unit} onChange={(e) => updateForm("unit", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Assigned to</FieldLabel>
                  <TextInput value={form.assignedTo} onChange={(e) => updateForm("assignedTo", e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Tenant name</FieldLabel>
                  <TextInput value={form.tenantName} onChange={(e) => updateForm("tenantName", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Vendor name</FieldLabel>
                  <TextInput value={form.vendorName} onChange={(e) => updateForm("vendorName", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Contact / person</FieldLabel>
                  <TextInput value={form.contactName} onChange={(e) => updateForm("contactName", e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Source module</FieldLabel>
                  <TextInput value={form.sourceModule} onChange={(e) => updateForm("sourceModule", e.target.value)} />
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
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <Select value={form.status} onChange={(e) => updateForm("status", e.target.value as Status)}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting">Waiting</option>
                    <option value="completed">Completed</option>
                  </Select>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-[#d8c4aa] bg-white px-3 py-3 text-sm font-bold text-[#3c2719]">
                <input
                  type="checkbox"
                  checked={form.requiresFollowUp}
                  onChange={(e) => updateForm("requiresFollowUp", e.target.checked)}
                  className="h-4 w-4 rounded border-[#d8c4aa]"
                />
                Requires follow up
              </label>

              <div>
                <FieldLabel>Notes</FieldLabel>
                <TextArea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  placeholder="Access notes, vendor notes, deadlines, or owner/tenant follow-up."
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[#d8c4aa] pt-4">
                <button type="submit" className="rounded-lg bg-[#8a541c] px-5 py-3 text-sm font-black text-white hover:bg-[#6f4526]">
                  {editingId ? "Update Item" : "Add Item"}
                </button>
                <button
                  type="button"
                  onClick={generateMoveOutWorkflow}
                  className="rounded-lg border border-[#a56a2a] bg-white px-5 py-3 text-sm font-black text-[#3c2719] hover:bg-[#fffaf4]"
                >
                  Generate Move-Out Workflow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItems([]);
                    setExpandedRows([]);
                    clearForm();
                    window.localStorage.removeItem(STORAGE_KEY);
                    setMessage("All local schedule data cleared.");
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 hover:bg-red-100"
                >
                  Clear All Local Data
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
