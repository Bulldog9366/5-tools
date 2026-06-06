"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase";

const supabase = createClient();

const PROPERTY_TABLE = "inspection_properties";
const SCHEDULE_TABLE = "inspection_schedule_v2";

type PropertyRow = {
  id?: string;
  property_id: string;
  property_name: string | null;
  unit: string | null;
  report_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  route_group: string | null;
  assigned_to: string | null;
  status: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ScheduleRow = {
  id?: string;
  task_id: string;
  property_id: string | null;
  status: string | null;
  report_type: string | null;
  scheduled_date: string | null;
  route_day: string | null;
  route_group: string | null;
  property_name: string | null;
  unit: string | null;
  report_address: string | null;
  assigned_to: string | null;
  priority: string | null;
  field_scope: string | null;
  repair_follow_up_needed?: string | null;
  repair_ticket_created?: string | null;
  completion_notes?: string | null;
  created_at?: string | null;
};

type PropertyForm = {
  property_id: string;
  property_name: string;
  unit: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  route_group: string;
  assigned_to: string;
  status: string;
  notes: string;
};

type CompletionNotice = {
  propertyLabel: string;
  propertyId: string;
  completedDate: string;
  nextInHomeDue: string;
  action: "updated" | "created";
};

const DEFAULT_FORM: PropertyForm = {
  property_id: "P0001",
  property_name: "",
  unit: "",
  street_address: "",
  city: "",
  state: "WA",
  zip: "",
  route_group: "",
  assigned_to: "",
  status: "Active",
  notes: "",
};

const PROPERTY_OPERATIONAL_STATUSES = [
  "Active",
  "Vacant",
  "Renovation Hold",
  "Inactive",
  "Archived",
] as const;

const ACTIVE_STATUSES = new Set(["scheduled", "sent to inspections", "open", "in progress"]);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function makePropertyId(nextNumber: number) {
  return `P${String(nextNumber).padStart(4, "0")}`;
}

function asDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function nextBusinessDay(date: Date) {
  const next = new Date(date);
  while (isWeekend(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function addBusinessDays(base: Date, businessDays: number) {
  const result = nextBusinessDay(base);
  let added = 0;

  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) added += 1;
  }

  return result;
}

function addWeeks(base: Date, weeks: number) {
  const result = new Date(base);
  result.setDate(result.getDate() + weeks * 7);
  return nextBusinessDay(result);
}

function weekOfLabel(value: string) {
  return `Week of ${dateLabel(value)}`;
}

function addYearsISO(baseISO: string, years: number) {
  const base = asDate(baseISO);
  base.setFullYear(base.getFullYear() + years);
  return toISODate(nextBusinessDay(base));
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayName(value: string) {
  const date = asDate(value);
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isDateOnOrAfter(value: string | null | undefined, compareTo: string) {
  if (!value || !compareTo) return false;

  const dateValue = asDate(value).getTime();
  const compareValue = asDate(compareTo).getTime();

  if (Number.isNaN(dateValue) || Number.isNaN(compareValue)) return false;

  return dateValue >= compareValue;
}

function isActiveProperty(row: PropertyRow) {
  return normalizeStatus(row.status || "Active") === "active";
}

function isVacantProperty(row: PropertyRow) {
  return normalizeStatus(row.status) === "vacant";
}

function isRenovationHoldProperty(row: PropertyRow) {
  return normalizeStatus(row.status) === "renovation hold";
}

function isArchivedProperty(row: PropertyRow) {
  return normalizeStatus(row.status) === "archived";
}

function isOperationalHoldProperty(row: PropertyRow) {
  return isVacantProperty(row) || isRenovationHoldProperty(row) || isArchivedProperty(row) || normalizeStatus(row.status) === "inactive";
}

function propertyStatusBadgeClass(status?: string | null) {
  const normalized = normalizeStatus(status || "Active");
  if (normalized === "active") return "bg-green-50 text-green-700";
  if (normalized === "vacant") return "bg-yellow-50 text-yellow-800";
  if (normalized === "renovation hold") return "bg-orange-50 text-orange-800";
  if (normalized === "archived") return "bg-slate-100 text-slate-700";
  return "bg-red-50 text-red-700";
}

function propertyStatusHelpText(status?: string | null) {
  const normalized = normalizeStatus(status || "Active");
  if (normalized === "active") return "Normal annual in-home and drive-by schedule generation.";
  if (normalized === "vacant") return "Vacant: annual in-home cadence is paused. Use vacancy/turnover checks instead, then reactivate after lease-up.";
  if (normalized === "renovation hold") return "Renovation Hold: inspection generation is paused while rehab/construction is active.";
  if (normalized === "archived") return "Archived: hidden from active operations and schedule generation.";
  return "Inactive: excluded from schedule generation.";
}

function isActiveSchedule(row: ScheduleRow) {
  return ACTIVE_STATUSES.has(normalizeStatus(row.status));
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isInHomeRow(row: Pick<ScheduleRow, "report_type">) {
  return cleanText(row.report_type).toLowerCase().includes("in-home");
}

function isDriveByRow(row: Pick<ScheduleRow, "report_type">) {
  return cleanText(row.report_type).toLowerCase().includes("drive-by");
}

function buildAddress(form: PropertyForm) {
  const street = cleanText(form.street_address);
  const city = cleanText(form.city);
  const state = cleanText(form.state) || "WA";
  const zip = cleanText(form.zip);
  const unit = cleanText(form.unit);

  const main = [street, city, state, zip].filter(Boolean).join(", ");
  return unit ? `${main} (${unit})` : main;
}

function shortAddress(address?: string | null) {
  return cleanText(address).replace(/\s+/g, " ");
}

function routeSortKey(row: PropertyRow) {
  return [
    row.route_group || "ZZZ",
    row.city || "ZZZ",
    row.property_name || "",
    row.report_address || "",
    row.unit || "",
    row.property_id || "",
  ]
    .join(" | ")
    .toLowerCase();
}

function getCompletedInHomePropertyIds(rows: ScheduleRow[], cycleStartDate: string) {
  const start = asDate(cycleStartDate).getTime();
  const end = asDate(addYearsISO(cycleStartDate, 1)).getTime();

  return new Set(
    rows
      .filter((row) => normalizeStatus(row.status) === "completed")
      .filter(isInHomeRow)
      .filter((row) => {
        const scheduled = row.scheduled_date ? asDate(row.scheduled_date).getTime() : start;
        return scheduled >= start && scheduled < end;
      })
      .map((row) => cleanText(row.property_id))
      .filter(Boolean),
  );
}

function generateRows(
  properties: PropertyRow[],
  cycleStartDate: string,
  weeklyCapacity: number,
  completedInHomePropertyIds = new Set<string>(),
): ScheduleRow[] {
  const activeProperties = properties
    .filter(isActiveProperty)
    .sort((a, b) => routeSortKey(a).localeCompare(routeSortKey(b)));

  const capacity = Math.max(1, Number(weeklyCapacity || 3));
  const cycleStart = nextBusinessDay(asDate(cycleStartDate));

  return activeProperties.map((property, index) => {
    const sequenceNumber = index + 1;
    const normalInHomeSlot = sequenceNumber % 3 === 0;
    const inHomeAlreadyCompletedThisCycle = completedInHomePropertyIds.has(property.property_id);
    const isInHome = normalInHomeSlot && !inHomeAlreadyCompletedThisCycle;
    const weekIndex = Math.floor(index / capacity);
    const scheduledDate = toISODate(addWeeks(cycleStart, weekIndex));
    const routeGroup = cleanText(property.route_group) || cleanText(property.city) || "Unassigned Route";
    const reportType = isInHome ? "In-Home Visual Report" : "Drive-By Exterior Report";
    const code = isInHome ? "IH" : inHomeAlreadyCompletedThisCycle && normalInHomeSlot ? "DB-IH-COMPLETE" : "DB";
    const taskId = `${property.property_id}-${code}-${sequenceNumber}-${scheduledDate}`;

    return {
      task_id: taskId,
      property_id: property.property_id,
      status: "Scheduled",
      report_type: reportType,
      scheduled_date: scheduledDate,
      route_day: weekOfLabel(scheduledDate),
      route_group: routeGroup,
      property_name: property.property_name || property.report_address || property.property_id,
      unit: property.unit || "",
      report_address: property.report_address || "",
      assigned_to: property.assigned_to || "",
      priority: isInHome ? "High" : "Normal",
      field_scope: isInHome
        ? "Annual in-home visual condition report. Tenant notice required before entry."
        : inHomeAlreadyCompletedThisCycle && normalInHomeSlot
          ? "Exterior drive-by condition report. Annual in-home was manually completed early for this cycle."
          : "Exterior drive-by condition report. No tenant entry.",
      repair_follow_up_needed: "No",
      repair_ticket_created: "No",
      completion_notes: "",
      created_at: new Date().toISOString(),
    };
  });
}



function looseScheduleMatchKey(row: ScheduleRow) {
  const anyRow = row as any;

  const propertyName = String(anyRow.property_name || anyRow.property || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const address = String(
    anyRow.report_address ||
      anyRow.address ||
      anyRow.property_address ||
      anyRow.service_address ||
      "",
  )
    .toLowerCase()
    .replace(/\b(washington|wa)\b/g, "wa")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(southwest)\b/g, "sw")
    .replace(/\b(southeast)\b/g, "se")
    .replace(/\b(northwest)\b/g, "nw")
    .replace(/\b(northeast)\b/g, "ne")
    .replace(/\b(lakewood|spanaway|tacoma|puyallup|dupont)\b/g, "")
    .replace(/\b(98498|98499|98387|98408)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

  const streetNumber = String(address.match(/^\d+/)?.[0] || propertyName.match(/^\d+/)?.[0] || "");

  return { propertyName, address, streetNumber };
}

function rowsLookLikeSameProperty(a: ScheduleRow, b: ScheduleRow) {
  const left = looseScheduleMatchKey(a);
  const right = looseScheduleMatchKey(b);

  if (left.propertyName && right.propertyName && left.propertyName === right.propertyName) return true;
  if (left.address && right.address && left.address === right.address) return true;

  if (left.streetNumber && right.streetNumber && left.streetNumber === right.streetNumber) {
    const leftSeed = left.propertyName || left.address;
    const rightSeed = right.propertyName || right.address;

    if (leftSeed && rightSeed) {
      return leftSeed.includes(rightSeed.slice(0, 10)) || rightSeed.includes(leftSeed.slice(0, 10));
    }
  }

  return false;
}

function isBlockedByCompletedInHomeOverride(row: ScheduleRow, completedRows: ScheduleRow[]) {
  if (!isInHomeRow(row) || normalizeStatus(row.status) === "completed") return false;

  const rowTime = Date.parse(String(row.scheduled_date || ""));
  if (!Number.isFinite(rowTime)) return false;

  return completedRows.some((completed) => {
    const completedTime = Date.parse(String(completed.scheduled_date || ""));
    if (!Number.isFinite(completedTime)) return false;
    if (!rowsLookLikeSameProperty(row, completed)) return false;

    const nextAnnualDue = new Date(completedTime);
    nextAnnualDue.setFullYear(nextAnnualDue.getFullYear() + 1);

    return rowTime > completedTime && rowTime < nextAnnualDue.getTime();
  });
}


function rowDateMs(row: ScheduleRow) {
  const anyRow = row as any;
  const raw = anyRow.scheduled_date || "";
  const time = Date.parse(String(raw));
  return Number.isFinite(time) ? time : 0;
}

function normalizedPropertyKeyFromSchedule(row: ScheduleRow) {
  const anyRow = row as any;

  const address = String(
    anyRow.report_address ||
      anyRow.address ||
      anyRow.property_address ||
      anyRow.service_address ||
      "",
  )
    .toLowerCase()
    .replace(/\b(washington|wa)\b/g, "wa")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(southwest)\b/g, "sw")
    .replace(/\b(southeast)\b/g, "se")
    .replace(/\b(northwest)\b/g, "nw")
    .replace(/\b(northeast)\b/g, "ne")
    .replace(/[^a-z0-9]/g, "");

  if (address) return address;

  return String(anyRow.property_name || anyRow.property || anyRow.property_id || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isInHomeScheduleRow(row: ScheduleRow) {
  const anyRow = row as any;
  const haystack = [
    anyRow.inspection_type,
    anyRow.report_type,
    anyRow.type,
    anyRow.title,
    anyRow.notes,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return haystack.includes("in-home") || haystack.includes("in home");
}

function isCompletedScheduleRow(row: ScheduleRow) {
  return String(row.status || "").toLowerCase() === "completed";
}


function propertyOperationalStatus(row: PropertyRow) {
  return String(
    (row as any).operational_status ||
      (row as any).inspection_status ||
      (row as any).status ||
      ((row as any).is_active === false ? "Inactive" : "Active"),
  ).trim() || "Active";
}

function isNonActiveProperty(row: PropertyRow) {
  const status = propertyOperationalStatus(row).toLowerCase();
  return (
    status.includes("vacant") ||
    status.includes("renovation") ||
    status.includes("inactive") ||
    status.includes("hold") ||
    (row as any).is_active === false
  );
}

function propertyPrintAddress(row: PropertyRow) {
  return [
    (row as any).address || (row as any).property_address || (row as any).street_address || "",
    (row as any).city || "",
    (row as any).state || "",
    (row as any).zip || "",
  ]
    .filter(Boolean)
    .join(", ")
    .replace(/,\s*,/g, ",")
    .trim();
}


function isHiddenByCompletedInHomeOverride(row: ScheduleRow, completedRows: ScheduleRow[]) {
  if (!isInHomeScheduleRow(row) || isCompletedScheduleRow(row)) return false;

  const rowKey = normalizedPropertyKeyFromSchedule(row);
  const rowTime = rowDateMs(row);

  if (!rowKey || !rowTime) return false;

  return completedRows.some((completed) => {
    if (!isInHomeScheduleRow(completed) || !isCompletedScheduleRow(completed)) return false;

    const completedKey = normalizedPropertyKeyFromSchedule(completed);
    const completedTime = rowDateMs(completed);

    const sameProperty =
      Boolean(completedKey && rowKey && completedKey === rowKey) ||
      Boolean(completedKey && rowKey && completedKey.length > 8 && rowKey.includes(completedKey)) ||
      Boolean(completedKey && rowKey && rowKey.length > 8 && completedKey.includes(rowKey));

    if (!sameProperty) return false;

    const nextAnnualDue = new Date(completedTime);
    nextAnnualDue.setFullYear(nextAnnualDue.getFullYear() + 1);

    return rowTime > completedTime && rowTime < nextAnnualDue.getTime();
  });
}



function scheduleRowDateMs(row: ScheduleRow) {
  const raw = String((row as any).scheduled_date || "");
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function scheduleRowMatchTokens(row: ScheduleRow) {
  const anyRow = row as any;

  const normalize = (value: unknown) =>
    String(value || "")
      .toLowerCase()
      .replace(/\b(washington|wa)\b/g, "wa")
      .replace(/\b(street)\b/g, "st")
      .replace(/\b(avenue)\b/g, "ave")
      .replace(/\b(road)\b/g, "rd")
      .replace(/\b(drive)\b/g, "dr")
      .replace(/\b(lane)\b/g, "ln")
      .replace(/\b(court)\b/g, "ct")
      .replace(/\b(place)\b/g, "pl")
      .replace(/\b(southwest)\b/g, "sw")
      .replace(/\b(southeast)\b/g, "se")
      .replace(/\b(northwest)\b/g, "nw")
      .replace(/\b(northeast)\b/g, "ne")
      .replace(/\b(lakewood|spanaway|tacoma|puyallup|dupont|wa)\b/g, "")
      .replace(/\b\d{5}(?:-\d{4})?\b/g, "")
      .replace(/[^a-z0-9]/g, "");

  const propertyName = normalize(anyRow.property_name || anyRow.property || "");
  const reportAddress = normalize(
    anyRow.report_address ||
      anyRow.property_address ||
      anyRow.address ||
      anyRow.service_address ||
      "",
  );
  const propertyId = normalize(anyRow.property_id || "");
  const streetNumber =
    String((reportAddress || propertyName).match(/^\d+/)?.[0] || "");

  return {
    propertyName,
    reportAddress,
    propertyId,
    streetNumber,
    combined: [propertyName, reportAddress, propertyId].filter(Boolean).join("|"),
  };
}

function sameInspectionProperty(left: ScheduleRow, right: ScheduleRow) {
  const a = scheduleRowMatchTokens(left);
  const b = scheduleRowMatchTokens(right);

  if (a.propertyId && b.propertyId && a.propertyId === b.propertyId) return true;
  if (a.propertyName && b.propertyName && a.propertyName === b.propertyName) return true;
  if (a.reportAddress && b.reportAddress && a.reportAddress === b.reportAddress) return true;

  if (a.streetNumber && b.streetNumber && a.streetNumber === b.streetNumber) {
    const aSeeds = [a.propertyName, a.reportAddress].filter((value) => value.length >= 8);
    const bSeeds = [b.propertyName, b.reportAddress].filter((value) => value.length >= 8);

    return aSeeds.some((aSeed) =>
      bSeeds.some(
        (bSeed) =>
          aSeed.includes(bSeed.slice(0, Math.min(14, bSeed.length))) ||
          bSeed.includes(aSeed.slice(0, Math.min(14, aSeed.length))),
      ),
    );
  }

  return false;
}

function isBlockedByCompletedOverride(row: ScheduleRow, completedRows: ScheduleRow[]) {
  if (!isInHomeRow(row) || normalizeStatus(row.status) === "completed") return false;

  const rowTime = scheduleRowDateMs(row);
  if (!rowTime) return false;

  return completedRows.some((completed) => {
    if (!isInHomeRow(completed) || normalizeStatus(completed.status) !== "completed") return false;
    if (!sameInspectionProperty(row, completed)) return false;

    const completedTime = scheduleRowDateMs(completed);
    if (!completedTime) return false;

    const nextAnnualDue = new Date(completedTime);
    nextAnnualDue.setFullYear(nextAnnualDue.getFullYear() + 1);

    return rowTime > completedTime && rowTime < nextAnnualDue.getTime();
  });
}


export default function InspectionAdminPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [previewRows, setPreviewRows] = useState<ScheduleRow[]>([]);
  const [form, setForm] = useState<PropertyForm>(DEFAULT_FORM);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState("2026-05-25");
  const [weeklyCapacity, setWeeklyCapacity] = useState("3");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [propertyStatusFilter, setPropertyStatusFilter] = useState("All");
  const [isPropertyListOpen, setIsPropertyListOpen] = useState(true);
  const [isCompletedOverridesOpen, setIsCompletedOverridesOpen] = useState(true);
  const [isScheduleOpen, setIsScheduleOpen] = useState(true);
  const [message, setMessage] = useState("Inspection admin ready.");
  const [loading, setLoading] = useState(false);
  const [completionNotice, setCompletionNotice] = useState<CompletionNotice | null>(null);

  const activeProperties = useMemo(() => properties.filter(isActiveProperty), [properties]);
  const vacantProperties = useMemo(() => properties.filter(isVacantProperty), [properties]);
  const renovationHoldProperties = useMemo(() => properties.filter(isRenovationHoldProperty), [properties]);
  const operationalHoldProperties = useMemo(() => properties.filter(isOperationalHoldProperty), [properties]);

  const otherInactiveProperties = useMemo(
    () =>
      properties.filter((row) => {
        const status = normalizeStatus(row.status);

        return (
          !isActiveProperty(row) &&
          !isVacantProperty(row) &&
          !isRenovationHoldProperty(row) &&
          status !== "active" &&
          status !== "vacant" &&
          status !== "renovation hold"
        );
      }),
    [properties],
  );
  const completedInHomeRows = useMemo(
    () =>
      scheduleRows
        .filter(isInHomeRow)
        .filter((row) => normalizeStatus(row.status) === "completed")
        .sort((a, b) => String(b.scheduled_date || "").localeCompare(String(a.scheduled_date || ""))),
    [scheduleRows],
  );

  const hiddenBlockedInHomeRows = useMemo(
    () =>
      scheduleRows.filter(
        (row) => isActiveSchedule(row) && isBlockedByCompletedInHomeOverride(row, completedInHomeRows),
      ),
    [scheduleRows, completedInHomeRows],
  );

  const activeScheduleRows = useMemo(
    () =>
      scheduleRows.filter(
        (row) => isActiveSchedule(row) && !isBlockedByCompletedOverride(row, completedInHomeRows),
      ),
    [scheduleRows, completedInHomeRows],
  );
  const archivedRows = useMemo(() => scheduleRows.filter((row) => normalizeStatus(row.status) === "archived"), [scheduleRows]);
  const completedInHomePropertyIds = useMemo(
    () => getCompletedInHomePropertyIds(scheduleRows, cycleStartDate),
    [scheduleRows, cycleStartDate],
  );

  const activeInHomeRows = useMemo(
    () => activeScheduleRows.filter(isInHomeRow),
    [activeScheduleRows],
  );

  const activeDriveByRows = useMemo(
    () => activeScheduleRows.filter(isDriveByRow),
    [activeScheduleRows],
  );

  const filteredProperties = useMemo(() => {
    const query = search.toLowerCase().trim();

    return properties
      .filter((row) => showInactive || propertyStatusFilter !== "All" || isActiveProperty(row))
      .filter((row) => propertyStatusFilter === "All" || normalizeStatus(row.status || "Active") === normalizeStatus(propertyStatusFilter))
      .filter((row) => {
        if (!query) return true;
        return [
          row.property_id,
          row.property_name,
          row.unit,
          row.report_address,
          row.city,
          row.zip,
          row.route_group,
          row.assigned_to,
          row.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => routeSortKey(a).localeCompare(routeSortKey(b)));
  }, [properties, search, showInactive, propertyStatusFilter]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadProperties(), loadScheduleRows()]);
    setLoading(false);
  }

  async function loadProperties() {
    const { data, error } = await supabase
      .from(PROPERTY_TABLE)
      .select("*")
      .order("property_id", { ascending: true });

    if (error) {
      setMessage(`Property load failed: ${error.message}`);
      return;
    }

    const rows = (data || []) as PropertyRow[];
    setProperties(rows);

    const maxNumber = rows.reduce((max, row) => {
      const match = cleanText(row.property_id).match(/P(\d+)/i);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    setForm((prev) => ({
      ...prev,
      property_id: makePropertyId(maxNumber + 1),
    }));

    setMessage(`Loaded ${rows.length} inspection properties.`);
  }

  async function loadScheduleRows() {
    const { data, error } = await supabase
      .from(SCHEDULE_TABLE)
      .select("*")
      .order("scheduled_date", { ascending: true })
      .order("route_group", { ascending: true })
      .order("property_name", { ascending: true });

    if (error) {
      setMessage(`Schedule load failed: ${error.message}`);
      return;
    }

    setScheduleRows((data || []) as ScheduleRow[]);
  }

  function updateForm<K extends keyof PropertyForm>(key: K, value: PropertyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm(nextId?: string) {
    setForm({
      ...DEFAULT_FORM,
      property_id: nextId || form.property_id,
    });
    setEditingPropertyId(null);
  }

  async function saveProperty() {
    const propertyId = cleanText(form.property_id);
    const propertyName = cleanText(form.property_name);
    const reportAddress = buildAddress(form);

    if (!propertyId) {
      setMessage("Property ID is required.");
      return;
    }

    if (!propertyName && !reportAddress) {
      setMessage("Enter a property name or address before saving.");
      return;
    }

    const payload = {
      property_id: propertyId,
      property_name: propertyName || reportAddress,
      unit: cleanText(form.unit),
      report_address: reportAddress,
      city: cleanText(form.city),
      state: cleanText(form.state) || "WA",
      zip: cleanText(form.zip),
      route_group: cleanText(form.route_group) || cleanText(form.city),
      assigned_to: cleanText(form.assigned_to),
      status: cleanText(form.status) || "Active",
      notes: cleanText(form.notes),
      updated_at: new Date().toISOString(),
    };

    setLoading(true);

    if (editingPropertyId) {
      const { data, error } = await supabase
        .from(PROPERTY_TABLE)
        .update(payload)
        .eq("property_id", editingPropertyId)
        .select("*")
        .single();

      setLoading(false);

      if (error) {
        setMessage(`Property update failed: ${error.message}`);
        return;
      }

      setProperties((prev) => prev.map((row) => (row.property_id === editingPropertyId ? (data as PropertyRow) : row)));
      setMessage(`Property updated: ${payload.property_name}`);
      resetForm(makePropertyId(properties.length + 1));
      return;
    }

    const { data, error } = await supabase
      .from(PROPERTY_TABLE)
      .insert(payload)
      .select("*")
      .single();

    setLoading(false);

    if (error) {
      setMessage(`Property add failed: ${error.message}`);
      return;
    }

    const saved = data as PropertyRow;
    setProperties((prev) => [...prev, saved]);
    setMessage(`Property added: ${saved.property_name || saved.property_id}`);

    const maxNumber = Math.max(
      ...[...properties, saved].map((row) => {
        const match = cleanText(row.property_id).match(/P(\d+)/i);
        return match ? Number(match[1]) : 0;
      }),
      0,
    );

    resetForm(makePropertyId(maxNumber + 1));
  }

  function editProperty(row: PropertyRow) {
    const address = cleanText(row.report_address);
    setEditingPropertyId(row.property_id);
    setForm({
      property_id: row.property_id || "",
      property_name: row.property_name || "",
      unit: row.unit || "",
      street_address: address,
      city: row.city || "",
      state: row.state || "WA",
      zip: row.zip || "",
      route_group: row.route_group || "",
      assigned_to: row.assigned_to || "",
      status: row.status || "Active",
      notes: row.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updatePropertyOperationalStatus(row: PropertyRow, status: string, reason: string) {
    const label = row.property_name || row.report_address || row.property_id;
    const ok = window.confirm(`${reason} ${label}?

Status will be set to: ${status}.`);
    if (!ok) return;

    const statusNote = `${new Date().toLocaleDateString()}: Status changed to ${status}. ${propertyStatusHelpText(status)}`;
    const notes = [statusNote, row.notes || ""].filter(Boolean).join("\n");

    setLoading(true);
    const { error } = await supabase
      .from(PROPERTY_TABLE)
      .update({ status, notes, updated_at: new Date().toISOString() })
      .eq("property_id", row.property_id);
    setLoading(false);

    if (error) {
      setMessage(`Status update failed: ${error.message}`);
      return;
    }

    setProperties((prev) =>
      prev.map((item) => (item.property_id === row.property_id ? { ...item, status, notes } : item)),
    );

    setMessage(`${label} set to ${status}. ${propertyStatusHelpText(status)}${status === "Active" ? " Returned to normal schedule generation." : " Use the status filter or Show inactive / vacant / holds to view it again."}`);
  }

  async function deactivateProperty(row: PropertyRow) {
    await updatePropertyOperationalStatus(row, "Inactive", "Deactivate");
  }

  async function removeCompletedOverride(row: ScheduleRow) {
    const label = row.property_name || row.report_address || row.property_id || "this property";
    const ok = window.confirm(
      `Remove completed in-home override for ${label}?\n\nUse this only to correct accidental duplicate completed rows.`
    );

    if (!ok) return;

    setLoading(true);

    const query = row.id
      ? supabase.from(SCHEDULE_TABLE).delete().eq("id", row.id)
      : supabase.from(SCHEDULE_TABLE).delete().eq("task_id", row.task_id);

    const { error } = await query;

    setLoading(false);

    if (error) {
      setMessage(`Duplicate override removal failed: ${error.message}`);
      return;
    }

    await loadScheduleRows();
    setMessage(`Completed in-home override removed for ${label}.`);
  }

  function previewSchedule() {
    const rows = generateRows(properties, cycleStartDate, Number(weeklyCapacity), completedInHomePropertyIds);
    setPreviewRows(rows);
    setMessage(`Weekly preview generated: ${rows.length} active-property rows using DB, DB, IH sequence (${rows.filter(isInHomeRow).length} in-home, ${rows.filter(isDriveByRow).length} drive-by). Vacant/renovation/inactive properties are skipped. ${completedInHomePropertyIds.size} properties have an in-home completed for this cycle and will not receive another in-home.`);
  }

  async function archiveCurrentSchedule() {
    const ok = window.confirm("Archive all current non-completed schedule rows?");
    if (!ok) return;

    setLoading(true);

    const { error } = await supabase
      .from(SCHEDULE_TABLE)
      .update({ status: "Archived" })
      .neq("status", "Completed");

    setLoading(false);

    if (error) {
      setMessage(`Archive failed: ${error.message}`);
      return;
    }

    await loadScheduleRows();
    setMessage("Current non-completed schedule rows archived.");
  }

  async function restoreArchivedSchedule() {
    const ok = window.confirm("Restore all archived schedule rows back to Scheduled?");
    if (!ok) return;

    setLoading(true);

    const { error } = await supabase
      .from(SCHEDULE_TABLE)
      .update({ status: "Scheduled" })
      .eq("status", "Archived");

    setLoading(false);

    if (error) {
      setMessage(`Restore failed: ${error.message}`);
      return;
    }

    await loadScheduleRows();
    setMessage("Archived rows restored.");
  }

  async function markInHomeCompleteToday(row: ScheduleRow) {
    if (!isInHomeRow(row)) {
      setMessage("Only in-home visual report rows can be marked complete with this action.");
      return;
    }

    const propertyLabel = row.property_name || row.report_address || row.property_id || "this property";
    const today = todayISO();
    const nextDue = addYearsISO(today, 1);
    const ok = window.confirm(
      `Mark the in-home visual report complete for ${propertyLabel} today?\n\nThis counts as the annual in-home for this cycle and prevents another in-home from being generated until around ${dateLabel(nextDue)}. Drive-bys can still remain on the schedule.`,
    );
    if (!ok) return;

    const notes = [
      `Manual in-home completion override: completed early on ${today}.`,
      `Next in-home due after ${nextDue}.`,
      "Drive-by cadence remains separate.",
      row.completion_notes || "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      status: "Completed",
      scheduled_date: today,
      route_day: weekOfLabel(today),
      priority: "Completed",
      completion_notes: notes,
    };

    setLoading(true);

    const query = row.id
      ? supabase.from(SCHEDULE_TABLE).update(payload).eq("id", row.id)
      : supabase.from(SCHEDULE_TABLE).update(payload).eq("task_id", row.task_id);

    const { error } = await query;
    setLoading(false);

    if (error) {
      setMessage(`In-home completion failed: ${error.message}`);
      return;
    }

    await loadScheduleRows();
    setCompletionNotice({
      propertyLabel,
      propertyId: cleanText(row.property_id),
      completedDate: today,
      nextInHomeDue: nextDue,
      action: "updated",
    });
    setMessage(`Marked ${propertyLabel} in-home complete today. Next in-home due after ${nextDue}; drive-bys remain separate.`);
  }


  async function markPropertyInHomeCompleteToday(property: PropertyRow) {
    const propertyLabel = property.property_name || property.report_address || property.property_id || "this property";
    const today = todayISO();
    const nextDue = addYearsISO(today, 1);

    const alreadyCompleted = scheduleRows.some(
      (row) => row.property_id === property.property_id && isInHomeRow(row) && normalizeStatus(row.status) === "completed" && isDateOnOrAfter(row.scheduled_date, cycleStartDate),
    );

    if (alreadyCompleted) {
      setMessage(`${propertyLabel} already has an in-home marked complete for this cycle.`);
      return;
    }

    const ok = window.confirm(
      `Mark in-home visual report complete for ${propertyLabel} today?\n\nUse this when you completed the in-home visual report early while already at the property. This will count as the annual in-home for this cycle and prevent another in-home from being regenerated until around ${dateLabel(nextDue)}. Drive-bys stay separate.`,
    );
    if (!ok) return;

    const existingInHome = scheduleRows.find(
      (row) => row.property_id === property.property_id && isInHomeRow(row) && normalizeStatus(row.status) !== "completed",
    );

    const notes = [
      `Manual in-home completion override: completed early on ${today}.`,
      `Next in-home due after ${nextDue}.`,
      "Drive-by cadence remains separate.",
      existingInHome?.completion_notes || "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      status: "Completed",
      report_type: "In-Home Visual Report",
      scheduled_date: today,
      route_day: weekOfLabel(today),
      route_group: cleanText(property.route_group) || cleanText(property.city) || "Unassigned Route",
      property_name: property.property_name || property.report_address || property.property_id,
      unit: property.unit || "",
      report_address: property.report_address || "",
      assigned_to: property.assigned_to || "",
      priority: "Completed",
      field_scope: "Annual in-home visual condition report completed early by manual override.",
      completion_notes: notes,
      repair_follow_up_needed: "No",
      repair_ticket_created: "No",
    };

    setLoading(true);

    const result = existingInHome
      ? existingInHome.id
        ? await supabase.from(SCHEDULE_TABLE).update(payload).eq("id", existingInHome.id)
        : await supabase.from(SCHEDULE_TABLE).update(payload).eq("task_id", existingInHome.task_id)
      : await supabase.from(SCHEDULE_TABLE).insert({
          ...payload,
          task_id: `${property.property_id}-IH-MANUAL-${today}`,
          property_id: property.property_id,
          created_at: new Date().toISOString(),
        });

    setLoading(false);

    if (result.error) {
      setMessage(`In-home completion failed: ${result.error.message}`);
      return;
    }

    await loadScheduleRows();
    setCompletionNotice({
      propertyLabel,
      propertyId: property.property_id,
      completedDate: today,
      nextInHomeDue: nextDue,
      action: existingInHome ? "updated" : "created",
    });
    setMessage(`Marked ${propertyLabel} in-home complete today. Next in-home due after ${nextDue}; drive-bys remain separate.`);
  }

  async function regenerateCloudSchedule() {
    const active = properties.filter(isActiveProperty);
    if (active.length === 0) {
      setMessage("No active managed properties. Add/import properties first.");
      return;
    }

    const completedIds = getCompletedInHomePropertyIds(scheduleRows, cycleStartDate);
    const ok = window.confirm(
      `Regenerate schedule for ${active.length} active properties?

Vacant, Renovation Hold, Inactive, and Archived properties will be skipped.\n\nThis archives old non-completed rows and creates ONE row per property grouped by week using the repeating sequence:\nDrive-By, Drive-By, In-Home, Drive-By, Drive-By, In-Home. The capacity number means inspections per week, not per day.\n\n${completedIds.size} properties already have a completed in-home for this cycle and will not receive another in-home.`,
    );
    if (!ok) return;

    const rows = generateRows(properties, cycleStartDate, Number(weeklyCapacity), completedIds);
    const inHome = rows.filter(isInHomeRow).length;
    const driveBy = rows.filter(isDriveByRow).length;

    setLoading(true);
    setMessage("Archiving old rows...");

    const archiveResult = await supabase
      .from(SCHEDULE_TABLE)
      .update({ status: "Archived" })
      .neq("status", "Completed");

    if (archiveResult.error) {
      setLoading(false);
      setMessage(`Archive failed: ${archiveResult.error.message}`);
      return;
    }

    setMessage("Saving new generated schedule...");

    const insertResult = await supabase
      .from(SCHEDULE_TABLE)
      .insert(rows);

    setLoading(false);

    if (insertResult.error) {
      setMessage(`Schedule regeneration failed: ${insertResult.error.message}`);
      return;
    }

    setPreviewRows(rows);
    await loadScheduleRows();
    setMessage(`Cloud weekly schedule regenerated: ${rows.length} active-property rows saved using DB, DB, IH sequence (${inHome} in-home, ${driveBy} drive-by). Vacant/renovation/inactive properties skipped. Completed in-home overrides preserved for ${completedIds.size} properties.`);
  }

  async function importMissingPropertiesFromSchedule() {
    const existingIds = new Set(properties.map((row) => row.property_id));
    const sourceRows = scheduleRows.filter((row) => row.property_id && !existingIds.has(row.property_id));

    const unique = new Map<string, PropertyRow>();
    sourceRows.forEach((row) => {
      if (!row.property_id || unique.has(row.property_id)) return;
      unique.set(row.property_id, {
        property_id: row.property_id,
        property_name: row.property_name || row.report_address || row.property_id,
        unit: row.unit || "",
        report_address: row.report_address || "",
        city: "",
        state: "WA",
        zip: "",
        route_group: row.route_group || "",
        assigned_to: row.assigned_to || "",
        status: "Active",
        notes: "Backfilled from inspection_schedule_v2.",
      });
    });

    const rows = Array.from(unique.values());

    if (rows.length === 0) {
      setMessage("No missing properties found to import.");
      return;
    }

    const ok = window.confirm(`Import ${rows.length} missing properties from inspection_schedule_v2?`);
    if (!ok) return;

    setLoading(true);

    const { error } = await supabase
      .from(PROPERTY_TABLE)
      .insert(rows);

    setLoading(false);

    if (error) {
      setMessage(`Property import failed: ${error.message}`);
      return;
    }

    await loadProperties();
    setMessage(`Imported ${rows.length} missing properties.`);
  }

  
  function printNonActivePropertiesReport(filter: "all" | "vacant" | "renovation" | "inactive" | "other" | "managed") {
    const rows = properties.filter((row) => {
      const status = propertyOperationalStatus(row).toLowerCase();

      if (filter === "managed") return true;

      if (!isNonActiveProperty(row)) return false;
      if (filter === "vacant") return status.includes("vacant");
      if (filter === "renovation") return status.includes("renovation") || status.includes("hold");
      if (filter === "inactive") return status.includes("inactive") || (row as any).is_active === false;
      if (filter === "other") {
        return (
          !status.includes("vacant") &&
          !status.includes("renovation") &&
          !status.includes("hold") &&
          !status.includes("inactive")
        );
      }

      return true;
    });

    if (!rows.length) {
      setMessage("No matching non-active properties found for print.");
      return;
    }

    const title =
      filter === "managed"
        ? "Managed Property List"
        : filter === "vacant"
          ? "Vacant Property Report"
          : filter === "renovation"
            ? "Renovation Hold Property Report"
            : filter === "inactive"
              ? "Inactive Property Report"
              : filter === "other"
                ? "Other / Inactive Property Report"
                : "All Non-Active Property Status Report";

    const generatedAt = new Date().toLocaleString();

    const safe = (value: unknown) =>
      String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safe(title)}</title>
  <style>
    @page { size: letter landscape; margin: 0.45in; }
    body { font-family: Arial, sans-serif; color: #1f1f1f; margin: 0; }
    header { border-bottom: 3px solid #3f2a1b; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; }
    .sub { margin-top: 4px; color: #5f4a39; font-size: 12px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #3f2a1b; color: #fff8f0; text-align: left; padding: 8px; border: 1px solid #3f2a1b; }
    td { padding: 8px; border: 1px solid #d8c4aa; vertical-align: top; }
    tr:nth-child(even) td { background: #fffaf3; }
    .status { font-weight: 900; color: #7b4b1f; }
    .footer { margin-top: 14px; font-size: 10px; color: #5f4a39; border-top: 1px solid #d8c4aa; padding-top: 8px; }
  </style>
</head>
<body>
  <header>
    <h1>${safe(title)}</h1>
    <div class="sub">Aspen / 5 Tools Inspection Admin • Generated ${safe(generatedAt)} • ${rows.length} properties</div>
  </header>
  <table>
    <thead>
      <tr>
        <th style="width:14%">Property</th>
        <th style="width:24%">Address</th>
        <th style="width:13%">Operational Status</th>
        <th style="width:13%">Route</th>
        <th style="width:12%">Last In-Home</th>
        <th style="width:12%">Expected Return</th>
        <th style="width:12%">Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((row) => {
          const anyRow = row as any;
          const route = [anyRow.route_group, anyRow.route_subgroup || anyRow.route_area || anyRow.route]
            .filter(Boolean)
            .join(" / ");
          const notes = anyRow.notes || anyRow.operational_notes || anyRow.status_notes || "";
          return `<tr>
            <td><strong>${safe(anyRow.property_name || anyRow.name || anyRow.property || anyRow.id || "")}</strong></td>
            <td>${safe(propertyPrintAddress(row))}</td>
            <td class="status">${safe(propertyOperationalStatus(row))}</td>
            <td>${safe(route || "Unassigned")}</td>
            <td>${safe(anyRow.last_in_home_date || anyRow.last_report_date || anyRow.last_inspection_date || "--")}</td>
            <td>${safe(anyRow.expected_return_date || anyRow.return_to_active_date || "--")}</td>
            <td>${safe(notes || "--")}</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
  <div class="footer">
    Managed property report is for operational tracking. Vacant and renovation hold statuses pause normal annual in-home scheduling until returned to active status.
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setMessage("Print window blocked. Allow popups and try again.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }



  function exportManagedPropertiesCsv(filter: "managed" | "vacant" | "renovation" | "inactive" | "other" | "allNonActive") {
    const rows = properties.filter((row) => {
      const status = propertyOperationalStatus(row).toLowerCase();

      if (filter === "managed") return true;
      if (filter === "vacant") return status.includes("vacant");
      if (filter === "renovation") return status.includes("renovation") || status.includes("hold");
      if (filter === "inactive") return status.includes("inactive") || (row as any).is_active === false;
      if (filter === "other") {
        return (
          !isActiveProperty(row) &&
          !isVacantProperty(row) &&
          !isRenovationHoldProperty(row) &&
          !status.includes("vacant") &&
          !status.includes("renovation") &&
          !status.includes("hold") &&
          !status.includes("inactive")
        );
      }

      return isNonActiveProperty(row);
    });

    if (!rows.length) {
      setMessage("No matching properties found for CSV export.");
      return;
    }

    const csvSafe = (value: unknown) => {
      const textValue = String(value ?? "");
      return `"${textValue.replace(/"/g, '""')}"`;
    };

    const header = [
      "Property ID",
      "Property Name",
      "Unit",
      "Address",
      "City",
      "State",
      "Zip",
      "Route",
      "Operational Status",
      "Active",
      "Last In-Home",
      "Expected Return",
      "Notes",
    ];

    const csvRows = rows.map((row) => {
      const anyRow = row as any;
      const route = [anyRow.route_group, anyRow.route_subgroup || anyRow.route_area || anyRow.route]
        .filter(Boolean)
        .join(" / ");

      return [
        anyRow.property_id || anyRow.id || "",
        anyRow.property_name || anyRow.name || anyRow.property || "",
        anyRow.unit || "",
        anyRow.address || anyRow.property_address || anyRow.street_address || "",
        anyRow.city || "",
        anyRow.state || "",
        anyRow.zip || "",
        route || "Unassigned",
        propertyOperationalStatus(row),
        anyRow.is_active === false ? "No" : "Yes",
        anyRow.last_in_home_date || anyRow.last_report_date || anyRow.last_inspection_date || "",
        anyRow.expected_return_date || anyRow.return_to_active_date || "",
        anyRow.notes || anyRow.operational_notes || anyRow.status_notes || "",
      ].map(csvSafe).join(",");
    });

    const csv = [header.map(csvSafe).join(","), ...csvRows].join("\n");
    const fileLabel =
      filter === "managed"
        ? "managed-property-list"
        : filter === "vacant"
          ? "vacant-property-list"
          : filter === "renovation"
            ? "renovation-hold-property-list"
            : filter === "inactive"
              ? "inactive-property-list"
              : filter === "other"
                ? "other-inactive-property-list"
                : "all-non-active-property-list";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setMessage(`CSV exported: ${rows.length} properties.`);
  }


const buttonClass = "rounded-lg border border-[#d8c4aa] bg-white px-4 py-2 text-sm font-black text-[#3c2719] hover:bg-[#fbf6ef] disabled:cursor-not-allowed disabled:opacity-50";
  const primaryButtonClass = "rounded-lg border border-[#a56a2a] bg-[#995f1e] px-4 py-2 text-sm font-black text-white hover:bg-[#7c4917] disabled:cursor-not-allowed disabled:opacity-50";
  const dangerButtonClass = "rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass = "w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#a56a2a] focus:ring-2 focus:ring-[#f4e6d5]";
  const cardClass = "rounded-xl border border-[#d8c4aa] bg-white p-4 shadow-sm";

  return (
    <div className="min-h-screen bg-[#f3eadf] text-[#111111]">
      <header className="border-b border-[#d8c4aa] bg-[#f7efe5]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-3xl font-black tracking-tight text-[#2b190f]">5Tools</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.5em] text-[#9a5a16]">
              Inspection Admin Control
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonClass}>← Dashboard</Link>
            <Link href="/operation-assistant" className={buttonClass}>Operations Assistant</Link>
            <Link href="/inspections" className={primaryButtonClass}>Open Inspections</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
        <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <div className={cardClass}>
            <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">Managed Properties</div>
            <div className="mt-2 text-3xl font-black">{properties.length}</div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">Active Properties</div>
            <div className="mt-2 text-3xl font-black">{activeProperties.length}</div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">Vacant</div>
            <div className="mt-2 text-3xl font-black">{vacantProperties.length}</div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">Renovation Hold</div>
            <div className="mt-2 text-3xl font-black">{renovationHoldProperties.length}</div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">Current Active Schedule</div>
            <div className="mt-2 text-3xl font-black">{activeScheduleRows.length}</div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">In-Home Completed This Cycle</div>
            <div className="mt-2 text-3xl font-black">{completedInHomePropertyIds.size}</div>
          </div>
          <div className={cardClass}>
            <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">Generated Preview</div>
            <div className="mt-2 text-3xl font-black">{previewRows.length}</div>
          </div>
        </section>

        {message ? (
          <div className="mb-4 rounded-xl border border-[#d8c4aa] bg-white px-4 py-3 text-sm font-bold text-[#3c2719]">
            {loading ? "Working... " : ""}{message}
          </div>
        ) : null}

        <section className="mb-4 rounded-xl border border-[#d8c4aa] bg-[#fffaf4] p-4 text-xs font-bold leading-5 text-[#3c2719]">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-[#2b190f]">Operational status rules</p>
              <p className="mt-1">Active properties generate the normal annual in-home / drive-by cadence. Vacant properties pause tenant in-home scheduling and should use vacancy or turnover checks. Renovation Hold pauses all generated inspection scheduling until the property is reactivated. Inactive and Archived are also excluded from generation.</p>
            </div>
            <Badge>{operationalHoldProperties.length} excluded from generator</Badge>
          </div>
        </section>

        {completionNotice ? (
          <section className="mb-4 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-950 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-green-700">In-Home Visual Report Completed</p>
                <h2 className="mt-1 text-lg font-black">{completionNotice.propertyLabel}</h2>
                <p className="mt-1 font-bold">
                  Completed: {dateLabel(completionNotice.completedDate)} · Next in-home due after: {dateLabel(completionNotice.nextInHomeDue)}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5">
                  The completed row is now removed from the active schedule list by design. It is saved under Completed In-Home Overrides below, and the generator will skip another in-home for this property until the next cycle. Drive-bys remain separate.
                </p>
              </div>
              <button type="button" onClick={() => setCompletionNotice(null)} className="rounded-lg border border-green-400 bg-white px-4 py-2 text-xs font-black text-green-800 hover:bg-green-100">
                Dismiss
              </button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className={cardClass}>
              <h2 className="text-lg font-black">Add Managed Property</h2>
              <p className="mt-1 text-xs font-semibold text-[#3c2719]">
                Master list used to generate inspection schedules.
              </p>

              <div className="mt-4 space-y-3">
                <Field label="Property ID">
                  <input className={inputClass} value={form.property_id} onChange={(e) => updateForm("property_id", e.target.value)} />
                </Field>
                <Field label="Property Name">
                  <input className={inputClass} value={form.property_name} onChange={(e) => updateForm("property_name", e.target.value)} placeholder="Example: North Orchard Street" />
                </Field>
                <Field label="Unit">
                  <input className={inputClass} value={form.unit} onChange={(e) => updateForm("unit", e.target.value)} placeholder="Example: Unit 4 or #4" />
                </Field>
                <Field label="Street Address">
                  <input className={inputClass} value={form.street_address} onChange={(e) => updateForm("street_address", e.target.value)} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="City">
                    <input className={inputClass} value={form.city} onChange={(e) => updateForm("city", e.target.value)} />
                  </Field>
                  <Field label="State">
                    <input className={inputClass} value={form.state} onChange={(e) => updateForm("state", e.target.value)} />
                  </Field>
                  <Field label="ZIP">
                    <input className={inputClass} value={form.zip} onChange={(e) => updateForm("zip", e.target.value)} />
                  </Field>
                </div>
                <Field label="Route Group">
                  <input className={inputClass} value={form.route_group} onChange={(e) => updateForm("route_group", e.target.value)} placeholder="Tacoma / Lakewood / ZIP / Route A" />
                </Field>
                <Field label="Assigned To">
                  <input className={inputClass} value={form.assigned_to} onChange={(e) => updateForm("assigned_to", e.target.value)} />
                </Field>
                <Field label="Status">
                  <select className={inputClass} value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                    {PROPERTY_OPERATIONAL_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] font-semibold leading-4 text-[#7a4d20]">
                    {propertyStatusHelpText(form.status)}
                  </p>
                </Field>
                <Field label="Notes">
                  <textarea className={`${inputClass} min-h-20`} value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={saveProperty} disabled={loading} className={primaryButtonClass}>
                    {editingPropertyId ? "Update Property" : "Add Property"}
                  </button>
                  <button type="button" onClick={() => resetForm()} className={buttonClass}>
                    Clear
                  </button>
                </div>
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-black">Schedule Generator</h2>
              <p className="mt-1 text-xs font-semibold text-[#3c2719]">
                Generates the DB, DB, IH route sequence by week. Manual in-home completion overrides are preserved.
              </p>

              <div className="mt-4 space-y-3">
                <Field label="Cycle Start Date">
                  <input type="date" className={inputClass} value={cycleStartDate} onChange={(e) => setCycleStartDate(e.target.value)} />
                </Field>
                <Field label="Inspections Per Week">
                  <input type="number" min="1" className={inputClass} value={weeklyCapacity} onChange={(e) => setWeeklyCapacity(e.target.value)} />
                  <p className="mt-1 text-[11px] font-semibold leading-4 text-[#7a4d20]">
                    Example: 3 means three total inspections for the week of the cycle start date, then the next three move to the following week.
                  </p>
                </Field>

                <div className="rounded-lg border border-[#d8c4aa] bg-[#fffaf4] p-3 text-xs font-bold leading-5 text-[#3c2719]">
                  Rule: repeating Drive-By, Drive-By, In-Home sequence for Active properties only. The number entered is inspections per week, not per day. Vacant, Renovation Hold, Inactive, and Archived properties are excluded from schedule generation. If an in-home is manually marked complete early, the generator will skip another in-home for that property until the next cycle.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={previewSchedule} className={buttonClass}>Preview Schedule</button>
                  <button type="button" onClick={regenerateCloudSchedule} disabled={loading} className={primaryButtonClass}>Regenerate Cloud Schedule</button>
                  <button type="button" onClick={loadScheduleRows} className={buttonClass}>Refresh Schedule</button>
                  <button type="button" onClick={archiveCurrentSchedule} disabled={loading} className={dangerButtonClass}>Archive Current Schedule</button>
                  <button type="button" onClick={restoreArchivedSchedule} disabled={loading} className={buttonClass}>Restore Archived</button>
                  <button type="button" onClick={importMissingPropertiesFromSchedule} disabled={loading} className={buttonClass}>Import Missing Properties</button>
                </div>
              </div>
            </section>
          </aside>

          <section className="min-w-0 space-y-5">
            <section className={cardClass}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black">Managed Property List</h2>
                  <p className="mt-1 text-xs font-semibold text-[#3c2719]">Add new homes here and deactivate homes no longer managed.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setIsPropertyListOpen((prev) => !prev)} className={buttonClass}>
                    {isPropertyListOpen ? "Collapse" : "Expand"}
                  </button>
                  <button type="button" onClick={loadProperties} className={buttonClass}>Refresh Properties</button>
                  <label className="flex items-center gap-2 rounded-lg border border-[#d8c4aa] bg-white px-4 py-2 text-xs font-black text-[#3c2719]">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                    Show inactive / vacant / holds
                  </label>
                </div>
              </div>

              <div className="mb-3 rounded-xl border border-[#d8c4aa] bg-[#fffaf4] p-3">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#7b4b1f]">
                  Non-Active Print Reports
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => printNonActivePropertiesReport("managed")}
                    className="rounded-lg bg-[#3c2719] px-3 py-2 text-xs font-black text-white hover:bg-[#5b3516]"
                  >
                    Print Managed Property List
                  </button>
                  <button
                    type="button"
                    onClick={() => exportManagedPropertiesCsv("managed")}
                    className="rounded-lg bg-[#b57a32] px-3 py-2 text-xs font-black text-white hover:bg-[#8f5d23]"
                  >
                    CSV Managed Property List
                  </button>
                  <button
                    type="button"
                    onClick={() => printNonActivePropertiesReport("vacant")}
                    className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]"
                  >
                    Print Vacant
                  </button>
                  <button
                    type="button"
                    onClick={() => exportManagedPropertiesCsv("vacant")}
                    className="rounded-lg border border-[#b57a32] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#7b4b1f] hover:bg-[#f7efe5]"
                  >
                    CSV Vacant
                  </button>
                  <button
                    type="button"
                    onClick={() => printNonActivePropertiesReport("renovation")}
                    className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]"
                  >
                    Print Remodel / Renovation
                  </button>
                  <button
                    type="button"
                    onClick={() => exportManagedPropertiesCsv("renovation")}
                    className="rounded-lg border border-[#b57a32] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#7b4b1f] hover:bg-[#f7efe5]"
                  >
                    CSV Remodel / Renovation
                  </button>
                  <button
                    type="button"
                    onClick={() => printNonActivePropertiesReport("inactive")}
                    className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]"
                  >
                    Print Inactive
                  </button>
                  <button
                    type="button"
                    onClick={() => exportManagedPropertiesCsv("inactive")}
                    className="rounded-lg border border-[#b57a32] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#7b4b1f] hover:bg-[#f7efe5]"
                  >
                    CSV Inactive
                  </button>
                  <button
                    type="button"
                    onClick={() => printNonActivePropertiesReport("other")}
                    className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]"
                  >
                    Print Other / Inactive
                  </button>
                  <button
                    type="button"
                    onClick={() => exportManagedPropertiesCsv("other")}
                    className="rounded-lg border border-[#b57a32] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#7b4b1f] hover:bg-[#f7efe5]"
                  >
                    CSV Other / Inactive
                  </button>
                  <button
                    type="button"
                    onClick={() => printNonActivePropertiesReport("all")}
                    className="rounded-lg bg-[#7b4b1f] px-3 py-2 text-xs font-black text-white hover:bg-[#5b3516]"
                  >
                    Print All Non-Active
                  </button>
                  <button
                    type="button"
                    onClick={() => exportManagedPropertiesCsv("allNonActive")}
                    className="rounded-lg bg-[#b57a32] px-3 py-2 text-xs font-black text-white hover:bg-[#8f5d23]"
                  >
                    CSV All Non-Active
                  </button>
                </div>
              </div>

              {isPropertyListOpen ? (
                <>
                  <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_260px]">
                    <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search properties..." />
                    <select
                      className={inputClass}
                      value={propertyStatusFilter}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        setPropertyStatusFilter(nextStatus);
                        if (nextStatus !== "All") setShowInactive(true);
                      }}
                    >
                      <option value="All">All operational statuses</option>
                      {PROPERTY_OPERATIONAL_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="max-h-[620px] overflow-auto rounded-xl border border-[#d8c4aa] bg-white">
                    <table className="w-full min-w-[1480px] text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-[#fffaf4] text-xs font-black uppercase tracking-wide text-[#7a4d20]">
                        <tr>
                          <th className="w-[130px] px-4 py-3">ID</th>
                          <th className="w-[260px] px-4 py-3">Property</th>
                          <th className="w-[420px] px-4 py-3">Address</th>
                          <th className="w-[180px] px-4 py-3">Route</th>
                          <th className="w-[120px] px-4 py-3">Status</th>
                          <th className="sticky right-0 w-[380px] bg-[#fffaf4] px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProperties.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-[#3c2719]">No properties found.</td>
                          </tr>
                        ) : (
                          filteredProperties.map((row) => (
                            <tr key={row.property_id} className="border-t border-[#eadbc8]">
                              <td className="px-4 py-4 font-black">{row.property_id}</td>
                              <td className="px-4 py-4">
                                <div className="font-black">{row.property_name || "No property name"}</div>
                                {row.unit ? <div className="mt-1 text-xs text-[#3c2719]">{row.unit}</div> : null}
                              </td>
                              <td className="px-4 py-4 font-semibold">{shortAddress(row.report_address)}</td>
                              <td className="px-4 py-4 font-bold">{row.route_group || "—"}</td>
                              <td className="px-4 py-4">
                                <span className={`rounded-full px-3 py-1 text-xs font-black ${propertyStatusBadgeClass(row.status)}`}>
                                  {row.status || "Active"}
                                </span>
                                <div className="mt-1 max-w-[160px] text-[10px] font-semibold leading-4 text-[#7a4d20]">
                                  {propertyStatusHelpText(row.status)}
                                </div>
                              </td>
                              <td className="sticky right-0 bg-white px-4 py-4">
                                <div className="mb-2">
                                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#7a4d20]">Operational Status</label>
                                  <select
                                    className="w-full rounded-lg border border-[#d8c4aa] bg-[#fffaf4] px-3 py-2 text-xs font-black text-[#2b190f] outline-none focus:border-[#9a5a16] focus:bg-white focus:ring-2 focus:ring-[#c47b2c]/20"
                                    value={row.status || "Active"}
                                    disabled={loading}
                                    onChange={(e) => updatePropertyOperationalStatus(row, e.target.value, "Change operational status for")}
                                  >
                                    {PROPERTY_OPERATIONAL_STATUSES.map((status) => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => editProperty(row)} className={buttonClass}>Edit</button>
                                  {isActiveProperty(row) ? (
                                    <>
                                      <button type="button" onClick={() => markPropertyInHomeCompleteToday(row)} disabled={loading} className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-black text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50">Mark In-Home Done</button>
                                      <button type="button" onClick={() => updatePropertyOperationalStatus(row, "Vacant", "Mark vacant") } disabled={loading} className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-black text-yellow-800 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50">Mark Vacant</button>
                                      <button type="button" onClick={() => updatePropertyOperationalStatus(row, "Renovation Hold", "Place on renovation hold") } disabled={loading} className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50">Renovation Hold</button>
                                      <button type="button" onClick={() => deactivateProperty(row)} disabled={loading} className={dangerButtonClass}>Deactivate</button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" onClick={() => updatePropertyOperationalStatus(row, "Active", "Reactivate") } disabled={loading} className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-black text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50">Reactivate</button>
                                      {isVacantProperty(row) ? (
                                        <button type="button" onClick={() => updatePropertyOperationalStatus(row, "Renovation Hold", "Move from vacant to renovation hold") } disabled={loading} className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50">Renovation Hold</button>
                                      ) : null}
                                      {isRenovationHoldProperty(row) ? (
                                        <button type="button" onClick={() => updatePropertyOperationalStatus(row, "Vacant", "Move from renovation hold to vacant") } disabled={loading} className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-black text-yellow-800 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50">Mark Vacant</button>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[#d8c4aa] bg-[#fffaf4] p-5 text-sm font-bold text-[#3c2719]">
                  Property list collapsed. {filteredProperties.length} properties available.
                </div>
              )}
            </section>

            {previewRows.length > 0 ? (
              <SchedulePanel
                title="Generated Preview"
                rows={previewRows}
                isOpen={true}
                onToggle={() => undefined}
                countsLabel={`${previewRows.length} preview rows`}
              />
            ) : null}

            {completedInHomeRows.length > 0 ? (
              <SchedulePanel
                title="Completed In-Home Overrides"
                subtitle="Completed in-home visual reports are intentionally hidden from the active schedule. This panel confirms early in-home completions and the dates used to block duplicate annual in-home rows."
                rows={completedInHomeRows}
                isOpen={isCompletedOverridesOpen}
                onToggle={() => setIsCompletedOverridesOpen((prev) => !prev)}
                countsLabel={`${completedInHomeRows.length} completed in-home rows`}
                extraBadges={<Badge>Next due is shown in notes</Badge>}
                collapsedLabel="Completed in-home overrides collapsed"
                onRemoveCompletedOverride={removeCompletedOverride}
                actionDisabled={loading}
              />
            ) : null}

            <SchedulePanel
              title="Current Cloud Schedule"
              subtitle="This is what Operations Assistant reads from inspection_schedule_v2. Future scheduled in-home rows are hidden here when a completed in-home override already covers that annual cycle. Hidden count confirms blocked future rows."
              rows={activeScheduleRows}
              isOpen={isScheduleOpen}
              onToggle={() => setIsScheduleOpen((prev) => !prev)}
              countsLabel={`${activeScheduleRows.length} active rows`}
              onMarkInHomeComplete={markInHomeCompleteToday}
              actionDisabled={loading}
              extraBadges={
                <>
                  <Badge tone="red">{archivedRows.length} archived</Badge>
                  <Badge>In-home: {activeInHomeRows.length}</Badge>
                  <Badge>Drive-by: {activeDriveByRows.length}</Badge>
                  <Badge>IH completed: {completedInHomePropertyIds.size}</Badge>
                </>
              }
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[#3c2719]">{label}</span>
      {children}
    </label>
  );
}

function Badge({ children, tone = "brown" }: { children: React.ReactNode; tone?: "brown" | "red" }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tone === "red" ? "bg-red-50 text-red-700" : "bg-[#fbf6ef] text-[#7a4d20]"}`}>
      {children}
    </span>
  );
}

function SchedulePanel({
  title,
  subtitle,
  rows,
  isOpen,
  onToggle,
  countsLabel,
  extraBadges,
  collapsedLabel = "Schedule collapsed",
  onMarkInHomeComplete,
  onRemoveCompletedOverride,
  actionDisabled = false,
}: {
  title: string;
  subtitle?: string;
  rows: ScheduleRow[];
  isOpen: boolean;
  onToggle: () => void;
  countsLabel: string;
  extraBadges?: React.ReactNode;
  collapsedLabel?: string;
  onMarkInHomeComplete?: (row: ScheduleRow) => void;
  onRemoveCompletedOverride?: (row: ScheduleRow) => void;
  actionDisabled?: boolean;
}) {
  return (
    <section className="rounded-xl border border-[#d8c4aa] bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs font-semibold text-[#3c2719]">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{countsLabel}</Badge>
          {extraBadges}
          <button type="button" onClick={onToggle} className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-1 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]">
            {isOpen ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="max-h-[720px] overflow-auto rounded-xl border border-[#d8c4aa] bg-white">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#fffaf4] text-xs font-black uppercase tracking-wide text-[#7a4d20]">
              <tr>
                <th className="w-[150px] px-4 py-3">Week Of</th>
                <th className="w-[120px] px-4 py-3">Type</th>
                <th className="w-[260px] px-4 py-3">Property</th>
                <th className="w-[360px] px-4 py-3">Address</th>
                <th className="w-[170px] px-4 py-3">Route</th>
                <th className="w-[140px] px-4 py-3">Status</th>
                <th className="w-[260px] px-4 py-3">Notes / Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm font-bold text-[#3c2719]">No schedule rows found.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const inHome = isInHomeRow(row);
                  const completed = normalizeStatus(row.status) === "completed";

                  return (
                    <tr key={row.id || row.task_id} className="border-t border-[#eadbc8] align-top">
                      <td className="px-4 py-4 font-black">
                        <div>{dateLabel(row.scheduled_date)}</div>
                        <div className="mt-1 text-xs font-bold text-[#7a4d20]">{row.route_day || "Week group"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${inHome ? "bg-red-50 text-red-700" : "bg-[#fbf6ef] text-[#7a4d20]"}`}>
                          {row.report_type || "Report"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black">
                        <div>{row.property_name || row.property_id || "—"}</div>
                        {row.unit ? <div className="mt-1 text-xs font-bold text-[#3c2719]">{row.unit}</div> : null}
                      </td>
                      <td className="px-4 py-4 font-semibold">{shortAddress(row.report_address)}</td>
                      <td className="px-4 py-4 font-bold">
                        <div>{row.route_group || "—"}</div>
                        <div className="mt-1 text-xs text-[#7a4d20]">{row.assigned_to || "Unassigned"}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${completed ? "bg-green-50 text-green-700" : "bg-[#fbf6ef] text-[#7a4d20]"}`}>
                          {row.status || "Scheduled"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          {row.completion_notes ? (
                            <div className="whitespace-pre-wrap text-xs font-semibold leading-5 text-[#3c2719]">{row.completion_notes}</div>
                          ) : (
                            <div className="text-xs font-semibold leading-5 text-[#3c2719]">{row.field_scope || "—"}</div>
                          )}
                          {onMarkInHomeComplete && inHome && !completed ? (
                            <button
                              type="button"
                              disabled={actionDisabled}
                              onClick={() => onMarkInHomeComplete(row)}
                              className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-black text-green-800 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Mark In-Home Complete Today
                            </button>
                          ) : null}
                          {onRemoveCompletedOverride && completed && inHome ? (
                            <button
                              type="button"
                              disabled={actionDisabled}
                              onClick={() => onRemoveCompletedOverride(row)}
                              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-black text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Remove Duplicate Override
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#d8c4aa] bg-[#fffaf4] p-5 text-sm font-bold text-[#3c2719]">
          {collapsedLabel}. {rows.length} rows available.
        </div>
      )}
    </section>
  );
}
