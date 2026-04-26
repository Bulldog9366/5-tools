"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/* =========================
   BUILT-IN SUPABASE CLIENT
========================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

/* =========================
   TYPES
========================= */
type Priority = "Low" | "Medium" | "High" | "Critical";
type Status = "Open" | "In Progress" | "Done";

type PunchItem = {
  id: string;
  title: string;
  description: string;
  area: string;
  trade: string;
  label: string;
  priority: Priority;
  status: Status;
  dueDate: string;
  assignedTo: string;
  pinned: boolean;
  createdAt: string;
  completedAt?: string;
  photos: string[];
};

type CloudPunchListRow = {
  id: string;
  property_name: string | null;
  property_address: string | null;
  walk_date: string | null;
  walked_by: string | null;
  project_name: string | null;
  items_json: PunchItem[] | null;
  created_at: string;
  updated_at: string;
};

/* =========================
   CONFIG
========================= */
const STORAGE_KEY = "five-tools-punchlist";
const TABLE_NAME = "punch_lists";

const PRIORITY_OPTIONS: Priority[] = ["Low", "Medium", "High", "Critical"];
const STATUS_OPTIONS: Status[] = ["Open", "In Progress", "Done"];

const AREA_OPTIONS = [
  "",
  "Exterior",
  "Entry",
  "Living Room",
  "Kitchen",
  "Dining",
  "Hall",
  "Laundry",
  "Bathroom",
  "Primary Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Garage",
  "Yard",
  "Other",
];

const TRADE_OPTIONS = [
  "",
  "General",
  "Paint",
  "Drywall",
  "Flooring",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Cabinets",
  "Countertops",
  "Appliance",
  "Carpentry",
  "Windows",
  "Doors",
  "Cleaning",
  "Landscaping",
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

function prettyDate(date: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString();
}

function priorityClasses(priority: Priority) {
  switch (priority) {
    case "Critical":
      return "border-red-300 bg-red-50 text-red-800";
    case "High":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "Medium":
      return "border-sky-300 bg-sky-50 text-sky-800";
    case "Low":
    default:
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }
}

function cardAccent(priority: Priority) {
  switch (priority) {
    case "Critical":
      return "border-t-red-500";
    case "High":
      return "border-t-amber-500";
    case "Medium":
      return "border-t-sky-500";
    case "Low":
    default:
      return "border-t-emerald-500";
  }
}

function statusBadgeClasses(status: Status) {
  switch (status) {
    case "Done":
      return "bg-emerald-100 text-emerald-700";
    case "In Progress":
      return "bg-amber-100 text-amber-700";
    case "Open":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function emptyItem(): PunchItem {
  return {
    id: uid(),
    title: "",
    description: "",
    area: "",
    trade: "",
    label: "",
    priority: "Medium",
    status: "Open",
    dueDate: "",
    assignedTo: "",
    pinned: false,
    createdAt: new Date().toISOString(),
    photos: [],
  };
}

/* =========================
   PAGE
========================= */
export default function PunchListPage() {
  const [projectName, setProjectName] = useState("Remodel Punch List");
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [walkDate, setWalkDate] = useState(todayISO());
  const [walkedBy, setWalkedBy] = useState("");
  const [quickAdd, setQuickAdd] = useState("");
  const [items, setItems] = useState<PunchItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("All");
  const [filterTrade, setFilterTrade] = useState("All");
  const [filterLabel, setFilterLabel] = useState("All");
  const [filterStatus, setFilterStatus] = useState("Open");
  const [showDone, setShowDone] = useState(true);
  const [sortMode, setSortMode] = useState<"priority" | "created" | "due">("priority");

  const [statusMessage, setStatusMessage] = useState("");
  const [cloudRecords, setCloudRecords] = useState<CloudPunchListRow[]>([]);
  const [selectedCloudId, setSelectedCloudId] = useState("");
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);

  const loadedRef = useRef(false);

  /* =========================
     INITIAL LOAD
  ========================= */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        const starter: PunchItem[] = [
          {
            ...emptyItem(),
            title: "Touch up paint at kitchen wall",
            description: "South wall still shows roller shadow near window trim.",
            area: "Kitchen",
            trade: "Paint",
            label: "Final Walk",
            priority: "Medium",
            dueDate: todayISO(),
          },
          {
            ...emptyItem(),
            title: "Adjust primary bedroom door latch",
            description: "Door rubs at top right and does not latch cleanly.",
            area: "Primary Bedroom",
            trade: "Carpentry",
            label: "Doors",
            priority: "High",
          },
          {
            ...emptyItem(),
            title: "Verify GFCI at hall bath",
            description: "Reset/test and confirm outlet is functioning correctly.",
            area: "Bathroom",
            trade: "Electrical",
            label: "Electrical",
            priority: "Critical",
            pinned: true,
          },
        ];

        setItems(starter);
        setActiveItemId(starter[0]?.id ?? null);
        loadedRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw);
      setProjectName(parsed.projectName || "Remodel Punch List");
      setPropertyName(parsed.propertyName || "");
      setPropertyAddress(parsed.propertyAddress || "");
      setWalkDate(parsed.walkDate || todayISO());
      setWalkedBy(parsed.walkedBy || "");
      const savedItems = Array.isArray(parsed.items) ? parsed.items : [];
      setItems(savedItems);
      setActiveItemId(savedItems[0]?.id ?? null);
      loadedRef.current = true;
    } catch {
      loadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    refreshCloudRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     LOCAL AUTOSAVE
  ========================= */
  useEffect(() => {
    if (!loadedRef.current) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectName,
        propertyName,
        propertyAddress,
        walkDate,
        walkedBy,
        items,
      })
    );
  }, [projectName, propertyName, propertyAddress, walkDate, walkedBy, items]);

  /* =========================
     DERIVED DATA
  ========================= */
  const labels = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((i) => i.label.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      )
    );
  }, [items]);

  const trades = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((i) => i.trade.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      )
    );
  }, [items]);

  const areas = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((i) => i.area.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      )
    );
  }, [items]);

  const counts = useMemo(() => {
    const open = items.filter((i) => i.status === "Open").length;
    const inProgress = items.filter((i) => i.status === "In Progress").length;
    const done = items.filter((i) => i.status === "Done").length;
    const critical = items.filter((i) => i.priority === "Critical" && i.status !== "Done").length;

    return {
      open,
      inProgress,
      done,
      critical,
      total: items.length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    const priorityRank: Record<Priority, number> = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };

    const result = items.filter((item) => {
      if (!showDone && item.status === "Done") return false;
      if (filterStatus !== "All" && item.status !== filterStatus) return false;
      if (filterArea !== "All" && item.area !== filterArea) return false;
      if (filterTrade !== "All" && item.trade !== filterTrade) return false;
      if (filterLabel !== "All" && item.label !== filterLabel) return false;

      if (!q) return true;

      const haystack = [
        item.title,
        item.description,
        item.area,
        item.trade,
        item.label,
        item.assignedTo,
        item.priority,
        item.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.status === "Done" && b.status !== "Done") return 1;
      if (a.status !== "Done" && b.status === "Done") return -1;

      if (sortMode === "priority") {
        const priorityCompare = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityCompare !== 0) return priorityCompare;
      }

      if (sortMode === "due") {
        const aDue = a.dueDate || "9999-12-31";
        const bDue = b.dueDate || "9999-12-31";
        const dueCompare = aDue.localeCompare(bDue);
        if (dueCompare !== 0) return dueCompare;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [
    items,
    search,
    filterStatus,
    filterArea,
    filterTrade,
    filterLabel,
    showDone,
    sortMode,
  ]);

  const activeItem =
    items.find((item) => item.id === activeItemId) ??
    (items.length ? items[0] : null);

  /* =========================
     CLOUD ACTIONS
  ========================= */
  async function refreshCloudRecords() {
    setIsRefreshingCloud(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(
        "id, property_name, property_address, walk_date, walked_by, project_name, items_json, created_at, updated_at"
      )
      .order("updated_at", { ascending: false });

    if (error) {
      setStatusMessage(`Cloud refresh failed: ${error.message}`);
      setIsRefreshingCloud(false);
      return;
    }

    const rows = (data || []) as CloudPunchListRow[];
    setCloudRecords(rows);

    if (rows.length > 0 && !selectedCloudId) {
      setSelectedCloudId(rows[0].id);
    } else if (rows.length === 0) {
      setSelectedCloudId("");
    }

    setIsRefreshingCloud(false);
  }

  async function saveToCloud() {
    if (!propertyName.trim()) {
      setStatusMessage("Enter Property Name before cloud save.");
      return;
    }

    setIsSavingCloud(true);
    setStatusMessage("");

    const payload = {
      project_name: projectName || "Remodel Punch List",
      property_name: propertyName || "",
      property_address: propertyAddress || "",
      walk_date: walkDate || null,
      walked_by: walkedBy || "",
      items_json: items,
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
    setStatusMessage("Punch list saved to cloud.");
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
      .select(
        "id, property_name, property_address, walk_date, walked_by, project_name, items_json, created_at, updated_at"
      )
      .eq("id", selectedCloudId)
      .single();

    if (error) {
      setStatusMessage(`Cloud load failed: ${error.message}`);
      setIsLoadingCloud(false);
      return;
    }

    const row = data as CloudPunchListRow;

    setProjectName(row.project_name || "Remodel Punch List");
    setPropertyName(row.property_name || "");
    setPropertyAddress(row.property_address || "");
    setWalkDate(row.walk_date || todayISO());
    setWalkedBy(row.walked_by || "");
    const nextItems = Array.isArray(row.items_json) ? row.items_json : [];
    setItems(nextItems);
    setActiveItemId(nextItems[0]?.id ?? null);

    setStatusMessage("Cloud punch list loaded.");
    setIsLoadingCloud(false);
  }

  async function deleteCloudRecord() {
    if (!selectedCloudId) {
      setStatusMessage("Select a cloud record to delete.");
      return;
    }

    const ok = window.confirm("Delete the selected cloud punch list record?");
    if (!ok) return;

    setIsDeletingCloud(true);
    setStatusMessage("");

    const deletingId = selectedCloudId;

    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", deletingId);

    if (error) {
      setStatusMessage(`Cloud delete failed: ${error.message}`);
      setIsDeletingCloud(false);
      return;
    }

    const nextRecords = cloudRecords.filter((r) => r.id !== deletingId);
    setCloudRecords(nextRecords);
    setSelectedCloudId(nextRecords[0]?.id || "");
    setStatusMessage("Cloud punch list deleted.");
    setIsDeletingCloud(false);
  }

  function createNewCloudRecord() {
    setSelectedCloudId("");
    setStatusMessage("Ready to save as a new cloud punch list record.");
  }

  /* =========================
     ITEM ACTIONS
  ========================= */
  function setItemValue<K extends keyof PunchItem>(id: string, key: K, value: PunchItem[K]) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const next = { ...item, [key]: value };

        if (key === "status") {
          if (value === "Done") {
            next.completedAt = new Date().toISOString();
          } else {
            delete next.completedAt;
          }
        }

        return next;
      })
    );
  }

  function addQuickItem() {
    const text = quickAdd.trim();
    if (!text) return;

    const newItem: PunchItem = {
      ...emptyItem(),
      title: text,
      label: "Final Walk",
      priority: "Medium",
      status: "Open",
    };

    setItems((prev) => [newItem, ...prev]);
    setActiveItemId(newItem.id);
    setQuickAdd("");
  }

  function addBlankItem() {
    const newItem = {
      ...emptyItem(),
      label: "Final Walk",
    };
    setItems((prev) => [newItem, ...prev]);
    setActiveItemId(newItem.id);
  }

  function duplicateItem(id: string) {
    const source = items.find((item) => item.id === id);
    if (!source) return;

    const copy: PunchItem = {
      ...source,
      id: uid(),
      title: source.title ? `${source.title} (copy)` : "New Punch Item",
      status: "Open",
      completedAt: undefined,
      pinned: false,
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => [copy, ...prev]);
    setActiveItemId(copy.id);
  }

  function deleteItem(id: string) {
    const remaining = items.filter((item) => item.id !== id);
    setItems(remaining);

    if (activeItemId === id) {
      setActiveItemId(remaining[0]?.id ?? null);
    }
  }

  function clearAll() {
    const ok = window.confirm("Clear the full punch list for a fresh start?");
    if (!ok) return;

    setProjectName("Remodel Punch List");
    setPropertyName("");
    setPropertyAddress("");
    setWalkDate(todayISO());
    setWalkedBy("");
    setQuickAdd("");
    setSearch("");
    setFilterArea("All");
    setFilterTrade("All");
    setFilterLabel("All");
    setFilterStatus("Open");
    setShowDone(true);
    setItems([]);
    setActiveItemId(null);
    setStatusMessage("Local form cleared.");
    localStorage.removeItem(STORAGE_KEY);
  }

  function exportJson() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            projectName,
            propertyName,
            propertyAddress,
            walkDate,
            walkedBy,
            items,
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
    a.download = `${projectName || "punch-list"}-${walkDate || todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* =========================
     PHOTO ACTIONS
  ========================= */
  function handlePhotoUpload(id: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) return;

        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, photos: [...item.photos, result] }
              : item
          )
        );
      };
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  }

  function removePhoto(itemId: string, index: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              photos: item.photos.filter((_, i) => i !== index),
            }
          : item
      )
    );
  }

  /* =========================
     PRINT DATA
  ========================= */
  const printItems = [...items].sort((a, b) => {
    const areaCompare = (a.area || "ZZZ").localeCompare(b.area || "ZZZ");
    if (areaCompare !== 0) return areaCompare;
    if (a.status === "Done" && b.status !== "Done") return 1;
    if (a.status !== "Done" && b.status === "Done") return -1;
    return a.title.localeCompare(b.title);
  });

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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                5 Tools
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                5 Tools Punch List
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Property-based punch board with cloud save, card editor, photos, filters, and print report.
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
                onClick={addBlankItem}
                className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Add Card
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
              >
                Print Report
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Open
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.open}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                In Progress
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.inProgress}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Done
              </div>
              <div className="mt-1 text-3xl font-bold">{counts.done}</div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Critical Open
              </div>
              <div className="mt-1 text-3xl font-bold text-red-700">{counts.critical}</div>
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
              <h2 className="text-lg font-semibold text-slate-900">Project Info</h2>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Project Name
                  </label>
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Remodel Punch List"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Property Name
                  </label>
                  <input
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Example: Oak Street Remodel"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Property Address
                  </label>
                  <input
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="123 Main St Tacoma, WA"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Walk Date
                    </label>
                    <input
                      type="date"
                      value={walkDate}
                      onChange={(e) => setWalkDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Walked By
                    </label>
                    <input
                      value={walkedBy}
                      onChange={(e) => setWalkedBy(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Inspector / PM"
                    />
                  </div>
                </div>
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="">New record / no selection</option>
                    {cloudRecords.map((record) => (
                      <option key={record.id} value={record.id}>
                        {(record.property_name || "Unnamed Property")} — {(record.walk_date || "No Date")}
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Save records by property, then load the correct punch list later without depending only on browser local storage.
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Quick Add</h2>
              <p className="mt-1 text-sm text-slate-600">
                Just type the issue and hit Enter. Fill in the details after.
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addQuickItem();
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Add issue… example: touch up paint at kitchen soffit"
                />
                <button
                  type="button"
                  onClick={addQuickItem}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Filters</h2>

              <div className="mt-4 space-y-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Search notes, area, trade, label, assigned..."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="All">All Status</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterArea}
                    onChange={(e) => setFilterArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="All">All Areas</option>
                    {areas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterTrade}
                    onChange={(e) => setFilterTrade(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="All">All Trades</option>
                    {trades.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterLabel}
                    onChange={(e) => setFilterLabel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="All">All Labels</option>
                    {labels.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={showDone}
                      onChange={(e) => setShowDone(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Show completed
                  </label>

                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as "priority" | "created" | "due")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="priority">Sort by priority</option>
                    <option value="created">Sort by newest</option>
                    <option value="due">Sort by due date</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Actions</h2>

              <div className="mt-4 grid gap-2">
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
                  Clear Full Punch List
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Punch Board</h2>
                  <p className="text-sm text-slate-600">
                    {filteredItems.length} visible card{filteredItems.length === 1 ? "" : "s"} • {counts.total} total
                  </p>
                </div>
              </div>

              <div className="mt-5 columns-1 gap-4 sm:columns-2 2xl:columns-3">
                {filteredItems.length === 0 ? (
                  <div className="break-inside-avoid rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No punch items match the current filters.
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className={`mb-4 break-inside-avoid rounded-3xl border border-slate-200 border-t-4 bg-white p-4 shadow-sm transition ${
                        cardAccent(item.priority)
                      } ${activeItemId === item.id ? "ring-2 ring-slate-300" : ""} ${
                        item.status === "Done" ? "opacity-75" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setItemValue(item.id, "status", item.status === "Done" ? "Open" : "Done")
                          }
                          className={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-sm ${
                            item.status === "Done"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                          title={item.status === "Done" ? "Mark open" : "Mark done"}
                        >
                          ✓
                        </button>

                        <div
                          className="min-w-0 flex-1 cursor-pointer text-left"
                          onClick={() => setActiveItemId(item.id)}
                        >
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(
                                item.priority
                              )}`}
                            >
                              {item.priority}
                            </span>

                            {item.pinned && (
                              <span className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                                Pinned
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 text-base font-semibold text-slate-900">
                            {item.title || "Untitled punch item"}
                          </h3>

                          {item.description && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                              {item.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {item.area && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                {item.area}
                              </span>
                            )}

                            {item.trade && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                {item.trade}
                              </span>
                            )}

                            {item.label && (
                              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                                {item.label}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            {item.assignedTo && <div>Assigned: {item.assignedTo}</div>}
                            {item.dueDate && <div>Due: {prettyDate(item.dueDate)}</div>}
                            {item.photos.length > 0 && <div>{item.photos.length} photo(s)</div>}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => setItemValue(item.id, "pinned", !item.pinned)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            title="Pin note"
                          >
                            {item.pinned ? "Unpin" : "Pin"}
                          </button>

                          <button
                            type="button"
                            onClick={() => duplicateItem(item.id)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Copy
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {item.photos.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {item.photos.slice(0, 4).map((photo, index) => (
                            <div
                              key={index}
                              className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                            >
                              <img
                                src={photo}
                                alt={`Punch item photo ${index + 1}`}
                                className="h-28 w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Card Editor</h2>

              {!activeItem ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Select a card to edit its details.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Issue Title
                    </label>
                    <input
                      value={activeItem.title}
                      onChange={(e) => setItemValue(activeItem.id, "title", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Example: kitchen cabinet door out of alignment"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Description / Notes
                    </label>
                    <textarea
                      value={activeItem.description}
                      onChange={(e) => setItemValue(activeItem.id, "description", e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Add field notes, dimensions, finish details, correction scope, or verification notes..."
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Area</label>
                      <select
                        value={activeItem.area}
                        onChange={(e) => setItemValue(activeItem.id, "area", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      >
                        {AREA_OPTIONS.map((area) => (
                          <option key={area} value={area}>
                            {area || "Select area"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Trade</label>
                      <select
                        value={activeItem.trade}
                        onChange={(e) => setItemValue(activeItem.id, "trade", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
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
                        Priority
                      </label>
                      <select
                        value={activeItem.priority}
                        onChange={(e) => setItemValue(activeItem.id, "priority", e.target.value as Priority)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      >
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                      <select
                        value={activeItem.status}
                        onChange={(e) => setItemValue(activeItem.id, "status", e.target.value as Status)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Label</label>
                      <input
                        value={activeItem.label}
                        onChange={(e) => setItemValue(activeItem.id, "label", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                        placeholder="Final Walk / Electrical / Doors"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Assigned To
                      </label>
                      <input
                        value={activeItem.assignedTo}
                        onChange={(e) => setItemValue(activeItem.id, "assignedTo", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                        placeholder="Painter / Vendor / PM"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={activeItem.dueDate}
                        onChange={(e) => setItemValue(activeItem.id, "dueDate", e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Photos</h3>
                        <p className="text-xs text-slate-600">
                          Attach field photos to the punch card. Stored in browser local save and saved in cloud with the record.
                        </p>
                      </div>

                      <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                        Add Photos
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handlePhotoUpload(activeItem.id, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {activeItem.photos.length > 0 ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {activeItem.photos.map((photo, index) => (
                          <div
                            key={index}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          >
                            <img
                              src={photo}
                              alt={`Punch photo ${index + 1}`}
                              className="h-40 w-full object-cover"
                            />
                            <div className="p-2">
                              <button
                                type="button"
                                onClick={() => removePhoto(activeItem.id, index)}
                                className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                              >
                                Remove Photo
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                        No photos attached yet.
                      </div>
                    )}
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

          <h1 className="mt-2 text-3xl font-bold">
            {projectName || "Remodel Punch List"}
          </h1>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-semibold">Property Name:</span> {propertyName || "-"}
            </div>
            <div>
              <span className="font-semibold">Property:</span> {propertyAddress || "-"}
            </div>
            <div>
              <span className="font-semibold">Walk Date:</span> {prettyDate(walkDate) || "-"}
            </div>
            <div>
              <span className="font-semibold">Walked By:</span> {walkedBy || "-"}
            </div>
            <div>
              <span className="font-semibold">Total Items:</span> {items.length}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-300 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Open</div>
            <div className="mt-1 text-2xl font-bold">{counts.open}</div>
          </div>

          <div className="rounded-xl border border-slate-300 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">In Progress</div>
            <div className="mt-1 text-2xl font-bold">{counts.inProgress}</div>
          </div>

          <div className="rounded-xl border border-slate-300 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Done</div>
            <div className="mt-1 text-2xl font-bold">{counts.done}</div>
          </div>

          <div className="rounded-xl border border-slate-300 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Critical Open</div>
            <div className="mt-1 text-2xl font-bold">{counts.critical}</div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold">Punch Items</h2>

          <div className="mt-4 space-y-5">
            {printItems.length === 0 ? (
              <div className="rounded-xl border border-slate-300 p-4 text-sm text-slate-600">
                No punch items entered.
              </div>
            ) : (
              printItems.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-slate-300 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        Item {index + 1}
                      </div>
                      <h3 className="mt-1 text-lg font-semibold">
                        {item.title || "Untitled punch item"}
                      </h3>
                    </div>

                    <div className="text-right text-sm">
                      <div>
                        <span className="font-semibold">Status:</span> {item.status}
                      </div>
                      <div>
                        <span className="font-semibold">Priority:</span> {item.priority}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold">Area:</span> {item.area || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Trade:</span> {item.trade || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Label:</span> {item.label || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Assigned To:</span> {item.assignedTo || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Due Date:</span> {prettyDate(item.dueDate) || "-"}
                    </div>
                    <div>
                      <span className="font-semibold">Pinned:</span> {item.pinned ? "Yes" : "No"}
                    </div>
                  </div>

                  {item.description && (
                    <div className="mt-3">
                      <div className="text-sm font-semibold">Notes</div>
                      <div className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm">
                        {item.description}
                      </div>
                    </div>
                  )}

                  {item.photos.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold">Photos</div>
                      <div className="grid grid-cols-2 gap-3">
                        {item.photos.map((photo, photoIndex) => (
                          <div
                            key={photoIndex}
                            className="overflow-hidden rounded-xl border border-slate-300"
                          >
                            <img
                              src={photo}
                              alt={`Print punch photo ${photoIndex + 1}`}
                              className="h-56 w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="border-b border-slate-400 pb-2 font-semibold">
              Contractor / PM Sign-Off
            </div>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-2 font-semibold">
              Owner / Final Approval
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}