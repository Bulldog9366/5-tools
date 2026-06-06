"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FiveToolsShell from "../../components/FiveToolsShell";

type TaskCategory = "5 Tools" | "Personal";
type TaskPriority = "Low" | "Normal" | "High" | "Urgent";
type TaskStatus = "Open" | "Done";
type TaskFilter = "All" | "Open" | "Done" | "5 Tools" | "Personal";

type TaskItem = {
  id: number;
  title: string;
  notes: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "five-tools-tasks-notes-v1";

const categoryOptions: TaskCategory[] = ["5 Tools", "Personal"];
const priorityOptions: TaskPriority[] = ["Low", "Normal", "High", "Urgent"];
const filterOptions: TaskFilter[] = ["All", "Open", "Done", "5 Tools", "Personal"];

function nowStamp() {
  return new Date().toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDisplayDate(value: string) {
  if (!value) return "No due date selected";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function priorityClass(priority: TaskPriority) {
  if (priority === "Urgent") return "border-[#8b2f1f] bg-[#5f1f14] text-[#fff1ed]";
  if (priority === "High") return "border-[#b88a35] bg-[#8a5a18] text-white";
  if (priority === "Low") return "border-[#7c5725] bg-[#3b2a18] text-[#d8c4a0]";
  return "border-[#d4a640] bg-[#d4a640] text-[#241509]";
}

function cleanTask(raw: unknown): TaskItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<TaskItem>;

  if (!item.title || typeof item.title !== "string") return null;

  return {
    id: typeof item.id === "number" ? item.id : Date.now(),
    title: item.title,
    notes: typeof item.notes === "string" ? item.notes : "",
    category: item.category === "Personal" ? "Personal" : "5 Tools",
    priority: priorityOptions.includes(item.priority as TaskPriority)
      ? (item.priority as TaskPriority)
      : "Normal",
    status: item.status === "Done" ? "Done" : "Open",
    dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : nowStamp(),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : nowStamp(),
  };
}

export default function TasksNotesPage() {
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<TaskCategory>("5 Tools");
  const [priority, setPriority] = useState<TaskPriority>("Normal");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("All");
  const [message, setMessage] = useState("Tasks & Notes ready.");

  useEffect(() => {
    setMounted(true);

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;

      const cleaned = parsed.map(cleanTask).filter(Boolean) as TaskItem[];
      setTasks(cleaned);
      setMessage(`Loaded ${cleaned.length} local task${cleaned.length === 1 ? "" : "s"}.`);
    } catch {
      setMessage("Local tasks could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      setMessage("Local auto-save failed.");
    }
  }, [mounted, tasks]);

  const openCount = useMemo(
    () => tasks.filter((task) => task.status === "Open").length,
    [tasks]
  );

  const doneCount = useMemo(
    () => tasks.filter((task) => task.status === "Done").length,
    [tasks]
  );

  const fiveToolsCount = useMemo(
    () => tasks.filter((task) => task.category === "5 Tools").length,
    [tasks]
  );

  const personalCount = useMemo(
    () => tasks.filter((task) => task.category === "Personal").length,
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    if (filter === "All") return tasks;
    if (filter === "Open" || filter === "Done") {
      return tasks.filter((task) => task.status === filter);
    }
    return tasks.filter((task) => task.category === filter);
  }, [filter, tasks]);

  function addTask() {
    const cleanTitle = title.trim();
    const cleanNotes = notes.trim();

    if (!cleanTitle) {
      setMessage("Task title is required.");
      return;
    }

    const stamp = nowStamp();
    const newTask: TaskItem = {
      id: Date.now(),
      title: cleanTitle,
      notes: cleanNotes,
      category,
      priority,
      status: "Open",
      dueDate,
      createdAt: stamp,
      updatedAt: stamp,
    };

    setTasks((current) => [newTask, ...current]);
    setTitle("");
    setNotes("");
    setCategory("5 Tools");
    setPriority("Normal");
    setDueDate("");
    setMessage(`Added task: ${cleanTitle}`);
  }

  function saveLocal() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      setMessage(`Saved ${tasks.length} task${tasks.length === 1 ? "" : "s"} locally.`);
    } catch {
      setMessage("Local save failed.");
    }
  }

  function loadLocal() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setMessage("No local tasks found.");
        return;
      }

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        setMessage("Local task data is not valid.");
        return;
      }

      const cleaned = parsed.map(cleanTask).filter(Boolean) as TaskItem[];
      setTasks(cleaned);
      setMessage(`Loaded ${cleaned.length} local task${cleaned.length === 1 ? "" : "s"}.`);
    } catch {
      setMessage("Local load failed.");
    }
  }

  function deleteLocal() {
    window.localStorage.removeItem(STORAGE_KEY);
    setTasks([]);
    setMessage("Deleted local Tasks & Notes data.");
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              status: task.status === "Open" ? "Done" : "Open",
              updatedAt: nowStamp(),
            }
          : task
      )
    );
  }

  function deleteTask(id: number) {
    setTasks((current) => current.filter((task) => task.id !== id));
    setMessage("Task deleted.");
  }

  function openCalendar() {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <FiveToolsShell title="Tasks & Notes">
      <main className="min-h-screen bg-[#120a05] px-6 py-8 text-[#fff5df]">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="rounded-3xl border border-[#b88a35]/70 bg-[#241509]/95 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-[#d4a640]">
                  5 Tools Workspace
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-[#fff5df] md:text-5xl">
                  Tasks & Notes
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#d8c4a0]">
                  Simple task board for 5 Tools work items, personal notes, reminders,
                  checkboxes, priorities, and due dates.
                </p>
              </div>

              <a
                href="/"
                className="rounded-2xl border border-[#d4a640] bg-[#8a5a18] px-5 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-[#b98525]"
              >
                Back to Dashboard
              </a>
            </div>
          </header>

          <section className="grid gap-5 md:grid-cols-4">
            <StatCard label="Open" value={openCount} />
            <StatCard label="Done" value={doneCount} />
            <StatCard label="5 Tools" value={fiveToolsCount} />
            <StatCard label="Personal" value={personalCount} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-[#b88a35]/70 bg-[#241509]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4a640]">
                  New Entry
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#fff5df]">
                  Add Task or Note
                </h2>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                    Task Title
                  </span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Example: Call vendor about Eatonville job"
                    className="rounded-2xl border border-[#7c5725] bg-[#120a05]/80 px-4 py-3 text-[#fff5df] outline-none transition placeholder:text-[#bfa77b] focus:border-[#d4a640]"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add details, contact info, job notes, personal note, or follow-up instructions."
                    className="min-h-32 rounded-2xl border border-[#7c5725] bg-[#120a05]/80 px-4 py-3 text-[#fff5df] outline-none transition placeholder:text-[#bfa77b] focus:border-[#d4a640]"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                      Category
                    </span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value as TaskCategory)}
                      className="rounded-2xl border border-[#7c5725] bg-[#120a05]/80 px-4 py-3 text-[#fff5df] outline-none transition focus:border-[#d4a640]"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                      Priority
                    </span>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value as TaskPriority)}
                      className="rounded-2xl border border-[#7c5725] bg-[#120a05]/80 px-4 py-3 text-[#fff5df] outline-none transition focus:border-[#d4a640]"
                    >
                      {priorityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                      Due Date
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={openCalendar}
                        className="flex-1 rounded-2xl border border-[#7c5725] bg-[#120a05]/80 px-4 py-3 text-left text-sm font-bold text-[#fff5df] transition hover:border-[#d4a640]"
                      >
                        {formatDisplayDate(dueDate)}
                      </button>
                      <button
                        type="button"
                        onClick={openCalendar}
                        className="rounded-2xl border border-[#d4a640] bg-[#8a5a18] px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-[#b98525]"
                        aria-label="Open date calendar"
                        title="Open date calendar"
                      >
                        📅
                      </button>
                      <input
                        ref={dateInputRef}
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        className="sr-only"
                        aria-label="Due date calendar selector"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDueDate(addDays(0))}
                    className="rounded-xl border border-[#7c5725] bg-[#120a05]/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#d8c4a0] transition hover:border-[#d4a640] hover:text-[#fff5df]"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDate(addDays(1))}
                    className="rounded-xl border border-[#7c5725] bg-[#120a05]/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#d8c4a0] transition hover:border-[#d4a640] hover:text-[#fff5df]"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDate(addDays(7))}
                    className="rounded-xl border border-[#7c5725] bg-[#120a05]/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#d8c4a0] transition hover:border-[#d4a640] hover:text-[#fff5df]"
                  >
                    Next Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueDate("")}
                    className="rounded-xl border border-[#7c5725] bg-[#120a05]/70 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#d8c4a0] transition hover:border-[#d4a640] hover:text-[#fff5df]"
                  >
                    Clear Date
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 pt-3">
                  <button
                    type="button"
                    onClick={addTask}
                    className="rounded-2xl border border-[#d4a640] bg-[#8a5a18] px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-[#b98525]"
                  >
                    Add Task
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle("");
                      setNotes("");
                      setCategory("5 Tools");
                      setPriority("Normal");
                      setDueDate("");
                      setMessage("Entry fields cleared.");
                    }}
                    className="rounded-2xl border border-[#8b6b3e] bg-[#3b2a18] px-6 py-3 text-sm font-black uppercase tracking-wide text-[#d8c4a0] transition hover:bg-[#50371f]"
                  >
                    Clear Entry
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-[#b88a35]/70 bg-[#241509]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4a640]">
                  Local Controls
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#fff5df]">
                  Save / Load
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#d8c4a0]">
                  Tasks auto-load on page open and auto-save after changes. Manual buttons are included for control.
                </p>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={saveLocal}
                    className="rounded-2xl border border-[#d4a640] bg-[#8a5a18] px-5 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-[#b98525]"
                  >
                    Save Local
                  </button>
                  <button
                    type="button"
                    onClick={loadLocal}
                    className="rounded-2xl border border-[#8b6b3e] bg-[#3b2a18] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#d8c4a0] transition hover:bg-[#50371f]"
                  >
                    Load Local
                  </button>
                  <button
                    type="button"
                    onClick={deleteLocal}
                    className="rounded-2xl border border-[#8b2f1f] bg-[#5f1f14] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#fff1ed] transition hover:bg-[#7b2b1d]"
                  >
                    Delete Local
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-[#7c5725] bg-[#120a05]/70 p-4 text-sm font-bold text-[#f3e4c4]">
                  {message}
                </div>
              </div>

              <div className="rounded-3xl border border-[#b88a35]/70 bg-[#241509]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4a640]">
                  Filters
                </p>
                <div className="mt-5 grid gap-3">
                  {filterOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFilter(option)}
                      className={`rounded-2xl border px-5 py-3 text-left text-sm font-black uppercase tracking-wide transition ${
                        filter === option
                          ? "border-[#d4a640] bg-[#d4a640] text-[#241509]"
                          : "border-[#7c5725] bg-[#120a05]/70 text-[#d8c4a0] hover:border-[#d4a640] hover:text-[#fff5df]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section className="rounded-3xl border border-[#b88a35]/70 bg-[#241509]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4a640]">
                  Task Board
                </p>
                <h2 className="mt-2 text-3xl font-black text-[#fff5df]">
                  Assistant Items
                </h2>
              </div>
              <p className="text-sm font-bold text-[#bfa77b]">
                Showing {filteredTasks.length} of {tasks.length}
              </p>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#7c5725] bg-[#120a05]/70 p-10 text-center text-sm font-bold text-[#bfa77b]">
                No tasks match this view.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredTasks.map((task) => (
                  <article
                    key={task.id}
                    className="rounded-3xl border border-[#7c5725] bg-[#120a05]/70 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-lg font-black transition ${
                            task.status === "Done"
                              ? "border-[#d4a640] bg-[#d4a640] text-[#241509]"
                              : "border-[#8b6b3e] bg-[#3b2a18] text-[#d8c4a0] hover:border-[#d4a640]"
                          }`}
                          aria-label={task.status === "Done" ? "Reopen task" : "Mark task done"}
                        >
                          {task.status === "Done" ? "✓" : ""}
                        </button>

                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-[#d4a640] bg-[#d4a640] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#241509]">
                              {task.category}
                            </span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${priorityClass(task.priority)}`}>
                              {task.priority}
                            </span>
                            <span className="rounded-full border border-[#7c5725] bg-[#3b2a18] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#d8c4a0]">
                              {task.status}
                            </span>
                          </div>

                          <h3 className={`mt-3 text-2xl font-black text-[#fff5df] ${task.status === "Done" ? "line-through opacity-60" : ""}`}>
                            {task.title}
                          </h3>

                          {task.notes ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#d8c4a0]">
                              {task.notes}
                            </p>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide text-[#bfa77b]">
                            <span>Due: {formatDisplayDate(task.dueDate)}</span>
                            <span>Created: {task.createdAt}</span>
                            <span>Updated: {task.updatedAt}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          className="rounded-2xl border border-[#8b6b3e] bg-[#3b2a18] px-4 py-3 text-sm font-black uppercase tracking-wide text-[#d8c4a0] transition hover:bg-[#50371f]"
                        >
                          {task.status === "Open" ? "Mark Done" : "Reopen"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          className="rounded-2xl border border-[#8b2f1f] bg-[#5f1f14] px-4 py-3 text-sm font-black uppercase tracking-wide text-[#fff1ed] transition hover:bg-[#7b2b1d]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </FiveToolsShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[#b88a35]/70 bg-[#241509]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4a640]">
        {label}
      </p>
      <p className="mt-3 text-4xl font-black text-[#fff5df]">{value}</p>
    </div>
  );
}
