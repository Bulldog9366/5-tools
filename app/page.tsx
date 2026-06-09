"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FiveToolsShell from "../components/FiveToolsShell";

type TaskStatus = "Open" | "Done" | string;

type TaskItem = {
  id?: string | number;
  title?: string;
  notes?: string;
  category?: "5 Tools" | "Personal" | string;
  priority?: "Low" | "Normal" | "High" | "Urgent" | string;
  status?: TaskStatus;
  dueDate?: string;
  createdAt?: string;
};

const TASK_STORAGE_KEYS = [
  "fivetools_tasks",
  "five-tools-tasks-notes-v1",
  "fiveToolsTasksNotes",
  "tasksNotesItems",
];

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Tasks & Notes", href: "/tasks-notes" },
  { label: "Work Orders", href: "/work-order-engine" },
  { label: "Pricing Notebook", href: "/work-order-pricing" },
  { label: "Scheduler", href: "/project-scheduler" },
  { label: "Calendar", href: "/operations-calendar" },
  { label: "Automation", href: "/automation-center" },
  { label: "Secretary", href: "/5tools-secretary" },
  { label: "Projects", href: "/project-tracker" },
  { label: "Truck Inventory", href: "/truck-inventory" },
];

const tools = [
  {
    title: "Tasks & Notes",
    href: "/tasks-notes",
    description: "Personal and 5 Tools to-do list with notes, due dates, priority, and checkboxes.",
  },
  {
    title: "Automation Center",
    href: "/automation-center",
    description: "Build workflow rules that connect work orders, reports, tickets, and follow-ups.",
  },
  {
    title: "Operation Assistant",
    href: "/operation-assistant",
    description: "Daily operations board for active field items and management tasks.",
  },
  {
    title: "Virtual Secretary",
    href: "/5tools-secretary",
    description: "Call intake, reminders, owner follow-ups, vendor callbacks, and task handoff.",
  },
  {
    title: "Work Order Engine",
    href: "/work-order-engine",
    description: "Create, track, import, and route work orders through the 5 Tools workflow.",
  },
  {
    title: "Work Order Pricing",
    href: "/work-order-pricing",
    description: "Pricing notebook and estimate builder for repair scopes and service items.",
  },
  {
    title: "Service Ticket",
    href: "/service-ticket",
    description: "Field service ticket intake, dispatch information, and job closeout notes.",
  },
  {
    title: "Project Scheduler",
    href: "/project-scheduler",
    description: "Schedule visits, dispatch work, and coordinate upcoming field appointments.",
  },
  {
    title: "Operations Calendar",
    href: "/operations-calendar",
    description: "Monthly and weekly scheduling board with drag-and-drop work blocks, follow-ups, reports, vendor appointments, and material runs.",
  },
  {
    title: "Project Tracker",
    href: "/project-tracker",
    description: "Track active project progress, deadlines, punch items, and completion status.",
  },
  {
    title: "Reports",
    href: "/inspections",
    description: "Create field reports, photo reports, and property condition documentation.",
  },
  {
    title: "Time Clock Employees",
    href: "/time-clock-employees",
    description: "Employee clock-in, clock-out, and basic time tracking for field work.",
  },
  {
    title: "Truck Inventory",
    href: "/truck-inventory",
    description: "Track field materials, truck stock, supplies, and inventory needs.",
  },
  {
    title: "Admin Job Cost",
    href: "/admin-job-cost",
    description: "Administrative job costing and back-office cost review.",
  },
  {
    title: "Punch List",
    href: "/punch-list",
    description: "Manage punch items, completion notes, and remaining project tasks.",
  },
  {
    title: "Virtual Assistant",
    href: "/virtual-assistant",
    description: "Legacy assistant command center and local command history.",
  },
];

function normalizeDate(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readTasksFromLocalStorage(): TaskItem[] {
  if (typeof window === "undefined") return [];

  for (const key of TASK_STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as TaskItem[];

      if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
        return parsed.tasks as TaskItem[];
      }
    } catch {
      // Ignore malformed localStorage data and continue checking other known keys.
    }
  }

  return [];
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#d4a640]/45 bg-[#1d1008]/80 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d4a640]">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black text-[#fff5df]">{value}</p>
    </div>
  );
}

export default function FiveToolsDashboard() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  useEffect(() => {
    setTasks(readTasksFromLocalStorage());
    setTasksLoaded(true);
  }, []);

  const taskStats = useMemo(() => {
    const today = todayIso();
    const open = tasks.filter((task) => task.status !== "Done");
    const done = tasks.filter((task) => task.status === "Done");
    const dueToday = open.filter((task) => normalizeDate(task.dueDate) === today);
    const overdue = open.filter((task) => {
      const due = normalizeDate(task.dueDate);
      return Boolean(due && due < today);
    });

    return {
      open: open.length,
      done: done.length,
      dueToday: dueToday.length,
      overdue: overdue.length,
    };
  }, [tasks]);

  return (
    <FiveToolsShell
      title="5Tools"
      subtitle="Repair & Maintenance Workspace"
    >
      <section className="rounded-[2rem] border border-[#d4a640]/45 bg-[#1d1008]/88 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur">
        <div className="flex flex-wrap gap-3 border-b border-[#7c5725] pb-5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-[#7c5725] bg-[#120a05] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#fff5df] transition hover:border-[#d4a640] hover:bg-[#241509]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-7 pt-7 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[2rem] border border-[#d4a640]/50 bg-[#120a05]/78 p-8 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[#d4a640]">
              Command Dashboard
            </p>
            <h2 className="mt-4 max-w-3xl text-5xl font-black leading-tight text-[#fff5df]">
              Operations Dashboard
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#f1dfb8]">
              Manage work orders, pricing, scheduling, automation, repairs,
              task notes, field follow-ups, and maintenance operations from one
              centralized 5 Tools workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/work-order-engine"
                className="rounded-2xl border border-[#d4a640] bg-[#8a5a18] px-6 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-[#b98525]"
              >
                Open Work Orders
              </Link>
              <Link
                href="/tasks-notes"
                className="rounded-2xl border border-[#d4a640] bg-[#d4a640] px-6 py-4 text-sm font-black uppercase tracking-wide text-[#241509] shadow-lg transition hover:bg-[#f2c879]"
              >
                Tasks & Notes
              </Link>
              <Link
                href="/operations-calendar"
                className="rounded-2xl border border-[#d4a640] bg-[#3b2212] px-6 py-4 text-sm font-black uppercase tracking-wide text-[#fff5df] shadow-lg transition hover:bg-[#5a341a]"
              >
                Operations Calendar
              </Link>
              <Link
                href="/automation-center"
                className="rounded-2xl border border-[#d4a640] bg-[#241509] px-6 py-4 text-sm font-black uppercase tracking-wide text-[#fff5df] shadow-lg transition hover:bg-[#3b2212]"
              >
                Automation Center
              </Link>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-[#d4a640]/50 bg-[#120a05]/86 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
            <div className="flex items-end justify-between gap-4 border-b border-[#7c5725] pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-[#d4a640]">
                  Live Widget
                </p>
                <h3 className="mt-2 text-2xl font-black text-[#fff5df]">
                  Tasks & Notes
                </h3>
              </div>
              <Link
                href="/tasks-notes"
                className="text-sm font-black uppercase tracking-wide text-[#d4a640] hover:text-[#f2c879]"
              >
                Open →
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <StatBox label="Open" value={taskStats.open} />
              <StatBox label="Done" value={taskStats.done} />
              <StatBox label="Due Today" value={taskStats.dueToday} />
              <StatBox label="Overdue" value={taskStats.overdue} />
            </div>

            <p className="mt-5 rounded-2xl border border-[#7c5725] bg-[#1d1008]/80 p-4 text-sm font-bold leading-6 text-[#f1dfb8]">
              {tasksLoaded
                ? "Reading local Tasks & Notes data from this browser."
                : "Loading local task count..."}
            </p>

            <Link
              href="/operations-calendar"
              className="mt-5 block rounded-2xl border border-[#d4a640] bg-[#8a5a18] px-5 py-4 text-center text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-[#b98525]"
            >
              Open Operations Calendar →
            </Link>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-[2rem] border border-[#d4a640]/45 bg-[#1d1008]/88 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.42)] transition hover:-translate-y-1 hover:border-[#d4a640] hover:bg-[#241509]"
          >
            <div className="mb-5 h-1 w-12 rounded-full bg-[#d4a640] transition group-hover:w-20" />
            <h3 className="text-xl font-black text-[#fff5df]">
              {tool.title}
            </h3>
            <p className="mt-3 min-h-[72px] text-sm leading-7 text-[#d8c4a0]">
              {tool.description}
            </p>
            <p className="mt-5 text-sm font-black uppercase tracking-wide text-[#d4a640]">
              Open Page →
            </p>
          </Link>
        ))}
      </section>
    </FiveToolsShell>
  );
}
