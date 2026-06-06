"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase";

const supabase = createClient();

const EMPLOYEE_TABLE = "time_clock_employees";
const TIME_TABLE = "operations_time_entries";
const SCHEDULER_TABLE = "project_scheduler";

type Employee = {
  id: string;
  employee_name: string;
  active: boolean;
  created_at?: string;
};

type SchedulerProject = {
  id: string;
  boardId: string;
  boardName: string;
  propertyAddress: string;
  unit: string;
  trade: string;
  vendor: string;
  requestedBy: string;
  description: string;
  dateRequested: string;
  dateScheduled: string;
  targetCompletion: string;
  status: string;
  priority: string;
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
  items_json: SchedulerProject[] | null;
  created_at: string;
  updated_at: string;
};

type TimeEntry = {
  id: string;
  job_id: string;
  job_type: "scheduler";
  employee_name: string;
  property_name?: string | null;
  property_address: string;
  work_description?: string | null;
  clock_in: string;
  clock_out?: string | null;
  break_minutes: number;
  total_hours: number;
  notes?: string | null;
  status: "Active" | "Completed";
  created_at?: string;
  // Legacy fallback only. New records use job_id.
  project_id?: string | null;
  project_title?: string | null;
};

type EditTimeEntry = {
  id: string;
  employee_name: string;
  job_id: string;
  job_type: "scheduler";
  property_address: string;
  work_description: string;
  clock_in: string;
  clock_out: string;
  break_minutes: number;
  notes: string;
  status: "Active" | "Completed";
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function calcHours(clockIn: string, clockOut: string | null, breakMinutes: number) {
  if (!clockIn || !clockOut) return 0;

  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  const rawHours = (end - start) / 1000 / 60 / 60;
  const breakHours = (Number(breakMinutes) || 0) / 60;

  return Math.max(0, rawHours - breakHours);
}

function formatHours(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export default function TimeClockEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");

  const [projects, setProjects] = useState<SchedulerProject[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const [employeeName, setEmployeeName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [notes, setNotes] = useState("");

  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditTimeEntry | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const selectedProjectEntries = useMemo(() => {
    if (!selectedProjectId) return [];
    return entries.filter((entry) => entry.job_id === selectedProjectId || entry.project_id === selectedProjectId);
  }, [entries, selectedProjectId]);

  const selectedProjectHours = useMemo(() => {
    return selectedProjectEntries.reduce(
      (sum, entry) => sum + Number(entry.total_hours || 0),
      0
    );
  }, [selectedProjectEntries]);

  useEffect(() => {
    loadAll();

    const savedActive = localStorage.getItem("5tools_active_time_entry");
    if (savedActive) {
      try {
        setActiveEntry(JSON.parse(savedActive));
      } catch {
        localStorage.removeItem("5tools_active_time_entry");
      }
    }
  }, []);

  useEffect(() => {
    if (!activeEntry && selectedProject?.assignedTo) {
      const assigned = selectedProject.assignedTo.trim();
      const employeeExists = employees.some(
        (employee) => employee.employee_name.toLowerCase() === assigned.toLowerCase()
      );

      if (employeeExists) {
        setEmployeeName(assigned);
      }
    }
  }, [selectedProject, employees, activeEntry]);

  async function loadAll() {
    setLoading(true);
    setStatusMessage("");

    await Promise.all([loadEmployees(), loadSchedulerProjects(), loadEntries()]);

    setLoading(false);
  }

  async function loadEmployees() {
    const { data, error } = await supabase
      .from(EMPLOYEE_TABLE)
      .select("*")
      .eq("active", true)
      .order("employee_name", { ascending: true });

    if (error) {
      setStatusMessage(`Employee load failed: ${error.message}`);
      return;
    }

    setEmployees((data || []) as Employee[]);
  }

  async function addEmployee() {
    const name = newEmployeeName.trim();

    if (!name) {
      setStatusMessage("Enter an employee name.");
      return;
    }

    const { error } = await supabase.from(EMPLOYEE_TABLE).insert({
      employee_name: name,
      active: true,
    });

    if (error) {
      setStatusMessage(`Add employee failed: ${error.message}`);
      return;
    }

    setNewEmployeeName("");
    setStatusMessage("Employee added.");
    await loadEmployees();
  }

  async function deleteEmployee(id: string, name: string) {
    const ok = window.confirm(`Remove ${name} from active employees?`);
    if (!ok) return;

    const { error } = await supabase
      .from(EMPLOYEE_TABLE)
      .update({ active: false })
      .eq("id", id);

    if (error) {
      setStatusMessage(`Delete employee failed: ${error.message}`);
      return;
    }

    if (employeeName === name) {
      setEmployeeName("");
    }

    setStatusMessage("Employee removed.");
    await loadEmployees();
  }

  async function loadSchedulerProjects() {
    const { data, error } = await supabase
      .from(SCHEDULER_TABLE)
      .select("id, board_name, items_json, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setStatusMessage(`Scheduler load failed: ${error.message}`);
      return;
    }

    const rows = (data || []) as CloudSchedulerRow[];

    const flattened: SchedulerProject[] = rows.flatMap((row) => {
      const items = Array.isArray(row.items_json) ? row.items_json : [];

      return items.map((item) => ({
        ...item,
        boardId: row.id,
        boardName: row.board_name || "Project Scheduler",
      }));
    });

    setProjects(flattened);
  }

  async function loadEntries() {
    const { data, error } = await supabase
      .from(TIME_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      setStatusMessage(`Time entry load failed: ${error.message}`);
      return;
    }

    setEntries((data || []) as TimeEntry[]);
  }

  async function clockIn() {
    if (activeEntry) {
      setStatusMessage("There is already an active clock-in on this device.");
      return;
    }

    if (!employeeName.trim()) {
      setStatusMessage("Select an employee before clocking in.");
      return;
    }

    if (!selectedProject) {
      setStatusMessage("Select a scheduled project before clocking in. Time entries must be tied to a real scheduler job.");
      return;
    }

    const { data: existingActive, error: existingError } = await supabase
      .from(TIME_TABLE)
      .select("*")
      .eq("employee_name", employeeName.trim())
      .eq("status", "Active")
      .limit(1);

    if (existingError) {
      setStatusMessage(`Active clock-in check failed: ${existingError.message}`);
      return;
    }

    if (existingActive && existingActive.length > 0) {
      const current = existingActive[0] as TimeEntry;
      setActiveEntry(current);
      localStorage.setItem("5tools_active_time_entry", JSON.stringify(current));
      setStatusMessage("This employee is already clocked into a job. Clock them out before starting another job.");
      return;
    }

    const now = new Date().toISOString();

    const payload = {
      job_id: selectedProject.id,
      job_type: "scheduler",
      employee_name: employeeName.trim(),
      property_name: selectedProject.propertyAddress || "",
      property_address: selectedProject.propertyAddress || "",
      work_description: selectedProject.description || selectedProject.trade || "",
      clock_in: now,
      clock_out: null,
      break_minutes: Number(breakMinutes) || 0,
      total_hours: 0,
      notes,
      status: "Active",
    };

    const { data, error } = await supabase
      .from(TIME_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setStatusMessage(`Clock in failed: ${error.message}`);
      return;
    }

    const entry = data as TimeEntry;

    setActiveEntry(entry);
    localStorage.setItem("5tools_active_time_entry", JSON.stringify(entry));
    setStatusMessage("Clocked in and auto-created a time entry from the selected scheduler job.");
    await loadEntries();
  }

  async function clockOut() {
    if (!activeEntry) {
      setStatusMessage("No active clock-in found.");
      return;
    }

    const { data: lockedEntry, error: lockError } = await supabase
      .from(TIME_TABLE)
      .select("*")
      .eq("id", activeEntry.id)
      .eq("job_id", activeEntry.job_id)
      .eq("employee_name", activeEntry.employee_name)
      .eq("status", "Active")
      .single();

    if (lockError || !lockedEntry) {
      setStatusMessage("Clock out blocked. No matching active job was found for this employee.");
      return;
    }

    const entryToClose = lockedEntry as TimeEntry;
    const now = new Date().toISOString();
    const total = calcHours(entryToClose.clock_in, now, Number(breakMinutes) || 0);

    const { error } = await supabase
      .from(TIME_TABLE)
      .update({
        clock_out: now,
        break_minutes: Number(breakMinutes) || 0,
        total_hours: total,
        notes,
        status: "Completed",
      })
      .eq("id", entryToClose.id)
      .eq("job_id", entryToClose.job_id)
      .eq("employee_name", entryToClose.employee_name)
      .eq("status", "Active");

    if (error) {
      setStatusMessage(`Clock out failed: ${error.message}`);
      return;
    }

    setActiveEntry(null);
    localStorage.removeItem("5tools_active_time_entry");
    setStatusMessage(`Clocked out of the same scheduler job. Total hours: ${formatHours(total)}.`);
    await loadEntries();
  }

  function startEditEntry(entry: TimeEntry) {
    setEditingEntry({
      id: entry.id,
      employee_name: entry.employee_name || "",
      job_id: entry.job_id || entry.project_id || "",
      job_type: "scheduler",
      property_address: entry.property_address || "",
      work_description: entry.work_description || "",
      clock_in: toDateTimeLocal(entry.clock_in),
      clock_out: toDateTimeLocal(entry.clock_out),
      break_minutes: Number(entry.break_minutes || 0),
      notes: entry.notes || "",
      status: entry.status || "Completed",
    });
  }

  function cancelEditEntry() {
    setEditingEntry(null);
  }

  function updateEditingEntry<K extends keyof EditTimeEntry>(field: K, value: EditTimeEntry[K]) {
    setEditingEntry((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function saveEditedEntry() {
    if (!editingEntry) return;

    if (!editingEntry.employee_name.trim()) {
      setStatusMessage("Employee name is required before saving correction.");
      return;
    }

    const clockInIso = fromDateTimeLocal(editingEntry.clock_in);
    const clockOutIso = fromDateTimeLocal(editingEntry.clock_out);

    if (!clockInIso) {
      setStatusMessage("Clock in date/time is required before saving correction.");
      return;
    }

    const nextStatus: "Active" | "Completed" = clockOutIso ? "Completed" : editingEntry.status;
    const total = clockOutIso
      ? calcHours(clockInIso, clockOutIso, Number(editingEntry.break_minutes) || 0)
      : 0;

    const { data, error } = await supabase
      .from(TIME_TABLE)
      .update({
        employee_name: editingEntry.employee_name.trim(),
        job_id: editingEntry.job_id,
        job_type: "scheduler",
        property_name: editingEntry.property_address.trim(),
        property_address: editingEntry.property_address.trim(),
        work_description: editingEntry.work_description,
        clock_in: clockInIso,
        clock_out: clockOutIso,
        break_minutes: Number(editingEntry.break_minutes) || 0,
        total_hours: total,
        notes: editingEntry.notes,
        status: nextStatus,
      })
      .eq("id", editingEntry.id)
      .select("*")
      .single();

    if (error) {
      setStatusMessage(`Time entry correction failed: ${error.message}`);
      return;
    }

    const updated = data as TimeEntry;

    if (activeEntry?.id === updated.id) {
      if (updated.status === "Active") {
        setActiveEntry(updated);
        localStorage.setItem("5tools_active_time_entry", JSON.stringify(updated));
      } else {
        setActiveEntry(null);
        localStorage.removeItem("5tools_active_time_entry");
      }
    }

    setEditingEntry(null);
    setStatusMessage("Time entry corrected and saved to cloud.");
    await loadEntries();
  }

  async function deleteTimeEntry(entry: TimeEntry) {
    const ok = window.confirm(
      `Delete time entry for ${entry.employee_name} at ${entry.property_address || "this project"}?`
    );
    if (!ok) return;

    const { error } = await supabase.from(TIME_TABLE).delete().eq("id", entry.id);

    if (error) {
      setStatusMessage(`Delete time entry failed: ${error.message}`);
      return;
    }

    if (activeEntry?.id === entry.id) {
      setActiveEntry(null);
      localStorage.removeItem("5tools_active_time_entry");
    }

    if (editingEntry?.id === entry.id) {
      setEditingEntry(null);
    }

    setStatusMessage("Time entry deleted from cloud.");
    await loadEntries();
  }

  function projectLabel(jobId?: string | null) {
    if (!jobId) return "No linked scheduler job";
    const project = projects.find((item) => item.id === jobId);
    if (!project) return jobId;
    return `${project.propertyAddress || "No address"}${project.trade ? ` - ${project.trade}` : ""}`;
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-4 py-6 text-[#111827]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-3xl border border-[#d8d2c4] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a6f22]">
                5Tools
              </p>
              <h1 className="mt-1 text-3xl font-bold">Time Clock Employees</h1>
              <p className="mt-2 max-w-3xl text-sm text-[#475569]">
                Employees clock in and out against live Project Scheduler items. Admin controls allow corrections and deletions without opening Supabase.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/project-scheduler"
                className="rounded-2xl border border-[#c9a227] bg-white px-5 py-3 text-sm font-semibold text-[#111827] shadow-sm transition hover:bg-[#fffdf7]"
              >
                Project Scheduler
              </Link>

              <Link
                href="/"
                className="rounded-2xl border border-[#c9a227] bg-[#111827] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2937]"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </header>

        {statusMessage ? (
          <div className="mb-6 rounded-2xl border border-[#d8d2c4] bg-white px-4 py-3 text-sm text-[#334155] shadow-sm">
            {statusMessage}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-[#d8d2c4] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Employees</h2>

              <div className="mt-4 flex gap-2">
                <input
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                  placeholder="Add employee"
                />

                <button
                  type="button"
                  onClick={addEmployee}
                  className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-bold text-white"
                >
                  Add
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {employees.length === 0 ? (
                  <div className="rounded-xl border border-[#d8d2c4] bg-[#f8fafc] p-3 text-sm text-[#64748b]">
                    No employees added.
                  </div>
                ) : (
                  employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#d8d2c4] bg-[#fffdf7] px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">{employee.employee_name}</span>

                      <button
                        type="button"
                        onClick={() => deleteEmployee(employee.id, employee.employee_name)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-[#d8d2c4] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Clock In / Out</h2>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold">Employee</span>
                  <select
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    disabled={!!activeEntry}
                    className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                  >
                    <option value="">Select employee...</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.employee_name}>
                        {employee.employee_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Scheduled Project</span>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={!!activeEntry}
                    className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                  >
                    <option value="">Select scheduler item...</option>
                    {projects.map((project) => (
                      <option key={`${project.boardId}-${project.id}`} value={project.id}>
                        {project.dateScheduled ? `${formatDate(project.dateScheduled)} - ` : ""}
                        {project.propertyAddress || "No address"}
                        {project.trade ? ` - ${project.trade}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedProject ? (
                  <div className="rounded-2xl border border-[#d8d2c4] bg-[#fffdf7] p-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold">{selectedProject.propertyAddress || "Scheduled Project"}</p>
                        <p className="text-[#475569]">
                          {selectedProject.trade || "No trade"} • Scheduled {formatDate(selectedProject.dateScheduled)}
                        </p>
                      </div>

                      <div className="rounded-full border border-[#d8d2c4] bg-white px-3 py-1 text-xs font-bold">
                        {selectedProject.status || "New"}
                      </div>
                    </div>

                    {selectedProject.description ? (
                      <p className="mt-3 whitespace-pre-wrap text-[#334155]">{selectedProject.description}</p>
                    ) : null}

                    <div className="mt-3 grid gap-2 text-xs text-[#475569] sm:grid-cols-2">
                      <div><span className="font-bold">Assigned:</span> {selectedProject.assignedTo || "-"}</div>
                      <div><span className="font-bold">Vendor:</span> {selectedProject.vendor || "-"}</div>
                      <div><span className="font-bold">Board:</span> {selectedProject.boardName}</div>
                      <div><span className="font-bold">Logged:</span> {formatHours(selectedProjectHours)} hrs</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#d8d2c4] bg-[#f8fafc] p-4 text-sm text-[#64748b]">
                    Select a scheduler item. These come from your Project Scheduler cloud record.
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-semibold">Break Minutes</span>
                  <input
                    type="number"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 min-h-24 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    placeholder="Work performed, access notes, issues found, etc."
                  />
                </label>

                {activeEntry ? (
                  <button
                    type="button"
                    onClick={clockOut}
                    className="w-full rounded-2xl bg-[#b91c1c] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#991b1b]"
                  >
                    Clock Out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={clockIn}
                    className="w-full rounded-2xl bg-[#111827] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1f2937]"
                  >
                    Clock In
                  </button>
                )}

                <button
                  type="button"
                  onClick={loadAll}
                  disabled={loading}
                  className="w-full rounded-2xl border border-[#c9a227] bg-white px-5 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#fffdf7] disabled:opacity-50"
                >
                  {loading ? "Refreshing..." : "Refresh Cloud Data"}
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-[#d8d2c4] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Current Status</h2>

              {activeEntry ? (
                <div className="mt-4 rounded-2xl border border-[#c9a227] bg-[#fffdf7] p-5 text-sm">
                  <p className="text-lg font-bold">Currently Clocked In</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div><span className="font-semibold">Employee:</span> {activeEntry.employee_name}</div>
                    <div><span className="font-semibold">Clock In:</span> {formatDateTime(activeEntry.clock_in)}</div>
                    <div className="sm:col-span-2"><span className="font-semibold">Property:</span> {activeEntry.property_address}</div>
                    <div className="sm:col-span-2"><span className="font-semibold">Scheduler Job:</span> {projectLabel(activeEntry.job_id || activeEntry.project_id)}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-[#d8d2c4] bg-[#f8fafc] p-5 text-sm text-[#475569]">
                  No active clock-in on this device.
                </div>
              )}
            </section>

            {editingEntry ? (
              <section className="rounded-3xl border border-[#c9a227] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Admin Correction</h2>
                    <p className="text-sm text-[#64748b]">Edit the bad time entry, then save to cloud.</p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelEditEntry}
                    className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:bg-[#f8fafc]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold">Employee Name</span>
                    <input
                      value={editingEntry.employee_name}
                      onChange={(e) => updateEditingEntry("employee_name", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">Linked Scheduler Project</span>
                    <select
                      value={editingEntry.job_id || ""}
                      onChange={(e) => {
                        const project = projects.find((item) => item.id === e.target.value);
                        updateEditingEntry("job_id", e.target.value || "");
                        if (project) {
                          updateEditingEntry("property_address", project.propertyAddress || "");
                          updateEditingEntry("work_description", project.description || "");
                        }
                      }}
                      className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    >
                      <option value="">Select scheduler job...</option>
                      {projects.map((project) => (
                        <option key={`${project.boardId}-${project.id}`} value={project.id}>
                          {project.propertyAddress || "No address"}{project.trade ? ` - ${project.trade}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">Property Address</span>
                    <input
                      value={editingEntry.property_address}
                      onChange={(e) => updateEditingEntry("property_address", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">Clock In</span>
                    <input
                      type="datetime-local"
                      value={editingEntry.clock_in}
                      onChange={(e) => updateEditingEntry("clock_in", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">Clock Out</span>
                    <input
                      type="datetime-local"
                      value={editingEntry.clock_out}
                      onChange={(e) => updateEditingEntry("clock_out", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">Break Minutes</span>
                    <input
                      type="number"
                      value={editingEntry.break_minutes}
                      onChange={(e) => updateEditingEntry("break_minutes", Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">Status</span>
                    <select
                      value={editingEntry.status}
                      onChange={(e) => updateEditingEntry("status", e.target.value as "Active" | "Completed")}
                      className="mt-1 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-sm font-semibold">Work Description</span>
                  <textarea
                    value={editingEntry.work_description}
                    onChange={(e) => updateEditingEntry("work_description", e.target.value)}
                    className="mt-1 min-h-20 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-sm font-semibold">Notes</span>
                  <textarea
                    value={editingEntry.notes}
                    onChange={(e) => updateEditingEntry("notes", e.target.value)}
                    className="mt-1 min-h-20 w-full rounded-xl border border-[#d8d2c4] bg-[#f8fafc] px-4 py-3 text-sm outline-none focus:border-[#c9a227]"
                  />
                </label>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={cancelEditEntry}
                    className="rounded-2xl border border-[#d8d2c4] bg-white px-5 py-3 text-sm font-bold text-[#111827] hover:bg-[#f8fafc]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEditedEntry}
                    className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white hover:bg-[#1f2937]"
                  >
                    Save Correction
                  </button>
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border border-[#d8d2c4] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Recent Time Entries</h2>
                  <p className="text-sm text-[#64748b]">Edit or delete bad entries here.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {entries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#d8d2c4] bg-[#f8fafc] p-6 text-center text-sm text-[#64748b]">
                    No time entries found.
                  </div>
                ) : (
                  entries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-[#d8d2c4] bg-[#f8fafc] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-bold">{entry.employee_name}</div>
                          <div className="text-sm text-[#475569]">{entry.property_address}</div>
                          <div className="mt-1 text-xs text-[#64748b]">{projectLabel(entry.job_id || entry.project_id)}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-[#d8d2c4] bg-white px-3 py-1 text-xs font-bold">
                            {entry.status}
                          </span>
                          <span className="rounded-full border border-[#d8d2c4] bg-white px-3 py-1 text-xs font-bold">
                            {formatHours(Number(entry.total_hours) || 0)} hrs
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-[#475569] sm:grid-cols-2">
                        <div><span className="font-bold">Clock In:</span> {formatDateTime(entry.clock_in)}</div>
                        <div><span className="font-bold">Clock Out:</span> {entry.clock_out ? formatDateTime(entry.clock_out) : "Active"}</div>
                        <div><span className="font-bold">Break:</span> {entry.break_minutes || 0} min</div>
                        <div><span className="font-bold">Scheduler Job:</span> {entry.job_id || entry.project_id || "-"}</div>
                      </div>

                      {entry.notes ? (
                        <div className="mt-3 rounded-xl border border-[#d8d2c4] bg-white p-3 text-xs text-[#475569]">
                          <span className="font-bold text-[#111827]">Notes:</span> {entry.notes}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => startEditEntry(entry)}
                          className="rounded-xl border border-[#c9a227] bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:bg-[#fffdf7]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTimeEntry(entry)}
                          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
