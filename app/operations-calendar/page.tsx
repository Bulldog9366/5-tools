"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createClient } from "@supabase/supabase-js";

type CalendarItem = {
  id: string;
  title: string;
  notes: string;
  date: string;
  time: string;
  end_time?: string;
  category: string;
  priority: "Low" | "Normal" | "High";
  done: boolean;
  created_at?: string;
  updated_at?: string;
};

type ViewMode = "month" | "week";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORAGE_KEY = "five-tools-operations-calendar-v3";
const categories = [
  "General",
  "Work Order",
  "Service Ticket",
  "Estimate",
  "Project",
  "Call Back",
  "Owner Follow-Up",
  "Vendor",
  "Material Run",
  "Report",
  "Personal",
];

const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 20 * 60;
const HOUR_HEIGHT = 64;
const DAY_TOTAL_HEIGHT = ((DAY_END_MINUTES - DAY_START_MINUTES) / 60) * HOUR_HEIGHT;
const SNAP_MINUTES = 15;

function pad(num: number) {
  return String(num).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function monthTitle(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function weekRange(start: Date) {
  const end = addDays(start, 6);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function dayHeader(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function sortItems(a: CalendarItem, b: CalendarItem) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (!a.time && b.time) return 1;
  if (a.time && !b.time) return -1;
  return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
}

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapToGrid(value: number) {
  return Math.round(value / SNAP_MINUTES) * SNAP_MINUTES;
}

function formatTime(value?: string) {
  if (!value) return "";
  const [hourRaw, minuteRaw] = value.split(":").map(Number);
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  const hour = hourRaw % 12 || 12;
  return `${hour}:${pad(minuteRaw || 0)} ${suffix}`;
}

function getEndTime(item: CalendarItem) {
  if (item.end_time) return item.end_time;
  if (!item.time) return "";
  return minutesToTime(timeToMinutes(item.time) + 60);
}

function itemHasOverlap(item: CalendarItem, allItems: CalendarItem[]) {
  if (!item.time) return false;
  const start = timeToMinutes(item.time);
  const end = timeToMinutes(getEndTime(item));
  return allItems.some((other) => {
    if (other.id === item.id || !other.time) return false;
    const otherStart = timeToMinutes(other.time);
    const otherEnd = timeToMinutes(getEndTime(other));
    return start < otherEnd && end > otherStart;
  });
}

function layoutScheduleItems(items: CalendarItem[]) {
  const timedItems = items
    .filter((item) => item.time)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  return timedItems.map((item) => {
    const start = Math.max(timeToMinutes(item.time), DAY_START_MINUTES);
    const end = Math.min(timeToMinutes(getEndTime(item)), DAY_END_MINUTES);
    const overlaps = timedItems.filter((other) => {
      if (!other.time) return false;
      const otherStart = timeToMinutes(other.time);
      const otherEnd = timeToMinutes(getEndTime(other));
      return start < otherEnd && end > otherStart;
    });
    const overlapIndex = Math.max(0, overlaps.findIndex((other) => other.id === item.id));
    const overlapCount = Math.max(1, overlaps.length);
    const widthPercent = 100 / overlapCount;
    const leftPercent = overlapIndex * widthPercent;

    return {
      item,
      hasOverlap: overlapCount > 1,
      top: ((start - DAY_START_MINUTES) / 60) * HOUR_HEIGHT,
      height: Math.max(38, ((end - start) / 60) * HOUR_HEIGHT),
      leftPercent,
      widthPercent,
    };
  });
}

export default function OperationsCalendarPage() {
  const todayKey = toDateKey(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState("Loading...");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState("10:00");
  const [endTime, setEndTime] = useState("13:00");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState<CalendarItem["priority"]>("Normal");

  useEffect(() => {
    loadCalendarItems();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Browser storage may be unavailable. Cloud save still handles persistence.
    }
  }, [items]);

  async function loadCalendarItems() {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) setItems(JSON.parse(local));
    } catch {
      // Ignore local load errors.
    }

    const { data, error } = await supabase
      .from("calendar_items")
      .select("*")
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      setCloudStatus("Local backup active - cloud table not connected yet");
      return;
    }

    const cloudItems = ((data ?? []) as CalendarItem[]).map((item) => ({
      ...item,
      end_time: item.end_time || (item.time ? minutesToTime(timeToMinutes(item.time) + 60) : ""),
    }));

    setItems(cloudItems);
    setCloudStatus("Cloud saved");
  }

  async function saveItemToCloud(item: CalendarItem) {
    const payload = {
      id: item.id,
      title: item.title,
      notes: item.notes,
      date: item.date,
      time: item.time,
      end_time: item.end_time || item.time,
      category: item.category,
      priority: item.priority,
      done: item.done,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("calendar_items").upsert(payload, { onConflict: "id" });

    if (!error) {
      setCloudStatus("Cloud saved");
      return;
    }

    const fallbackPayload = { ...payload } as Omit<typeof payload, "end_time"> & { end_time?: string };
    delete fallbackPayload.end_time;
    const fallback = await supabase.from("calendar_items").upsert(fallbackPayload, { onConflict: "id" });
    setCloudStatus(fallback.error ? "Saved locally - cloud save failed" : "Cloud saved - run SQL to save end time");
  }

  async function deleteItemFromCloud(id: string) {
    const { error } = await supabase.from("calendar_items").delete().eq("id", id);
    setCloudStatus(error ? "Deleted locally - cloud delete failed" : "Cloud saved");
  }

  const monthDays = useMemo(() => {
    const start = startOfMonthGrid(anchorDate);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [anchorDate]);

  const currentWeekStart = useMemo(() => startOfWeek(parseDateKey(selectedDate)), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index)),
    [currentWeekStart]
  );

  const selectedDayItems = useMemo(
    () => items.filter((item) => item.date === selectedDate).sort(sortItems),
    [items, selectedDate]
  );

  const selectedDayScheduleItems = useMemo(() => layoutScheduleItems(selectedDayItems), [selectedDayItems]);

  const weekStats = useMemo(() => {
    const dates = new Set(weekDays.map(toDateKey));
    const weekItems = items.filter((item) => dates.has(item.date));
    const done = weekItems.filter((item) => item.done).length;
    const overlapCount = weekItems.filter((item) => itemHasOverlap(item, weekItems)).length;
    return {
      total: weekItems.length,
      open: weekItems.length - done,
      done,
      high: weekItems.filter((item) => item.priority === "High" && !item.done).length,
      overlaps: overlapCount,
    };
  }, [items, weekDays]);

  function itemsForDate(dateKey: string) {
    return items.filter((item) => item.date === dateKey).sort(sortItems);
  }

  function resetForm(nextDate = date) {
    setEditingId(null);
    setTitle("");
    setNotes("");
    setDate(nextDate);
    setTime("10:00");
    setEndTime("13:00");
    setCategory("General");
    setPriority("Normal");
  }

  async function addOrUpdateItem() {
    if (!title.trim()) return;

    const cleanStart = time || "10:00";
    const cleanEnd = endTime || minutesToTime(timeToMinutes(cleanStart) + 60);

    if (editingId) {
      let changed: CalendarItem | undefined;
      setItems((current) =>
        current.map((item) => {
          if (item.id !== editingId) return item;
          changed = {
            ...item,
            title: title.trim(),
            notes: notes.trim(),
            date,
            time: cleanStart,
            end_time: cleanEnd,
            category,
            priority,
          };
          return changed;
        })
      );
      setSelectedDate(date);
      setAnchorDate(parseDateKey(date));
      if (changed) await saveItemToCloud(changed);
      resetForm(date);
      return;
    }

    const item: CalendarItem = {
      id: makeId(),
      title: title.trim(),
      notes: notes.trim(),
      date,
      time: cleanStart,
      end_time: cleanEnd,
      category,
      priority,
      done: false,
    };

    setItems((current) => [...current, item]);
    setSelectedDate(date);
    setAnchorDate(parseDateKey(date));
    resetForm(date);
    await saveItemToCloud(item);
  }

  function startEdit(item: CalendarItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setNotes(item.notes || "");
    setDate(item.date);
    setTime(item.time || "10:00");
    setEndTime(getEndTime(item) || "13:00");
    setCategory(item.category || "General");
    setPriority(item.priority || "Normal");
    selectDay(item.date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function moveItem(itemId: string, newDate: string) {
    let changed: CalendarItem | undefined;
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        changed = { ...item, date: newDate };
        return changed;
      })
    );
    setSelectedDate(newDate);
    setDate(newDate);
    if (changed) await saveItemToCloud(changed);
  }


  async function resizeItemTime(itemId: string, edge: "start" | "end", rawMinutes: number) {
    let changed: CalendarItem | undefined;
    const snappedMinutes = clamp(snapToGrid(rawMinutes), DAY_START_MINUTES, DAY_END_MINUTES);

    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;

        const currentStart = timeToMinutes(item.time || "10:00");
        const currentEnd = timeToMinutes(getEndTime(item));

        if (edge === "start") {
          const nextStart = clamp(snappedMinutes, DAY_START_MINUTES, currentEnd - SNAP_MINUTES);
          changed = { ...item, time: minutesToTime(nextStart), end_time: minutesToTime(currentEnd) };
          return changed;
        }

        const nextEnd = clamp(snappedMinutes, currentStart + SNAP_MINUTES, DAY_END_MINUTES);
        changed = { ...item, end_time: minutesToTime(nextEnd) };
        return changed;
      })
    );

    if (changed) await saveItemToCloud(changed);
  }

  async function toggleDone(itemId: string) {
    let changed: CalendarItem | undefined;
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        changed = { ...item, done: !item.done };
        return changed;
      })
    );
    if (changed) await saveItemToCloud(changed);
  }

  async function deleteItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
    if (editingId === itemId) resetForm();
    await deleteItemFromCloud(itemId);
  }

  function selectDay(dateKey: string) {
    setSelectedDate(dateKey);
    setDate(dateKey);
    setAnchorDate(parseDateKey(dateKey));
  }

  function jumpToday() {
    const now = new Date();
    const key = toDateKey(now);
    setAnchorDate(now);
    setSelectedDate(key);
    setDate(key);
  }

  function shiftMonth(amount: number) {
    setAnchorDate((current) => addMonths(current, amount));
  }

  function shiftWeek(amount: number) {
    const next = addDays(currentWeekStart, amount * 7);
    setSelectedDate(toDateKey(next));
    setDate(toDateKey(next));
    setAnchorDate(next);
  }

  return (
    <main className="min-h-screen bg-[#efe8df] px-4 py-6 text-[#2f2a24] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1560px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-sm font-semibold text-[#8a650f] underline-offset-4 hover:underline">
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#2b241d]">5 Tools Operations Calendar</h1>
            <p className="mt-1 text-sm text-[#6f6255]">
              Monthly command view with draggable work blocks, weekly board, editable cards, and right-side time schedule.
            </p>
          </div>

          <div className="rounded-2xl border border-[#d9c8ad] bg-white/80 px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9a6c11]">Status</p>
            <p className="mt-1 text-sm font-bold text-[#2b241d]">{cloudStatus}</p>
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-5">
          <StatCard label="Open This Week" value={weekStats.open} />
          <StatCard label="Completed" value={weekStats.done} />
          <StatCard label="High Priority" value={weekStats.high} danger />
          <StatCard label="Overlaps" value={weekStats.overlaps} danger={weekStats.overlaps > 0} />
          <StatCard label="Total This Week" value={weekStats.total} />
        </section>

        <section className="mb-6 rounded-3xl border border-[#d9c8ad] bg-white/90 p-5 shadow-md">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-[#2b241d]">{editingId ? "Edit Work Block" : "Add Work Block"}</h2>
            {editingId && (
              <button type="button" onClick={() => resetForm()} className="rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-2 text-sm font-bold text-[#4a4036] hover:bg-white">
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <label className="block">
              <span className="text-sm font-semibold text-[#4a4036]">Task / Work Block</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Example: Schedule owner-approved dishwasher replacement"
                className="mt-2 w-full rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#9a6c11]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#4a4036]">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#9a6c11]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#4a4036]">Start Time</span>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#9a6c11]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#4a4036]">End Time</span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#9a6c11]"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={addOrUpdateItem}
                className="w-full rounded-xl bg-[#2b241d] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#3d3329]"
              >
                {editingId ? "Save Changes" : "Add Block"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
            <label className="block">
              <span className="text-sm font-semibold text-[#4a4036]">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#9a6c11]"
              >
                {categories.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#4a4036]">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as CalendarItem["priority"])}
                className="mt-2 w-full rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#9a6c11]"
              >
                <option>Low</option>
                <option>Normal</option>
                <option>High</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#4a4036]">Notes</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes, address, owner/vendor info, material list, etc."
                className="mt-2 w-full rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-3 text-sm outline-none focus:border-[#9a6c11]"
              />
            </label>
          </div>
        </section>

        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#d9c8ad] bg-white/80 p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setViewMode("month")} className={viewMode === "month" ? activeButton : inactiveButton}>
              Monthly View
            </button>
            <button onClick={() => setViewMode("week")} className={viewMode === "week" ? activeButton : inactiveButton}>
              Weekly View
            </button>
            <button onClick={jumpToday} className={inactiveButton}>
              Today
            </button>
          </div>

          {viewMode === "month" ? (
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className={smallButton}>← Previous Month</button>
              <div className="min-w-[190px] text-center text-lg font-bold text-[#2b241d]">{monthTitle(anchorDate)}</div>
              <button onClick={() => shiftMonth(1)} className={smallButton}>Next Month →</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => shiftWeek(-1)} className={smallButton}>← Previous Week</button>
              <div className="min-w-[210px] text-center text-lg font-bold text-[#2b241d]">{weekRange(currentWeekStart)}</div>
              <button onClick={() => shiftWeek(1)} className={smallButton}>Next Week →</button>
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div>
            {viewMode === "month" ? (
              <section className="rounded-3xl border border-[#d9c8ad] bg-white/90 p-4 shadow-md">
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#8a650f]">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-7">
                  {monthDays.map((day) => {
                    const key = toDateKey(day);
                    const dayItems = itemsForDate(key);
                    const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
                    const isSelected = key === selectedDate;
                    const hasOverlap = dayItems.some((item) => itemHasOverlap(item, dayItems));

                    return (
                      <div
                        key={key}
                        onClick={() => selectDay(key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const id = event.dataTransfer.getData("text/plain") || draggingId;
                          if (id) moveItem(id, key);
                          setDraggingId(null);
                        }}
                        className={`min-h-[138px] cursor-pointer rounded-2xl border p-3 transition ${isSelected ? "border-[#9a6c11] bg-[#fff7df]" : "border-[#e4d4bb] bg-[#fffaf3]"} ${isCurrentMonth ? "opacity-100" : "opacity-50"}`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-[#2b241d]">{day.getDate()}</span>
                          <div className="flex items-center gap-1">
                            {hasOverlap && <span className="rounded-full bg-[#b8322a] px-2 py-0.5 text-[10px] font-bold text-white">Overlap</span>}
                            {dayItems.length > 0 && <span className="rounded-full bg-[#2b241d] px-2 py-0.5 text-[10px] font-bold text-white">{dayItems.length}</span>}
                          </div>
                        </div>
                        <div className="space-y-1">
                          {dayItems.slice(0, 4).map((item) => (
                            <TaskBlock
                              key={item.id}
                              item={item}
                              compact
                              hasOverlap={itemHasOverlap(item, dayItems)}
                              onDragStart={setDraggingId}
                              onToggle={toggleDone}
                              onDelete={deleteItem}
                              onEdit={startEdit}
                            />
                          ))}
                          {dayItems.length > 4 && <p className="text-[11px] font-semibold text-[#8a650f]">+ {dayItems.length - 4} more</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="grid gap-3 lg:grid-cols-7">
                {weekDays.map((day) => {
                  const key = toDateKey(day);
                  const dayItems = itemsForDate(key);
                  return (
                    <div
                      key={key}
                      onClick={() => selectDay(key)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const id = event.dataTransfer.getData("text/plain") || draggingId;
                        if (id) moveItem(id, key);
                        setDraggingId(null);
                      }}
                      className={`min-h-[420px] rounded-3xl border p-4 shadow-sm ${key === selectedDate ? "border-[#9a6c11] bg-[#fff7df]" : "border-[#d9c8ad] bg-white/90"}`}
                    >
                      <div className="mb-3 border-b border-[#e2d2ba] pb-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6c11]">{dayHeader(day)}</p>
                        <p className="mt-1 text-sm text-[#76695c]">{dayItems.length} item{dayItems.length === 1 ? "" : "s"}</p>
                      </div>
                      <div className="space-y-2">
                        {dayItems.map((item) => (
                          <TaskBlock
                            key={item.id}
                            item={item}
                            hasOverlap={itemHasOverlap(item, dayItems)}
                            onDragStart={setDraggingId}
                            onToggle={toggleDone}
                            onDelete={deleteItem}
                            onEdit={startEdit}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            <section className="mt-6 rounded-3xl border border-[#d9c8ad] bg-white/90 p-5 shadow-md">
              <h2 className="text-xl font-bold text-[#2b241d]">Selected Day Detail</h2>
              <p className="mt-1 text-sm text-[#76695c]">{parseDateKey(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {selectedDayItems.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#d9c8ad] bg-[#fffaf3] p-4 text-sm text-[#76695c]">No work blocks scheduled for this day.</p>
                ) : (
                  selectedDayItems.map((item) => (
                    <TaskBlock
                      key={item.id}
                      item={item}
                      hasOverlap={itemHasOverlap(item, selectedDayItems)}
                      onDragStart={setDraggingId}
                      onToggle={toggleDone}
                      onDelete={deleteItem}
                      onEdit={startEdit}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          <ScheduleRail
            selectedDate={selectedDate}
            scheduledItems={selectedDayScheduleItems}
            onEdit={startEdit}
            onResize={resizeItemTime}
          />
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#d9c8ad] bg-white p-5 shadow-sm">
      <p className="text-sm text-[#76695c]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${danger ? "text-[#b8322a]" : "text-[#2b241d]"}`}>{value}</p>
    </div>
  );
}

function TaskBlock({ item, compact = false, hasOverlap = false, onDragStart, onToggle, onDelete, onEdit }: { item: CalendarItem; compact?: boolean; hasOverlap?: boolean; onDragStart: (id: string) => void; onToggle: (id: string) => void; onDelete: (id: string) => void; onEdit: (item: CalendarItem) => void; }) {
  return (
    <div
      draggable
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit(item);
      }}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        onDragStart(item.id);
      }}
      className={`rounded-xl border bg-white p-3 shadow-sm ${hasOverlap ? "border-[#b8322a] ring-2 ring-[#ffd8d3]" : "border-[#d8c6a8]"} ${item.done ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(item.id); }} className="mt-0.5 text-left text-sm font-bold text-[#2b241d]">
          {item.done ? "☑" : "□"} <span className={item.done ? "line-through" : ""}>{item.title}</span>
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(item); }} className="text-xs font-bold text-[#8a650f] hover:underline">
            Edit
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(item.id); }} className="text-xs font-bold text-[#9a2f24] hover:underline">
            Delete
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.time && <span className="rounded-full bg-[#efe8df] px-2 py-0.5 text-[10px] font-bold text-[#4a4036]">{formatTime(item.time)} - {formatTime(getEndTime(item))}</span>}
        <span className="rounded-full bg-[#efe8df] px-2 py-0.5 text-[10px] font-bold text-[#4a4036]">{item.category}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.priority === "High" ? "bg-[#ffe0dc] text-[#9a2f24]" : "bg-[#efe8df] text-[#4a4036]"}`}>{item.priority}</span>
        {hasOverlap && <span className="rounded-full bg-[#b8322a] px-2 py-0.5 text-[10px] font-bold text-white">Overlap</span>}
      </div>
      {!compact && item.notes && <p className="mt-2 text-xs leading-5 text-[#6f6255]">{item.notes}</p>}
      {compact && item.notes && <p className="mt-1 truncate text-[11px] text-[#6f6255]">{item.notes}</p>}
    </div>
  );
}

function ScheduleRail({ selectedDate, scheduledItems, onEdit, onResize }: { selectedDate: string; scheduledItems: ReturnType<typeof layoutScheduleItems>; onEdit: (item: CalendarItem) => void; onResize: (itemId: string, edge: "start" | "end", minutes: number) => void; }) {
  const hours = Array.from({ length: (DAY_END_MINUTES - DAY_START_MINUTES) / 60 + 1 }, (_, index) => DAY_START_MINUTES + index * 60);

  function startResize(event: ReactMouseEvent<HTMLDivElement>, item: CalendarItem, edge: "start" | "end") {
    event.preventDefault();
    event.stopPropagation();

    const grid = event.currentTarget.closest("[data-schedule-grid='true']") as HTMLDivElement | null;
    if (!grid) return;

    function getMinutesFromPointer(pointerEvent: MouseEvent) {
      const rect = grid.getBoundingClientRect();
      const y = clamp(pointerEvent.clientY - rect.top, 0, DAY_TOTAL_HEIGHT);
      return DAY_START_MINUTES + (y / HOUR_HEIGHT) * 60;
    }

    function handleMove(pointerEvent: MouseEvent) {
      onResize(item.id, edge, getMinutesFromPointer(pointerEvent));
    }

    function handleUp(pointerEvent: MouseEvent) {
      onResize(item.id, edge, getMinutesFromPointer(pointerEvent));
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = edge === "start" ? "n-resize" : "s-resize";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return (
    <aside className="sticky top-4 h-fit rounded-3xl border border-[#d9c8ad] bg-white/95 p-5 shadow-md">
      <div className="mb-4 border-b border-[#e2d2ba] pb-4">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9a6c11]">Schedule</p>
        <h2 className="mt-2 text-2xl font-bold text-[#2b241d]">Time Blocks</h2>
        <p className="mt-1 text-sm text-[#76695c]">
          {parseDateKey(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
        <p className="mt-2 text-xs font-semibold text-[#8a650f]">
          Drag the top or bottom edge of a block to adjust time in 15-minute steps.
        </p>
        {scheduledItems.some((entry) => entry.hasOverlap) && (
          <p className="mt-3 rounded-xl border border-[#f1afa7] bg-[#ffe0dc] px-3 py-2 text-xs font-bold text-[#9a2f24]">
            Schedule overlap detected. Overlapping blocks are shown side-by-side.
          </p>
        )}
      </div>

      <div data-schedule-grid="true" className="relative overflow-hidden rounded-2xl border border-[#e2d2ba] bg-[#fffaf3]" style={{ height: DAY_TOTAL_HEIGHT + 1 }}>
        {hours.map((minute, index) => (
          <div
            key={minute}
            className="absolute left-0 right-0 border-t border-dashed border-[#d6c6ad]"
            style={{ top: index * HOUR_HEIGHT }}
          >
            <span className="absolute left-2 -top-2 bg-[#fffaf3] pr-2 text-[11px] font-bold text-[#6f6255]">
              {formatTime(minutesToTime(minute))}
            </span>
          </div>
        ))}

        <div className="absolute left-[78px] right-2 top-0 bottom-0 border-l border-[#d6c6ad]" />

        {scheduledItems.map(({ item, top, height, leftPercent, widthPercent, hasOverlap }) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onEdit(item)}
            className={`absolute rounded-xl border px-2 py-2 text-left shadow-sm ${hasOverlap ? "border-[#b8322a] bg-[#ffe0dc]" : "border-[#d8c6a8] bg-white"}`}
            style={{
              top,
              height,
              left: `calc(84px + ${leftPercent}% * 0.72)`,
              width: `calc(${widthPercent}% * 0.72 - 4px)`,
              minWidth: hasOverlap ? 110 : 220,
            }}
          >
            <div
              title="Drag to change start time"
              onMouseDown={(event) => startResize(event, item, "start")}
              className="absolute left-2 right-2 top-0 h-3 cursor-n-resize rounded-t-xl border-t-4 border-[#8a650f]/70"
            />
            <p className="mt-1 truncate text-xs font-black text-[#2b241d]">{item.title}</p>
            <p className="mt-0.5 text-[10px] font-bold text-[#6f6255]">{formatTime(item.time)} - {formatTime(getEndTime(item))}</p>
            {hasOverlap && <p className="mt-0.5 text-[10px] font-black uppercase text-[#9a2f24]">Overlap</p>}
            <div
              title="Drag to change end time"
              onMouseDown={(event) => startResize(event, item, "end")}
              className="absolute bottom-0 left-2 right-2 h-3 cursor-s-resize rounded-b-xl border-b-4 border-[#8a650f]/70"
            />
          </div>
        ))}
      </div>
    </aside>
  );
}

const activeButton = "rounded-xl bg-[#2b241d] px-4 py-2 text-sm font-bold text-white shadow-sm";
const inactiveButton = "rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-4 py-2 text-sm font-bold text-[#4a4036] hover:bg-white";
const smallButton = "rounded-xl border border-[#d7c6aa] bg-[#fffaf3] px-3 py-2 text-xs font-bold text-[#4a4036] hover:bg-white";
