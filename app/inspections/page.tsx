
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase";
import { triggerEvent } from "../../lib/automationEngine";

const supabase = createClient();
const TABLE_NAME = "inspection_reports";
const PHOTO_BUCKET_NAME = "inspection-photos";

type PhotoType = "before" | "progress" | "after" | "issue";

type InspectionPhoto = {
  id: string;
  name: string;
  url: string;
  path?: string;
  caption: string;
  type: PhotoType;
  createdAt: string;
};

type AreaType =
  | "Exterior"
  | "Living Room"
  | "Kitchen"
  | "Bathroom"
  | "Bedroom"
  | "Garage"
  | "Laundry"
  | "Hallway"
  | "Mechanical"
  | "Custom";

type AreaWorkflowStatus = "Open" | "In Progress" | "Review Needed" | "Complete";

type ConditionRating = "Good" | "Fair" | "Monitor" | "Needs Attention" | "Failed / Unsafe" | "N/A";

type RecommendedAction =
  | "None"
  | "Monitor"
  | "Repair Recommended"
  | "Vendor Needed"
  | "Immediate Attention"
  | "Tenant Responsibility"
  | "Owner Approval Needed";

type ItemPriority = "Low" | "Medium" | "High" | "Immediate";

type WorkRequestSkill =
  | "General Maintenance"
  | "Plumbing"
  | "Electrical"
  | "HVAC"
  | "Appliance"
  | "Flooring"
  | "Drywall / Paint"
  | "Roofing / Exterior"
  | "Mold / Moisture"
  | "Safety / Life-Safety"
  | "Cleaning / Haul-Out"
  | "Pest Control"
  | "Locksmith / Door Hardware";

type WorkRequestHandoff = {
  id: string;
  source: "Property Condition Report";
  sourceReportId: string;
  createdAt: string;
  title: string;
  propertyName: string;
  propertyAddress: string;
  reportDate: string;
  preparedBy: string;
  areaId: string;
  areaName: string;
  areaType: AreaType;
  component: string;
  rating: ConditionRating;
  recommendedAction: RecommendedAction;
  priority: ItemPriority;
  skillCategory: WorkRequestSkill;
  description: string;
  notes: string;
  status: "Pending Review";
  photoRefs: Array<{
    id: string;
    name: string;
    caption: string;
    type: PhotoType;
    path?: string;
    url?: string;
  }>;
};

type AreaCheckItem = {
  id: string;
  category: string;
  rating: ConditionRating;
  action: RecommendedAction;
  priority: ItemPriority;
  workRequestSkill?: WorkRequestSkill;
  notes: string;
};

type InspectionArea = {
  id: string;
  name: string;
  areaType: AreaType;
  status: AreaWorkflowStatus;
  notes: string;
  checkItems: AreaCheckItem[];
  photos: InspectionPhoto[];
};

type SavedInspection = {
  id: string;
  propertyName: string;
  propertyAddress: string;
  inspectionDate: string;
  inspectorName: string;
  areas: InspectionArea[];
  createdAt: string;
  updatedAt: string;
};

type CloudInspectionRow = {
  id: string;
  property_name: string | null;
  property_address: string | null;
  report_date: string | null;
  prepared_by: string | null;
  areas_json: InspectionArea[] | null;
  created_at: string;
  updated_at: string;
};

type PhotoReviewTask = {
  id: string;
  inspection_schedule_id: string | null;
  property_name: string | null;
  unit: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  report_type: string | null;
  due_date: string | null;
  task_status: string | null;
  notes: string | null;
  created_at: string | null;
};


const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const AREA_TYPES: AreaType[] = [
  "Exterior",
  "Living Room",
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Garage",
  "Laundry",
  "Hallway",
  "Mechanical",
  "Custom",
];

const CONDITION_RATINGS: ConditionRating[] = [
  "Good",
  "Fair",
  "Monitor",
  "Needs Attention",
  "Failed / Unsafe",
  "N/A",
];

const RECOMMENDED_ACTIONS: RecommendedAction[] = [
  "None",
  "Monitor",
  "Repair Recommended",
  "Vendor Needed",
  "Immediate Attention",
  "Tenant Responsibility",
  "Owner Approval Needed",
];

const ITEM_PRIORITIES: ItemPriority[] = ["Low", "Medium", "High", "Immediate"];

const WORK_REQUEST_TRIGGER_ACTIONS: RecommendedAction[] = [
  "Repair Recommended",
  "Vendor Needed",
  "Immediate Attention",
];

const WORK_REQUEST_SKILLS: WorkRequestSkill[] = [
  "General Maintenance",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Flooring",
  "Drywall / Paint",
  "Roofing / Exterior",
  "Mold / Moisture",
  "Safety / Life-Safety",
  "Cleaning / Haul-Out",
  "Pest Control",
  "Locksmith / Door Hardware",
];

const WORK_REQUEST_HANDOFF_KEY = "fiveToolsPendingWorkRequests";

const CHECKLIST_TEMPLATES: Record<AreaType, string[]> = {
  Exterior: [
    "Entry Door / Locks",
    "Exterior Lighting",
    "Walkways / Trip Hazards",
    "Stairs / Railings",
    "Siding / Trim",
    "Windows / Screens",
    "Drainage / Water Intrusion",
    "Trash / Exterior Debris",
  ],
  "Living Room": [
    "Flooring",
    "Walls / Ceiling",
    "Windows / Locks",
    "Electrical Outlets / Covers",
    "Heat Source / Vents",
    "Smoke Detector",
    "Visible Moisture / Odor",
  ],
  Kitchen: [
    "Sink / Faucet",
    "Plumbing Under Sink",
    "GFCI / Electrical",
    "Cabinets / Drawers",
    "Countertops",
    "Flooring",
    "Appliances",
    "Ventilation / Range Hood",
    "Walls / Ceiling",
    "Visible Moisture / Mold Indicators",
  ],
  Bathroom: [
    "Toilet / Base Seal",
    "Sink / Faucet",
    "Plumbing Under Sink",
    "Tub / Shower",
    "Caulking / Grout",
    "Exhaust Fan",
    "GFCI / Electrical",
    "Flooring / Soft Spots",
    "Walls / Ceiling",
    "Visible Moisture / Mold Indicators",
  ],
  Bedroom: [
    "Flooring",
    "Walls / Ceiling",
    "Windows / Egress",
    "Door / Hardware",
    "Electrical Outlets / Covers",
    "Heat Source / Vents",
    "Smoke Detector",
    "Visible Moisture / Odor",
  ],
  Garage: [
    "Garage Door / Opener",
    "Fire Door / Separation",
    "Electrical / GFCI",
    "Floor / Trip Hazards",
    "Storage / Combustibles",
    "Water Heater Area",
    "Visible Leaks / Moisture",
  ],
  Laundry: [
    "Washer Hookups",
    "Dryer Vent / Exhaust",
    "Supply Lines",
    "Drain / Standpipe",
    "Electrical / GFCI",
    "Flooring",
    "Visible Moisture / Mold Indicators",
  ],
  Hallway: [
    "Flooring",
    "Walls / Ceiling",
    "Lighting",
    "Smoke / CO Detector",
    "Electrical Outlets / Covers",
    "Trip Hazards",
  ],
  Mechanical: [
    "HVAC / Heat Source",
    "Filter Condition",
    "Water Heater",
    "Electrical Panel Area",
    "Plumbing Visible Areas",
    "Combustible Storage",
    "Visible Leaks / Moisture",
  ],
  Custom: [
    "General Condition",
    "Safety Concern",
    "Maintenance Concern",
    "Visible Damage",
  ],
};

function isAreaType(value: unknown): value is AreaType {
  return typeof value === "string" && AREA_TYPES.includes(value as AreaType);
}

function inferAreaType(name: string): AreaType {
  const lower = name.toLowerCase();
  if (lower.includes("bath")) return "Bathroom";
  if (lower.includes("bed")) return "Bedroom";
  if (lower.includes("kitchen")) return "Kitchen";
  if (lower.includes("living")) return "Living Room";
  if (lower.includes("garage")) return "Garage";
  if (lower.includes("laundry")) return "Laundry";
  if (lower.includes("hall")) return "Hallway";
  if (lower.includes("mechanical") || lower.includes("utility")) return "Mechanical";
  if (lower.includes("exterior") || lower.includes("outside")) return "Exterior";
  return "Custom";
}

function buildCheckItems(areaType: AreaType): AreaCheckItem[] {
  return CHECKLIST_TEMPLATES[areaType].map((category) => ({
    id: makeId(),
    category,
    rating: "N/A",
    action: "None",
    priority: "Low",
    notes: "",
  }));
}

function normalizeWorkflowStatus(value: unknown): AreaWorkflowStatus {
  if (value === "In Progress" || value === "Review Needed" || value === "Complete") return value;
  if (value === "Needs Attention") return "Review Needed";
  return "Open";
}

function normalizeCheckItems(value: unknown, areaType: AreaType): AreaCheckItem[] {
  if (!Array.isArray(value)) return buildCheckItems(areaType);

  const normalized = value.map((item) => {
    const raw = item as Partial<AreaCheckItem>;
    const rating = CONDITION_RATINGS.includes(raw.rating as ConditionRating)
      ? (raw.rating as ConditionRating)
      : "N/A";
    const action = RECOMMENDED_ACTIONS.includes(raw.action as RecommendedAction)
      ? (raw.action as RecommendedAction)
      : "None";
    const priority = ITEM_PRIORITIES.includes(raw.priority as ItemPriority)
      ? (raw.priority as ItemPriority)
      : "Low";
    const workRequestSkill = WORK_REQUEST_SKILLS.includes(raw.workRequestSkill as WorkRequestSkill)
      ? (raw.workRequestSkill as WorkRequestSkill)
      : undefined;

    return {
      id: raw.id || makeId(),
      category: raw.category || "General Condition",
      rating,
      action,
      priority,
      workRequestSkill,
      notes: raw.notes || "",
    };
  });

  return normalized.length ? normalized : buildCheckItems(areaType);
}


function isWorkRequestTriggerAction(action: RecommendedAction) {
  return WORK_REQUEST_TRIGGER_ACTIONS.includes(action);
}

function suggestWorkRequestSkill(areaType: AreaType, component: string): WorkRequestSkill {
  const text = `${areaType} ${component}`.toLowerCase();

  if (text.includes("toilet") || text.includes("sink") || text.includes("faucet") || text.includes("plumbing") || text.includes("drain") || text.includes("supply line") || text.includes("water heater")) return "Plumbing";
  if (text.includes("gfci") || text.includes("electrical") || text.includes("outlet") || text.includes("wiring") || text.includes("panel") || text.includes("lighting")) return "Electrical";
  if (text.includes("hvac") || text.includes("heat") || text.includes("filter") || text.includes("vent") || text.includes("exhaust fan") || text.includes("range hood")) return "HVAC";
  if (text.includes("appliance") || text.includes("washer") || text.includes("dryer") || text.includes("range") || text.includes("dishwasher") || text.includes("fridge") || text.includes("refrigerator")) return "Appliance";
  if (text.includes("floor") || text.includes("carpet") || text.includes("lvp") || text.includes("soft spot")) return "Flooring";
  if (text.includes("wall") || text.includes("ceiling") || text.includes("paint") || text.includes("drywall")) return "Drywall / Paint";
  if (text.includes("roof") || text.includes("siding") || text.includes("gutter") || text.includes("exterior") || text.includes("drainage")) return "Roofing / Exterior";
  if (text.includes("mold") || text.includes("moisture") || text.includes("water intrusion") || text.includes("odor")) return "Mold / Moisture";
  if (text.includes("smoke") || text.includes("co detector") || text.includes("life") || text.includes("safety") || text.includes("combustible") || text.includes("trip hazard") || text.includes("railing")) return "Safety / Life-Safety";
  if (text.includes("trash") || text.includes("debris") || text.includes("clean")) return "Cleaning / Haul-Out";
  if (text.includes("pest")) return "Pest Control";
  if (text.includes("lock") || text.includes("door") || text.includes("hardware")) return "Locksmith / Door Hardware";

  return "General Maintenance";
}

function getStoredWorkRequestCount() {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORK_REQUEST_HANDOFF_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

const emptyInspection = (): SavedInspection => ({
  id: "",
  propertyName: "",
  propertyAddress: "",
  inspectionDate: "",
  inspectorName: "",
  areas: [],
  createdAt: "",
  updatedAt: "",
});

function normalizeAreas(value: unknown): InspectionArea[] {
  if (!Array.isArray(value)) return [];
  return value.map((area) => {
    const a = area as Partial<InspectionArea> & { status?: string; workflowStatus?: string };
    const areaType = isAreaType(a.areaType) ? a.areaType : inferAreaType(a.name || "");

    return {
      id: a.id || makeId(),
      name: a.name || areaType,
      areaType,
      status: normalizeWorkflowStatus(a.status || a.workflowStatus),
      notes: a.notes || "",
      checkItems: normalizeCheckItems(a.checkItems, areaType),
      photos: Array.isArray(a.photos)
        ? a.photos.map((photo) => {
            const p = photo as Partial<InspectionPhoto>;
            return {
              id: p.id || makeId(),
              name: p.name || "",
              url: p.url || "",
              path: typeof p.path === "string" ? p.path : undefined,
              caption: p.caption || "",
              type:
                p.type === "before" ||
                p.type === "after" ||
                p.type === "issue"
                  ? p.type
                  : "progress",
              createdAt: p.createdAt || new Date().toISOString(),
            };
          })
        : [],
    };
  });
}

function mapRowToInspection(row: CloudInspectionRow): SavedInspection {
  return {
    id: row.id,
    propertyName: row.property_name || "",
    propertyAddress: row.property_address || "",
    inspectionDate: row.report_date || "",
    inspectorName: row.prepared_by || "",
    areas: normalizeAreas(row.areas_json),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

export default function PhotoInspectionPage() {
  const [inspection, setInspection] = useState<SavedInspection>(emptyInspection());
  const [savedInspections, setSavedInspections] = useState<SavedInspection[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState("");
  const [scheduledTasks, setScheduledTasks] = useState<PhotoReviewTask[]>([]);
  const [selectedScheduledTaskId, setSelectedScheduledTaskId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [activeAreaId, setActiveAreaId] = useState("");
  const [lightboxPhotoId, setLightboxPhotoId] = useState("");

  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);
  const [isRefreshingScheduledTasks, setIsRefreshingScheduledTasks] = useState(false);
  const [isLoadingScheduledTask, setIsLoadingScheduledTask] = useState(false);
  const [isDeletingScheduledTask, setIsDeletingScheduledTask] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [pendingWorkRequestCount, setPendingWorkRequestCount] = useState(0);


  const fieldClass =
    "w-full min-h-12 rounded-lg border border-[#d8c4aa] bg-white px-3 py-3 text-[#111111] placeholder:text-[#9c8d7d] shadow-sm outline-none transition focus:border-[#a56a2a] focus:ring-2 focus:ring-[#f4e6d5]";

  const buttonPrimary =
    "min-h-12 rounded-lg border border-[#a56a2a] bg-[#8a541c] px-4 py-3 font-black text-white shadow-sm transition hover:bg-[#6f4526] disabled:cursor-not-allowed disabled:opacity-50";

  const buttonSecondary =
    "min-h-12 rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 font-black text-[#3c2719] shadow-sm transition hover:bg-[#fbf6ef] disabled:cursor-not-allowed disabled:opacity-50";

  const buttonDanger =
    "min-h-12 rounded-lg border border-red-300 bg-red-50 px-4 py-3 font-black text-red-700 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50";

  const card =
    "rounded-xl border border-[#e2cdb4] bg-white p-4 shadow-sm sm:p-5";

  const allTimelineItems = useMemo(() => {
    return inspection.areas
      .flatMap((area) =>
        area.photos.map((photo) => ({
          ...photo,
          areaName: area.name,
          areaId: area.id,
          areaStatus: area.status,
          areaNotes: area.notes,
        }))
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [inspection.areas]);

  const lightboxIndex = useMemo(() => {
    if (!lightboxPhotoId) return -1;
    return allTimelineItems.findIndex((item) => item.id === lightboxPhotoId);
  }, [allTimelineItems, lightboxPhotoId]);

  const lightboxPhoto = lightboxIndex >= 0 ? allTimelineItems[lightboxIndex] : null;

  const openLightbox = (photoId: string) => {
    setLightboxPhotoId(photoId);
  };

  const closeLightbox = () => {
    setLightboxPhotoId("");
  };

  const showPreviousPhoto = () => {
    if (!allTimelineItems.length || lightboxIndex < 0) return;
    const nextIndex = lightboxIndex === 0 ? allTimelineItems.length - 1 : lightboxIndex - 1;
    setLightboxPhotoId(allTimelineItems[nextIndex].id);
  };

  const showNextPhoto = () => {
    if (!allTimelineItems.length || lightboxIndex < 0) return;
    const nextIndex = lightboxIndex === allTimelineItems.length - 1 ? 0 : lightboxIndex + 1;
    setLightboxPhotoId(allTimelineItems[nextIndex].id);
  };

  const totalPhotos = useMemo(() => {
    return inspection.areas.reduce((sum, area) => sum + area.photos.length, 0);
  }, [inspection.areas]);

  const issuePhotos = useMemo(() => {
    return allTimelineItems.filter((item) => item.type === "issue").length;
  }, [allTimelineItems]);

  const completedAreas = useMemo(() => {
    return inspection.areas.filter((area) => area.status === "Complete").length;
  }, [inspection.areas]);

  const conditionIssueCount = useMemo(() => {
    return inspection.areas.reduce((sum, area) => {
      return (
        sum +
        area.checkItems.filter(
          (item) => item.rating === "Needs Attention" || item.rating === "Failed / Unsafe"
        ).length
      );
    }, 0);
  }, [inspection.areas]);

  const immediatePriorityCount = useMemo(() => {
    return inspection.areas.reduce((sum, area) => {
      return sum + area.checkItems.filter((item) => item.priority === "Immediate").length;
    }, 0);
  }, [inspection.areas]);

  const workRequestCandidateCount = useMemo(() => {
    return inspection.areas.reduce((sum, area) => {
      return sum + area.checkItems.filter((item) => isWorkRequestTriggerAction(item.action)).length;
    }, 0);
  }, [inspection.areas]);

  async function refreshCloudRecords() {
    setIsRefreshingCloud(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, property_name, property_address, report_date, prepared_by, areas_json, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      setStatusMessage(`Cloud refresh failed: ${error.message}`);
      setIsRefreshingCloud(false);
      return;
    }

    const rows = ((data as CloudInspectionRow[]) || [])
      .filter((row) => row && row.id)
      .map(mapRowToInspection);

    setSavedInspections(rows);

    if (rows.length > 0) {
      setSelectedInspectionId((currentId) => {
        if (currentId && rows.some((row) => row.id === currentId)) {
          return currentId;
        }
        return rows[0].id;
      });
    } else {
      setSelectedInspectionId("");
    }

    setStatusMessage(rows.length ? `Loaded ${rows.length} cloud report${rows.length === 1 ? "" : "s"}.` : "No cloud reports found.");
    setIsRefreshingCloud(false);
  }

  async function refreshScheduledTasks() {
    setIsRefreshingScheduledTasks(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from("photo_review_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatusMessage(`Scheduled task refresh failed: ${error.message}`);
      setIsRefreshingScheduledTasks(false);
      return;
    }

    const rows = ((data as PhotoReviewTask[]) || []).filter((task) => {
      const status = (task.task_status || "Open").toLowerCase();
      return status !== "completed" && status !== "cancelled" && status !== "closed";
    });

    setScheduledTasks(rows);

    if (rows.length > 0 && !selectedScheduledTaskId) {
      setSelectedScheduledTaskId(rows[0].id);
    } else if (rows.length === 0) {
      setSelectedScheduledTaskId("");
    }

    setStatusMessage(rows.length ? `Loaded ${rows.length} scheduled inspection task${rows.length === 1 ? "" : "s"}.` : "No scheduled inspection tasks found.");
    setIsRefreshingScheduledTasks(false);
  }

  async function loadScheduledTaskIntoReport() {
    if (!selectedScheduledTaskId) {
      setStatusMessage("Select a scheduled inspection task first.");
      return;
    }

    const task = scheduledTasks.find((item) => item.id === selectedScheduledTaskId);
    if (!task) {
      setStatusMessage("Selected scheduled task could not be found. Refresh the scheduled task list and try again.");
      return;
    }

    const hasCurrentWork =
      Boolean(inspection.propertyName || inspection.propertyAddress || inspection.inspectionDate || inspection.areas.length);

    if (hasCurrentWork) {
      const confirmed = window.confirm(
        "Load this scheduled report into the form? This will replace the current unsaved report fields and area list."
      );
      if (!confirmed) return;
    }

    setIsLoadingScheduledTask(true);
    setStatusMessage("");

    const addressParts = [task.address, task.city, task.state, task.zip].filter(Boolean);
    const reportAddress = addressParts.length > 1 ? addressParts.join(", ") : task.address || "";

    setInspection({
      ...emptyInspection(),
      propertyName: task.property_name || "",
      propertyAddress: reportAddress,
      inspectionDate: task.due_date || new Date().toISOString().slice(0, 10),
      inspectorName: inspection.inspectorName || "",
    });

    const { error } = await supabase
      .from("photo_review_tasks")
      .update({ task_status: "In Progress" })
      .eq("id", task.id);

    if (error) {
      setStatusMessage(`Scheduled report loaded, but task status update failed: ${error.message}`);
      setIsLoadingScheduledTask(false);
      return;
    }

    await refreshScheduledTasks();
    setStatusMessage("Scheduled inspection task loaded into report.");
    setIsLoadingScheduledTask(false);
  }


  async function deleteScheduledTask() {
    if (!selectedScheduledTaskId) {
      setStatusMessage("Select a scheduled inspection task first.");
      return;
    }

    const task = scheduledTasks.find((item) => item.id === selectedScheduledTaskId);
    const label = task?.property_name || "this scheduled task";
    const confirmed = window.confirm(`Delete ${label} from Photo Review? This only removes the pending Photo Review task; it does not delete the saved report schedule.`);
    if (!confirmed) return;

    setIsDeletingScheduledTask(true);
    setStatusMessage("");

    const { error } = await supabase
      .from("photo_review_tasks")
      .delete()
      .eq("id", selectedScheduledTaskId);

    if (error) {
      setStatusMessage(`Scheduled task delete failed: ${error.message}`);
      setIsDeletingScheduledTask(false);
      return;
    }

    setSelectedScheduledTaskId("");
    await refreshScheduledTasks();
    setStatusMessage("Scheduled Photo Review task deleted.");
    setIsDeletingScheduledTask(false);
  }

  useEffect(() => {
    if (!lightboxPhotoId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPreviousPhoto();
      if (event.key === "ArrowRight") showNextPhoto();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxPhotoId, lightboxIndex, allTimelineItems]);

  useEffect(() => {
    setPendingWorkRequestCount(getStoredWorkRequestCount());
  }, []);

  useEffect(() => {
    refreshCloudRecords();
    refreshScheduledTasks();
  }, []);

  function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
    const parts = dataUrl.split(",");
    const header = parts[0] || "";
    const base64 = parts[1] || "";
    const contentTypeMatch = header.match(/data:(.*?);base64/);
    const contentType = contentTypeMatch?.[1] || "image/jpeg";
    const byteCharacters = atob(base64);
    const byteNumbers = new Uint8Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    return {
      blob: new Blob([byteNumbers as BlobPart], { type: contentType }),
      contentType,
    };
  }

  async function compressPhotoDataUrl(
    dataUrl: string,
    maxDimension = 1600,
    quality = 0.72
  ): Promise<{ blob: Blob; contentType: string }> {
    return new Promise((resolve) => {
      const image = new Image();

      image.onload = () => {
        const originalWidth = image.width || maxDimension;
        const originalHeight = image.height || maxDimension;
        const scale = Math.min(1, maxDimension / Math.max(originalWidth, originalHeight));
        const width = Math.max(1, Math.round(originalWidth * scale));
        const height = Math.max(1, Math.round(originalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          resolve(dataUrlToBlob(dataUrl));
          return;
        }

        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(dataUrlToBlob(dataUrl));
              return;
            }

            resolve({
              blob,
              contentType: "image/jpeg",
            });
          },
          "image/jpeg",
          quality
        );
      };

      image.onerror = () => {
        resolve(dataUrlToBlob(dataUrl));
      };

      image.src = dataUrl;
    });
  }

  function extensionFromContentType(contentType: string, fallbackName: string) {
    const fileExtension = fallbackName.split(".").pop();
    if (fileExtension && fileExtension.length <= 5) {
      return fileExtension.toLowerCase();
    }

    if (contentType.includes("png")) return "png";
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("gif")) return "gif";
    return "jpg";
  }

  function cleanStorageSegment(value: string) {
    return (value || "report")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "report";
  }

  async function uploadPhotoToStorage(
    photo: InspectionPhoto,
    areaName: string,
    reportFolder: string
  ): Promise<InspectionPhoto> {
    const alreadyUploaded = Boolean(photo.path) && !photo.url.startsWith("data:");
    if (alreadyUploaded) return photo;

    if (!photo.url.startsWith("data:")) return photo;

    const { blob, contentType } = await compressPhotoDataUrl(photo.url);
    const extension = extensionFromContentType(contentType, photo.name);
    const safeArea = cleanStorageSegment(areaName || "area");
    const safePhotoName = cleanStorageSegment(photo.name || photo.id);
    const storagePath = `${reportFolder}/${safeArea}/${photo.id}-${safePhotoName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET_NAME)
      .upload(storagePath, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signedUrlData } = await supabase.storage
      .from(PHOTO_BUCKET_NAME)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    return {
      ...photo,
      url: signedUrlData?.signedUrl || photo.url,
      path: storagePath,
    };
  }

  async function uploadPendingPhotosToStorage(record: SavedInspection): Promise<SavedInspection> {
    const reportFolder =
      record.id ||
      cleanStorageSegment(record.propertyAddress || record.propertyName || makeId());

    const uploadedAreas = await Promise.all(
      record.areas.map(async (area) => {
        const uploadedPhotos = await Promise.all(
          area.photos.map((photo) => uploadPhotoToStorage(photo, area.name, reportFolder))
        );

        return {
          ...area,
          photos: uploadedPhotos,
        };
      })
    );

    return {
      ...record,
      areas: uploadedAreas,
    };
  }

  async function hydratePhotoDisplayUrls(record: SavedInspection): Promise<SavedInspection> {
    const hydratedAreas = await Promise.all(
      record.areas.map(async (area) => {
        const hydratedPhotos = await Promise.all(
          area.photos.map(async (photo) => {
            if (!photo.path) return photo;

            const { data, error } = await supabase.storage
              .from(PHOTO_BUCKET_NAME)
              .createSignedUrl(photo.path, 60 * 60 * 24 * 7);

            if (error || !data?.signedUrl) {
              return photo;
            }

            return {
              ...photo,
              url: data.signedUrl,
            };
          })
        );

        return {
          ...area,
          photos: hydratedPhotos,
        };
      })
    );

    return {
      ...record,
      areas: hydratedAreas,
    };
  }

  async function persistInspectionRecord(
    record: SavedInspection,
    successMessage = "Report saved to cloud."
  ): Promise<SavedInspection | null> {
    if (!record.propertyName.trim() && !record.propertyAddress.trim()) {
      setStatusMessage("Enter a property name or address before saving.");
      return null;
    }

    setIsSavingCloud(true);
    setStatusMessage("Uploading photos and saving report...");

    let uploadedRecord: SavedInspection;

    try {
      uploadedRecord = await uploadPendingPhotosToStorage(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photo upload failed.";
      setStatusMessage(`Cloud photo upload failed: ${message}`);
      setIsSavingCloud(false);
      return null;
    }

    const now = new Date().toISOString();
    const payload = {
      property_name: uploadedRecord.propertyName.trim(),
      property_address: uploadedRecord.propertyAddress.trim(),
      report_date: uploadedRecord.inspectionDate || null,
      prepared_by: uploadedRecord.inspectorName.trim(),
      areas_json: uploadedRecord.areas,
      updated_at: now,
    };

    if (uploadedRecord.id) {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", uploadedRecord.id);

      if (error) {
        setStatusMessage(`Cloud save failed: ${error.message}`);
        setIsSavingCloud(false);
        return null;
      }

      const savedInspection: SavedInspection = {
        ...uploadedRecord,
        updatedAt: now,
      };
      const nextInspection = await hydratePhotoDisplayUrls(savedInspection);
      setInspection(nextInspection);
      setSelectedInspectionId(nextInspection.id);
      await refreshCloudRecords();
      setStatusMessage(successMessage);
      setIsSavingCloud(false);
      return nextInspection;
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        ...payload,
        created_at: now,
      })
      .select("id, property_name, property_address, report_date, prepared_by, areas_json, created_at, updated_at")
      .single();

    if (error) {
      setStatusMessage(`Cloud save failed: ${error.message}`);
      setIsSavingCloud(false);
      return null;
    }

    const savedInspection = mapRowToInspection(data as CloudInspectionRow);
    const nextInspection = await hydratePhotoDisplayUrls(savedInspection);
    setInspection(nextInspection);
    setSelectedInspectionId(nextInspection.id);
    await refreshCloudRecords();
    setStatusMessage(successMessage);
    setIsSavingCloud(false);
    return nextInspection;
  }

  async function saveInspection() {
    await persistInspectionRecord(inspection);
  }

  async function loadInspection() {
    if (!selectedInspectionId) {
      setStatusMessage("Select a saved report first.");
      return;
    }

    setIsLoadingCloud(true);
    setStatusMessage("");

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, property_name, property_address, report_date, prepared_by, areas_json, created_at, updated_at")
      .eq("id", selectedInspectionId)
      .single();

    if (error) {
      setStatusMessage(`Cloud load failed: ${error.message}`);
      setIsLoadingCloud(false);
      return;
    }

    const loadedInspection = await hydratePhotoDisplayUrls(mapRowToInspection(data as CloudInspectionRow));
    setInspection(loadedInspection);
    setActiveAreaId(loadedInspection.areas[0]?.id || "");
    setStatusMessage("Cloud report loaded.");
    setIsLoadingCloud(false);
  }

  async function deleteInspection() {
    if (!inspection.id && !selectedInspectionId) {
      setStatusMessage("No saved report is currently selected.");
      return;
    }

    const deleteId = inspection.id || selectedInspectionId;
    const confirmed = window.confirm("Delete this saved cloud report?");
    if (!confirmed) return;

    setIsDeletingCloud(true);
    setStatusMessage("");

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", deleteId);

    if (error) {
      setStatusMessage(`Cloud delete failed: ${error.message}`);
      setIsDeletingCloud(false);
      return;
    }

    setInspection(emptyInspection());
    setSelectedInspectionId("");
    await refreshCloudRecords();
    setStatusMessage("Cloud report deleted.");
    setIsDeletingCloud(false);
  }

  const newInspection = () => {
    setInspection(emptyInspection());
    setSelectedInspectionId("");
    setNewAreaName("");
    setActiveAreaId("");
    setStatusMessage("Ready for a new report.");
  };

  const printReport = () => {
    window.print();
  };

  const LOCAL_REPORT_DB_NAME = "fiveToolsPhotoInspectionLocalDb";
  const LOCAL_REPORT_STORE_NAME = "drafts";
  const LOCAL_REPORT_KEY = "activeDraft";

  const openLocalReportDb = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }

      const request = window.indexedDB.open(LOCAL_REPORT_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(LOCAL_REPORT_STORE_NAME)) {
          db.createObjectStore(LOCAL_REPORT_STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local report database."));
    });

  const saveLocalReport = async () => {
    try {
      const db = await openLocalReportDb();

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(LOCAL_REPORT_STORE_NAME, "readwrite");
        const store = transaction.objectStore(LOCAL_REPORT_STORE_NAME);
        store.put(inspection, LOCAL_REPORT_KEY);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Local save transaction failed."));
        transaction.onabort = () => reject(transaction.error || new Error("Local save transaction was aborted."));
      });

      db.close();
      setStatusMessage("Report saved locally on this device.");
    } catch (error) {
      console.error(error);
      setStatusMessage("Local save failed. Photos may be too large for this browser/device storage.");
    }
  };

  const loadLocalReport = async () => {
    try {
      const db = await openLocalReportDb();

      const parsed = await new Promise<SavedInspection | null>((resolve, reject) => {
        const transaction = db.transaction(LOCAL_REPORT_STORE_NAME, "readonly");
        const store = transaction.objectStore(LOCAL_REPORT_STORE_NAME);
        const request = store.get(LOCAL_REPORT_KEY);

        request.onsuccess = () => resolve((request.result as SavedInspection) || null);
        request.onerror = () => reject(request.error || new Error("Local load failed."));
      });

      db.close();

      if (!parsed) {
        setStatusMessage("No local report found on this device.");
        return;
      }

      const loadedInspection: SavedInspection = {
        ...emptyInspection(),
        ...parsed,
        areas: normalizeAreas(parsed.areas),
      };

      setInspection(loadedInspection);
      setSelectedInspectionId(loadedInspection.id || "");
      setActiveAreaId(loadedInspection.areas[0]?.id || "");
      setStatusMessage("Local report loaded.");
    } catch (error) {
      console.error(error);
      setStatusMessage("Local load failed. The saved local report may be damaged.");
    }
  };

  const deleteLocalReport = async () => {
    const confirmed = window.confirm("Delete the locally saved report from this device?");
    if (!confirmed) return;

    try {
      const db = await openLocalReportDb();

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(LOCAL_REPORT_STORE_NAME, "readwrite");
        const store = transaction.objectStore(LOCAL_REPORT_STORE_NAME);
        store.delete(LOCAL_REPORT_KEY);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("Local delete transaction failed."));
        transaction.onabort = () => reject(transaction.error || new Error("Local delete transaction was aborted."));
      });

      db.close();
      setStatusMessage("Local report deleted from this device.");
    } catch (error) {
      console.error(error);
      setStatusMessage("Local delete failed.");
    }
  };

  const updateHeaderField = (
    field: keyof Pick<
      SavedInspection,
      "propertyName" | "propertyAddress" | "inspectionDate" | "inspectorName"
    >,
    value: string
  ) => {
    setInspection((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getNextAreaLabel = (areaType: AreaType) => {
    const existingCount = inspection.areas.filter((area) => area.areaType === areaType).length;

    if (areaType === "Bedroom") return `Bedroom ${existingCount + 1}`;
    if (areaType === "Bathroom") return `Bathroom ${existingCount + 1}`;

    if (existingCount === 0) return areaType;
    return `${areaType} ${existingCount + 1}`;
  };

  const createArea = (name: string, areaType: AreaType) => {
    const cleanName = name.trim();

    const exists = inspection.areas.some(
      (area) => area.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      setStatusMessage(`${cleanName} already exists. Use a unique room label such as Bedroom 2, Hall Bath, or Primary Bath.`);
      return;
    }

    const newArea: InspectionArea = {
      id: makeId(),
      name: cleanName,
      areaType,
      status: "Open",
      notes: "",
      checkItems: buildCheckItems(areaType),
      photos: [],
    };

    setInspection((prev) => ({
      ...prev,
      areas: [...prev.areas, newArea],
    }));

    setActiveAreaId(newArea.id);
    setNewAreaName("");
    setStatusMessage(`${cleanName} added with ${areaType} checklist.`);
  };

  const addArea = () => {
    if (!newAreaName.trim()) {
      setStatusMessage("Enter an area name first. Example: Bedroom 1, Primary Bath, Hallway, or Utility Room.");
      return;
    }

    const areaType = inferAreaType(newAreaName);
    createArea(newAreaName, areaType);
  };

  const addPresetArea = (areaType: AreaType) => {
    createArea(getNextAreaLabel(areaType), areaType);
  };

  const updateArea = (areaId: string, updates: Partial<InspectionArea>) => {
    setInspection((prev) => ({
      ...prev,
      areas: prev.areas.map((area) =>
        area.id === areaId ? { ...area, ...updates } : area
      ),
    }));
  };

  const updateCheckItem = (
    areaId: string,
    itemId: string,
    updates: Partial<AreaCheckItem>
  ) => {
    setInspection((prev) => ({
      ...prev,
      areas: prev.areas.map((area) =>
        area.id === areaId
          ? {
              ...area,
              checkItems: area.checkItems.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
              ),
            }
          : area
      ),
    }));
  };

  const resetAreaChecklist = (areaId: string) => {
    const area = inspection.areas.find((item) => item.id === areaId);
    if (!area) return;

    const confirmed = window.confirm(`Reset checklist for ${area.name}? This will replace current checklist ratings and notes.`);
    if (!confirmed) return;

    updateArea(areaId, { checkItems: buildCheckItems(area.areaType) });
    setStatusMessage(`${area.name} checklist reset.`);
  };


  const buildWorkRequestFromItem = (
    area: InspectionArea,
    item: AreaCheckItem
  ): WorkRequestHandoff => {
    const skillCategory = item.workRequestSkill || suggestWorkRequestSkill(area.areaType, item.category);
    const title = `${area.name} — ${item.category} — ${item.rating}`;
    const descriptionParts = [
      `Source: Property Condition Report`,
      inspection.propertyName ? `Property: ${inspection.propertyName}` : "",
      inspection.propertyAddress ? `Address: ${inspection.propertyAddress}` : "",
      inspection.inspectionDate ? `Report Date: ${inspection.inspectionDate}` : "",
      `Area: ${area.name}`,
      `Component/System: ${item.category}`,
      `Condition Rating: ${item.rating}`,
      `Recommended Action: ${item.action}`,
      `Priority: ${item.priority}`,
      `Skill/Vendor Category: ${skillCategory}`,
      item.notes ? `Notes: ${item.notes}` : "Notes: No item notes entered.",
    ].filter(Boolean);

    return {
      id: makeId(),
      source: "Property Condition Report",
      sourceReportId: inspection.id || "unsaved-report",
      createdAt: new Date().toISOString(),
      title,
      propertyName: inspection.propertyName,
      propertyAddress: inspection.propertyAddress,
      reportDate: inspection.inspectionDate,
      preparedBy: inspection.inspectorName,
      areaId: area.id,
      areaName: area.name,
      areaType: area.areaType,
      component: item.category,
      rating: item.rating,
      recommendedAction: item.action,
      priority: item.priority,
      skillCategory,
      description: descriptionParts.join("\n"),
      notes: item.notes,
      status: "Pending Review",
      photoRefs: area.photos
        .filter((photo) => photo.type === "issue")
        .map((photo) => ({
          id: photo.id,
          name: photo.name,
          caption: photo.caption,
          type: photo.type,
          path: photo.path,
          url: photo.url && !photo.url.startsWith("data:") ? photo.url : undefined,
        })),
    };
  };

  const saveWorkRequestHandoff = (request: WorkRequestHandoff) => {
    if (typeof window === "undefined") return false;

    try {
      const existingRaw = window.localStorage.getItem(WORK_REQUEST_HANDOFF_KEY) || "[]";
      const existing = JSON.parse(existingRaw);
      const queue: WorkRequestHandoff[] = Array.isArray(existing) ? existing : [];
      const alreadyExists = queue.some(
        (queued) =>
          queued.sourceReportId === request.sourceReportId &&
          queued.areaId === request.areaId &&
          queued.component === request.component &&
          queued.recommendedAction === request.recommendedAction
      );

      const nextQueue = alreadyExists ? queue : [request, ...queue];
      window.localStorage.setItem(WORK_REQUEST_HANDOFF_KEY, JSON.stringify(nextQueue));
      setPendingWorkRequestCount(nextQueue.length);
      return !alreadyExists;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const runReportItemFlaggedAutomation = (
    area: InspectionArea,
    item: AreaCheckItem,
    request: WorkRequestHandoff
  ) => {
    const automationResults = triggerEvent({
      trigger: "report-item-flagged",
      payload: {
        id: request.id,
        title: request.title,
        property: inspection.propertyName || inspection.propertyAddress || "Unassigned Property",
        propertyName: inspection.propertyName,
        propertyAddress: inspection.propertyAddress,
        reportDate: inspection.inspectionDate,
        preparedBy: inspection.inspectorName,
        areaId: area.id,
        areaName: area.name,
        areaType: area.areaType,
        component: item.category,
        rating: item.rating,
        action: item.action,
        recommendedAction: item.action,
        priority: item.priority,
        skillCategory: request.skillCategory,
        description: request.description,
        notes: item.notes,
        photos: request.photoRefs.map((photo) => photo.path || photo.url || photo.name).filter(Boolean),
        sourceModule: "reports",
        createdAt: new Date().toISOString(),
      },
    });

    return automationResults.filter((result) => result.conditionMatched).length;
  };

  const createWorkRequestFromItem = (area: InspectionArea, item: AreaCheckItem) => {
    if (!isWorkRequestTriggerAction(item.action)) {
      setStatusMessage("Only Repair Recommended, Vendor Needed, or Immediate Attention items can create work requests.");
      return;
    }

    const request = buildWorkRequestFromItem(area, item);
    const saved = saveWorkRequestHandoff(request);

    if (!saved) {
      setStatusMessage("This issue already has a pending work request handoff on this device.");
      return;
    }

    const matchedAutomationCount = runReportItemFlaggedAutomation(area, item, request);

    setStatusMessage(
      `Work request queued for review: ${request.title}. Automation Engine ran ${matchedAutomationCount} matching flow${matchedAutomationCount === 1 ? "" : "s"}. Open Work Orders to finish vendor routing.`
    );
  };

  const createAllFlaggedWorkRequests = () => {
    let created = 0;
    let skipped = 0;
    let automationsRun = 0;

    inspection.areas.forEach((area) => {
      area.checkItems
        .filter((item) => isWorkRequestTriggerAction(item.action))
        .forEach((item) => {
          const request = buildWorkRequestFromItem(area, item);
          const saved = saveWorkRequestHandoff(request);

          if (saved) {
            created += 1;
            automationsRun += runReportItemFlaggedAutomation(area, item, request);
          } else {
            skipped += 1;
          }
        });
    });

    if (created === 0 && skipped === 0) {
      setStatusMessage("No flagged repair/vendor/immediate items found for work request handoff.");
      return;
    }

    setStatusMessage(
      `Queued ${created} work request${created === 1 ? "" : "s"} for review${skipped ? `; ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}. Automation Engine ran ${automationsRun} matching flow${automationsRun === 1 ? "" : "s"}.`
    );
  };

  const openWorkOrders = () => {
    if (typeof window !== "undefined") {
      window.open("/work-order-engine", "_blank", "noopener,noreferrer");
    }
  };

  const deleteArea = (areaId: string) => {
    setInspection((prev) => ({
      ...prev,
      areas: prev.areas.filter((area) => area.id !== areaId),
    }));
    if (activeAreaId === areaId) {
      setActiveAreaId("");
    }
    setStatusMessage("Area removed.");
  };

  const addPhotosToArea = async (areaId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    const readFileAsDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    try {
      const createdPhotos = await Promise.all(
        fileArray.map(async (file) => {
          const url = await readFileAsDataUrl(file);
          const photo: InspectionPhoto = {
            id: makeId(),
            name: file.name,
            url,
            caption: "",
            type: "progress",
            createdAt: new Date().toISOString(),
          };
          return photo;
        })
      );

      const nextInspection: SavedInspection = {
        ...inspection,
        areas: inspection.areas.map((area) =>
          area.id === areaId
            ? {
                ...area,
                status: area.status === "Open" ? "In Progress" : area.status,
                photos: [...createdPhotos, ...area.photos],
              }
            : area
        ),
      };

      setInspection(nextInspection);
      setActiveAreaId(areaId);

      const photoText = `${createdPhotos.length} photo${createdPhotos.length === 1 ? "" : "s"}`;
      setStatusMessage(`${photoText} added to this report. Use Save Local for a device draft or Save Cloud to upload photos to Supabase Storage.`);
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not read selected photo files.");
    }
  };

  const updatePhoto = (
    areaId: string,
    photoId: string,
    updates: Partial<InspectionPhoto>
  ) => {
    setInspection((prev) => ({
      ...prev,
      areas: prev.areas.map((area) =>
        area.id === areaId
          ? {
              ...area,
              photos: area.photos.map((photo) =>
                photo.id === photoId ? { ...photo, ...updates } : photo
              ),
            }
          : area
      ),
    }));
  };

  const deletePhoto = (areaId: string, photoId: string) => {
    setInspection((prev) => ({
      ...prev,
      areas: prev.areas.map((area) =>
        area.id === areaId
          ? {
              ...area,
              photos: area.photos.filter((photo) => photo.id !== photoId),
            }
          : area
      ),
    }));
    setStatusMessage("Photo removed.");
  };

  return (
    <>
      <style jsx global>{`
        @page {
          size: auto;
          margin: 0.5in;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .no-print {
            display: none !important;
          }

          .print-report {
            display: block !important;
          }

          .print-page-break {
            page-break-before: always;
          }

          .print-avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-shell {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-card {
            border: 1px solid #d1d5db !important;
            border-radius: 14px !important;
            background: #ffffff !important;
          }

          .print-muted {
            color: #6b7280 !important;
          }

          .print-label {
            font-size: 10px !important;
            font-weight: 700 !important;
            letter-spacing: 0.08em !important;
            text-transform: uppercase !important;
            color: #6b7280 !important;
          }

          .print-value {
            font-size: 14px !important;
            font-weight: 600 !important;
            color: #111827 !important;
          }

          .print-summary-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px !important;
          }

          .print-photo-grid {
            display: grid !important;
            grid-template-columns: 1fr;
            gap: 24px !important;
          }

          .print-photo-card {
            border: 1px solid #d1d5db !important;
            border-radius: 12px !important;
            padding: 10px !important;
            background: #ffffff !important;
          }

          .print-photo-image-wrap {
            border: 1px solid #e5e7eb !important;
            border-radius: 10px !important;
            overflow: hidden !important;
            background: #f9fafb !important;
          }

          .print-status-pill {
            display: inline-flex !important;
            align-items: center !important;
            border: 1px solid #d1d5db !important;
            border-radius: 9999px !important;
            padding: 4px 10px !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            background: #f9fafb !important;
            color: #111827 !important;
          }

          .print-brand-gold {
            color: #a86f08 !important;
          }

          .print-brand-line {
            border-color: #c58b1a !important;
          }

          .print-logo-wrap {
            border: 1px solid #d1d5db !important;
            border-radius: 18px !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          .print-header-rule {
            border-top: 4px solid #111827 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-[#f3eadf] text-[#111111]">
        <header className="no-print border-b border-[#d8c4aa] bg-[#f7efe5]">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowMobileSidebar(true)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#d8c4aa] bg-white text-xl font-black text-[#3c2719] shadow-sm lg:hidden"
                aria-label="Open navigation"
              >
                ☰
              </button>
              <div className="min-w-0">
                <div className="text-3xl font-black tracking-tight text-[#2b190f] sm:text-4xl">5Tools</div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-[#9a5a16] sm:text-[11px] sm:tracking-[0.42em]">
                  Repair & Maintenance Workspace
                </div>
              </div>
            </div>
            <div className="hidden items-center gap-12 text-right text-sm font-black text-[#2b190f] md:flex">
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
          <nav className="hidden bg-[#4a2f1d] lg:block">
            <div className="mx-auto flex max-w-[1500px] items-center overflow-x-auto px-8">
              <Link href="/" className="px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526]">Home</Link>
              <Link href="/work-order-engine" className="px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526]">Work Orders</Link>
              <Link href="/work-order-pricing" className="px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526]">Pricing Notebook</Link>
              <Link href="/cost-estimator" className="px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526]">Cost Estimator</Link>
              <Link href="/project-scheduler" className="px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526]">Scheduler</Link>
              <Link href="/project-tracker" className="px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526]">Projects</Link>
              <Link href="/truck-inventory" className="px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#6f4526]">Truck Inventory</Link>
            </div>
          </nav>
        </header>

        {showMobileSidebar ? (
          <div className="no-print fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation overlay"
              onClick={() => setShowMobileSidebar(false)}
              className="absolute inset-0 bg-black/40"
            />
            <aside className="relative flex h-full w-[86vw] max-w-[340px] flex-col overflow-y-auto border-r border-[#d8c4aa] bg-[#fbf6ef] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#d8c4aa] px-4 py-4">
                <div>
                  <div className="text-xl font-black text-[#2b190f]">5Tools</div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a5a16]">Reports Desk</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileSidebar(false)}
                  className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm font-black text-[#3c2719]"
                >
                  Close
                </button>
              </div>

              <div className="space-y-1 p-3">
                <Link onClick={() => setShowMobileSidebar(false)} href="/operations-assistant" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">☊ Operations Assistant</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">⌂ Dashboard</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/work-order-engine" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▧ Work Orders</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/service-ticket" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▣ Service Ticket</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/inspections" className="flex items-center gap-3 rounded-md bg-[#a56a2a] px-4 py-3 text-sm font-semibold text-white shadow-sm">☑ Reports / Inspections</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/project-scheduler" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▣ Project Scheduler</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/project-tracker" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">◎ Project Tracker</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/time-clock-employees" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">◷ Time Clock</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/punch-list" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">✎ Punch List</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/work-order-pricing" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▧ Pricing</Link>
                <Link onClick={() => setShowMobileSidebar(false)} href="/truck-inventory" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▤ Truck Inventory</Link>
              </div>

              <div className="mt-2 border-t border-[#d8c4aa] p-4">
                <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#9a5a16]">Quick Actions</div>
                <div className="space-y-2">
                  <button onClick={() => { newInspection(); setShowMobileSidebar(false); }} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef]">＋ New Report</button>
                  <button onClick={() => { saveLocalReport(); setShowMobileSidebar(false); }} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef]">▣ Save Local</button>
                  <button onClick={() => { loadLocalReport(); setShowMobileSidebar(false); }} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef]">▣ Load Local</button>
                  <button onClick={() => { deleteLocalReport(); setShowMobileSidebar(false); }} className="flex w-full items-center gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100">✕ Delete Local</button>
                  <button onClick={() => { saveInspection(); setShowMobileSidebar(false); }} disabled={isSavingCloud} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef] disabled:opacity-60">✓ Save Cloud</button>
                  <button onClick={() => { loadInspection(); setShowMobileSidebar(false); }} disabled={isLoadingCloud || !selectedInspectionId} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef] disabled:opacity-60">☁ Load Cloud</button>
                  <button onClick={() => { deleteInspection(); setShowMobileSidebar(false); }} disabled={isDeletingCloud || !selectedInspectionId} className="flex w-full items-center gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60">✕ Delete Cloud</button>
                  <button onClick={() => { refreshCloudRecords(); setShowMobileSidebar(false); }} disabled={isRefreshingCloud} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef] disabled:opacity-60">↻ Refresh Cloud</button>
                  <button onClick={() => { refreshScheduledTasks(); setShowMobileSidebar(false); }} disabled={isRefreshingScheduledTasks} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef] disabled:opacity-60">↻ Refresh Tasks</button>
                  <button onClick={() => { printReport(); setShowMobileSidebar(false); }} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-3 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef]">⎙ Print Report</button>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        <div className="no-print mx-auto block max-w-[1500px] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden min-h-[calc(100vh-121px)] flex-col border-r border-[#d8c4aa] bg-[#fbf6ef] lg:flex">
            <div className="space-y-1 p-3">
              <Link href="/operations-assistant" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">☊ Operations Assistant</Link>
              <Link href="/" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">⌂ Dashboard</Link>
              <Link href="/work-order-engine" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▧ Work Orders</Link>
              <Link href="/service-ticket" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▣ Service Ticket</Link>
              <Link href="/inspections" className="flex items-center gap-3 rounded-md bg-[#a56a2a] px-4 py-3 text-sm font-semibold text-white shadow-sm">☑ Reports / Inspections</Link>
              <Link href="/project-scheduler" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▣ Project Scheduler</Link>
              <Link href="/project-tracker" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">◎ Project Tracker</Link>
              <Link href="/time-clock-employees" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">◷ Time Clock</Link>
              <Link href="/punch-list" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">✎ Punch List</Link>
              <Link href="/work-order-pricing" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▧ Pricing</Link>
              <Link href="/truck-inventory" className="flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#3c2719] hover:bg-[#f4e6d5]">▤ Truck Inventory</Link>
            </div>

            <div className="mt-2 border-t border-[#d8c4aa] p-4">
              <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#9a5a16]">Quick Actions</div>
              <div className="space-y-2">
                <button onClick={newInspection} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef]">＋ New Report</button>
                <button onClick={saveInspection} disabled={isSavingCloud} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef] disabled:opacity-60">✓ Save Cloud</button>
                <button onClick={refreshScheduledTasks} disabled={isRefreshingScheduledTasks} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef] disabled:opacity-60">↻ Refresh Tasks</button>
                <button onClick={printReport} className="flex w-full items-center gap-3 rounded-md border border-[#d8c4aa] bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#3c2719] transition hover:bg-[#fbf6ef]">⎙ Print Report</button>
              </div>
            </div>

            <div className="mt-auto border-t border-[#d8c4aa] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a56a2a] text-lg font-black text-white">5T</div>
                <div>
                  <div className="text-sm font-black text-[#111111]">5Tools</div>
                  <div className="text-xs font-semibold text-[#3f3328]">Reports Desk</div>
                </div>
              </div>
            </div>
          </aside>

          <main className="px-3 py-4 sm:px-5 lg:px-8 lg:py-7">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="text-xl font-black uppercase tracking-wide text-[#2b190f] sm:text-2xl">Reports / Inspections</h1>
                <p className="mt-2 text-sm font-semibold text-[#2b190f] sm:text-lg">Property condition reports, scheduled field reports, photos, and cloud records</p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:grid-cols-5">
                <Link href="/" className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-center text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef] sm:text-sm">← Dashboard</Link>
                <button onClick={newInspection} className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef] sm:text-sm">New Report</button>
                <button onClick={saveLocalReport} className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef] sm:text-sm">Save Local</button>
                <button onClick={loadLocalReport} className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef] sm:text-sm">Load Local</button>
                <button onClick={deleteLocalReport} className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs font-black text-red-700 hover:bg-red-100 sm:text-sm">Delete Local</button>
                <button onClick={saveInspection} disabled={isSavingCloud} className="rounded-lg border border-[#a56a2a] bg-[#8a541c] px-4 py-3 text-xs font-black text-white hover:bg-[#6f4526] disabled:opacity-60 sm:text-sm">{isSavingCloud ? "Saving..." : "Save Cloud"}</button>
                <button onClick={loadInspection} disabled={isLoadingCloud || !selectedInspectionId} className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef] disabled:opacity-60 sm:text-sm">{isLoadingCloud ? "Loading..." : "Load Cloud"}</button>
                <button onClick={deleteInspection} disabled={isDeletingCloud || !selectedInspectionId} className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-60 sm:text-sm">{isDeletingCloud ? "Deleting..." : "Delete Cloud"}</button>
                <button onClick={refreshCloudRecords} disabled={isRefreshingCloud} className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef] disabled:opacity-60 sm:text-sm">{isRefreshingCloud ? "Refreshing..." : "Refresh Cloud"}</button>
                <button onClick={printReport} className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef] sm:text-sm">Print / PDF</button>
              </div>
            </div>

            <section className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl border border-[#e2cdb4] bg-white p-4 shadow-sm"><div className="text-xs font-black text-[#9a5a16]">Pending Tasks</div><div className="mt-2 text-2xl font-black text-[#111111] sm:mt-3 sm:text-3xl">{scheduledTasks.length}</div></div>
              <div className="rounded-xl border border-[#e2cdb4] bg-white p-4 shadow-sm"><div className="text-xs font-black text-[#9a5a16]">Saved Reports</div><div className="mt-2 text-2xl font-black text-[#111111] sm:mt-3 sm:text-3xl">{savedInspections.length}</div></div>
              <div className="rounded-xl border border-[#e2cdb4] bg-white p-4 shadow-sm"><div className="text-xs font-black text-[#9a5a16]">Areas</div><div className="mt-2 text-2xl font-black text-[#111111] sm:mt-3 sm:text-3xl">{inspection.areas.length}</div></div>
              <div className="rounded-xl border border-[#e2cdb4] bg-white p-4 shadow-sm"><div className="text-xs font-black text-[#9a5a16]">Photos</div><div className="mt-2 text-2xl font-black text-[#111111] sm:mt-3 sm:text-3xl">{totalPhotos}</div></div>
              <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm"><div className="text-xs font-black text-red-700">Issue Photos</div><div className="mt-2 text-2xl font-black text-[#111111] sm:mt-3 sm:text-3xl">{issuePhotos}</div></div>
              <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"><div className="text-xs font-black text-amber-800">Work Requests</div><div className="mt-2 text-2xl font-black text-[#111111] sm:mt-3 sm:text-3xl">{workRequestCandidateCount}</div></div>
            </section>

            {statusMessage ? (
              <div className="rounded-xl border border-[#d8c4aa] bg-white px-4 py-3 text-sm text-[#3f3328]">
                {statusMessage}
              </div>
            ) : null}

            {workRequestCandidateCount > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-base font-black text-amber-950">Work Request Handoff</h2>
                    <p className="mt-1 text-sm font-semibold text-amber-900">
                      {workRequestCandidateCount} flagged issue{workRequestCandidateCount === 1 ? "" : "s"} ready for work request review. Pending handoffs on this device: {pendingWorkRequestCount}.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={createAllFlaggedWorkRequests}
                      className="rounded-lg border border-amber-400 bg-white px-4 py-3 text-sm font-black text-amber-900 shadow-sm hover:bg-amber-100"
                    >
                      Queue All Flagged Items
                    </button>
                    <button
                      type="button"
                      onClick={openWorkOrders}
                      className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-3 text-sm font-black text-[#3c2719] shadow-sm hover:bg-[#fbf6ef]"
                    >
                      Open Work Orders
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
              <section className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-[#d8c4aa] bg-white px-4 py-3 shadow-sm xl:hidden">
                  <div>
                    <h2 className="text-base font-semibold text-[#111111]">Report Controls</h2>
                    <p className="text-xs text-[#7c7468]">Property header, cloud records, areas, and photos.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLeftPanel((prev) => !prev)}
                    className="rounded-xl border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-semibold text-[#111111] hover:bg-[#fbf6ef]"
                  >
                    {showLeftPanel ? "Hide" : "Show"}
                  </button>
                </div>

                <div className={`${showLeftPanel ? "block" : "hidden"} space-y-6 xl:block`}>
                <div className={card}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Load Scheduled Inspection Task</h2>
                      <p className="mt-1 text-sm text-[#7c7468]">
                        Pull reports sent from Operations Hub into this Photo Review page.
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#7a4d20] ring-1 ring-[#d8d2c4]">
                      {scheduledTasks.length} Pending
                    </span>
                  </div>

                  <select
                    className={`${fieldClass} mt-4`}
                    value={selectedScheduledTaskId}
                    onChange={(e) => setSelectedScheduledTaskId(e.target.value)}
                  >
                    <option value="">Select scheduled inspection task</option>
                    {scheduledTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.property_name || "Untitled Property"}
                        {task.report_type ? ` - ${task.report_type}` : ""}
                        {task.due_date ? ` - ${task.due_date}` : ""}
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <button
                      className={buttonSecondary}
                      onClick={refreshScheduledTasks}
                      disabled={isRefreshingScheduledTasks}
                    >
                      {isRefreshingScheduledTasks ? "Refreshing..." : "Refresh Scheduled Tasks"}
                    </button>
                    <button
                      className={buttonPrimary}
                      onClick={loadScheduledTaskIntoReport}
                      disabled={isLoadingScheduledTask || !selectedScheduledTaskId}
                    >
                      {isLoadingScheduledTask ? "Loading..." : "Load Scheduled Report"}
                    </button>
                    <button
                      className={buttonDanger}
                      onClick={deleteScheduledTask}
                      disabled={isDeletingScheduledTask || !selectedScheduledTaskId}
                    >
                      {isDeletingScheduledTask ? "Deleting..." : "Delete Scheduled Task"}
                    </button>
                  </div>

                  {scheduledTasks.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-[#d8c4aa] bg-white p-4 text-sm text-[#7c7468]">
                      No scheduled reports are currently waiting in Photo Review. Send one from Operations Hub first.
                    </div>
                  ) : null}
                </div>

                <div className={card}>
                  <h2 className="text-lg font-semibold mb-4">Load Saved Report</h2>

                  <select
                    className={fieldClass}
                    value={selectedInspectionId}
                    onChange={(e) => setSelectedInspectionId(e.target.value)}
                  >
                    <option value="">Select saved cloud report</option>
                    {savedInspections.map((item) => {
                      const reportLabel =
                        item.propertyName ||
                        item.propertyAddress ||
                        `Saved Report ${item.id.slice(0, 8)}`;

                      return (
                        <option key={item.id} value={item.id}>
                          {reportLabel}
                          {item.propertyAddress && item.propertyName ? ` - ${item.propertyAddress}` : ""}
                          {item.inspectionDate ? ` - ${item.inspectionDate}` : ""}
                        </option>
                      );
                    })}
                  </select>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      className={`${buttonSecondary} w-full`}
                      onClick={loadInspection}
                      disabled={isLoadingCloud || !selectedInspectionId}
                    >
                      {isLoadingCloud ? "Loading..." : "Load Report"}
                    </button>

                    <button
                      className={`${buttonDanger} w-full`}
                      onClick={deleteInspection}
                      disabled={isDeletingCloud || !selectedInspectionId}
                    >
                      {isDeletingCloud ? "Deleting..." : "Delete Saved Report"}
                    </button>
                  </div>
                </div>

                <div className={card}>
                  <h2 className="text-lg font-semibold mb-4">Property Header</h2>

                  <label className="block mb-2">Property Name</label>
                  <input
                    className={fieldClass}
                    value={inspection.propertyName}
                    onChange={(e) => updateHeaderField("propertyName", e.target.value)}
                    placeholder="Example: 123 Main St"
                  />

                  <label className="block mt-4 mb-2">Property Address</label>
                  <input
                    className={fieldClass}
                    value={inspection.propertyAddress}
                    onChange={(e) => updateHeaderField("propertyAddress", e.target.value)}
                    placeholder="Street, City, State ZIP"
                  />

                  <label className="block mt-4 mb-2">Report Date</label>
                  <input
                    type="date"
                    className={fieldClass}
                    value={inspection.inspectionDate}
                    onChange={(e) => updateHeaderField("inspectionDate", e.target.value)}
                  />

                  <label className="block mt-4 mb-2">Prepared By</label>
                  <input
                    className={fieldClass}
                    value={inspection.inspectorName}
                    onChange={(e) => updateHeaderField("inspectorName", e.target.value)}
                    placeholder="Prepared By name"
                  />
                </div>

                <div className={card}>
                  <h2 className="text-lg font-semibold mb-2">Add Area / Room</h2>
                  <p className="mb-4 text-sm text-[#7c7468]">
                    Bedrooms and bathrooms can be added more than once. The tool will label them Bedroom 1, Bedroom 2, Bathroom 1, Bathroom 2, etc.
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className={fieldClass}
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="Custom label: Primary Bedroom, Hall Bath, Utility Room..."
                    />
                    <button className={buttonSecondary} onClick={addArea}>
                      Add Custom
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {AREA_TYPES.filter((preset) => preset !== "Custom").map((preset) => (
                      <button
                        key={preset}
                        onClick={() => addPresetArea(preset)}
                        className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] hover:bg-[#fbf6ef] transition"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {inspection.areas.length === 0 ? (
                  <div className={`${card} text-center border-dashed`}>
                    <p className="text-[#3b3324]">No areas added yet</p>
                    <p className="text-sm text-[#7c7468] mt-2">
                      Use the Add Area section to build this report.
                    </p>
                  </div>
                ) : (
                  inspection.areas.map((area) => {
                    const isAreaOpen = activeAreaId === area.id;

                    return (
                      <div key={area.id} className={card}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h2 className="text-xl font-semibold">{area.name}</h2>
                            <p className="mt-1 text-sm text-[#7c7468]">
                              {area.areaType} checklist • {area.checkItems.length} items • {area.photos.length} photo{area.photos.length === 1 ? "" : "s"}
                            </p>
                          </div>

                          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                            <select
                              className="w-full rounded-xl border border-[#d8c4aa] bg-white px-3 py-3 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                              value={area.status}
                              onChange={(e) =>
                                updateArea(area.id, {
                                  status: e.target.value as AreaWorkflowStatus,
                                })
                              }
                            >
                              <option>Open</option>
                              <option>In Progress</option>
                              <option>Review Needed</option>
                              <option>Complete</option>
                            </select>

                            <button
                              onClick={() => setActiveAreaId(isAreaOpen ? "" : area.id)}
                              className="w-full rounded-xl border border-[#d8c4aa] bg-white px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#fbf6ef]"
                            >
                              {isAreaOpen ? "Close Area" : "Open Area"}
                            </button>

                            <button
                              onClick={() => deleteArea(area.id)}
                              className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Remove Area
                            </button>
                          </div>
                        </div>

                        {isAreaOpen && (
                          <>
                            <div className="mt-4">
                              <label className="block mb-2 text-sm text-[#3b3324]">Area Notes</label>
                              <textarea
                                className={`${fieldClass} min-h-28`}
                                value={area.notes}
                                onChange={(e) => updateArea(area.id, { notes: e.target.value })}
                                placeholder="Document conditions, damage, vendor notes, tenant comments, or scope details..."
                              />
                            </div>

                            <div className="mt-4 rounded-xl border border-[#d8c4aa] bg-[#fbf6ef] p-3 sm:p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h3 className="text-base font-black text-[#2b190f]">Condition Checklist</h3>
                                  <p className="mt-1 text-xs font-semibold text-[#7c7468]">
                                    Fast occupied-unit reporting: rate visible condition, action needed, priority, and notes.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => resetAreaChecklist(area.id)}
                                  className="rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-black text-[#3c2719] hover:bg-[#fbf6ef]"
                                >
                                  Reset Checklist
                                </button>
                              </div>

                              <div className="mt-4 space-y-3">
                                {area.checkItems.map((item) => (
                                  <div key={item.id} className="rounded-xl border border-[#e2cdb4] bg-white p-3 shadow-sm">
                                    <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_0.8fr]">
                                      <div>
                                        <label className="block mb-1 text-xs font-black uppercase tracking-wide text-[#7c7468]">Component / System</label>
                                        <input
                                          className="w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                                          value={item.category}
                                          onChange={(e) => updateCheckItem(area.id, item.id, { category: e.target.value })}
                                        />
                                      </div>

                                      <div>
                                        <label className="block mb-1 text-xs font-black uppercase tracking-wide text-[#7c7468]">Rating</label>
                                        <select
                                          className="w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                                          value={item.rating}
                                          onChange={(e) => updateCheckItem(area.id, item.id, { rating: e.target.value as ConditionRating })}
                                        >
                                          {CONDITION_RATINGS.map((rating) => (
                                            <option key={rating} value={rating}>{rating}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block mb-1 text-xs font-black uppercase tracking-wide text-[#7c7468]">Recommended Action</label>
                                        <select
                                          className="w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                                          value={item.action}
                                          onChange={(e) => {
                                            const nextAction = e.target.value as RecommendedAction;
                                            updateCheckItem(area.id, item.id, {
                                              action: nextAction,
                                              workRequestSkill: isWorkRequestTriggerAction(nextAction)
                                                ? item.workRequestSkill || suggestWorkRequestSkill(area.areaType, item.category)
                                                : item.workRequestSkill,
                                            });
                                          }}
                                        >
                                          {RECOMMENDED_ACTIONS.map((action) => (
                                            <option key={action} value={action}>{action}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block mb-1 text-xs font-black uppercase tracking-wide text-[#7c7468]">Priority</label>
                                        <select
                                          className="w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                                          value={item.priority}
                                          onChange={(e) => updateCheckItem(area.id, item.id, { priority: e.target.value as ItemPriority })}
                                        >
                                          {ITEM_PRIORITIES.map((priority) => (
                                            <option key={priority} value={priority}>{priority}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    <div className="mt-3">
                                      <label className="block mb-1 text-xs font-black uppercase tracking-wide text-[#7c7468]">Notes</label>
                                      <textarea
                                        className="w-full min-h-20 rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] placeholder:text-[#7c7468] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                                        value={item.notes}
                                        onChange={(e) => updateCheckItem(area.id, item.id, { notes: e.target.value })}
                                        placeholder="Visible condition note. Keep factual and non-invasive."
                                      />
                                    </div>

                                    {isWorkRequestTriggerAction(item.action) ? (
                                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                                          <div>
                                            <label className="block mb-1 text-xs font-black uppercase tracking-wide text-amber-800">Work Request Skill / Vendor Category</label>
                                            <select
                                              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-amber-100"
                                              value={item.workRequestSkill || suggestWorkRequestSkill(area.areaType, item.category)}
                                              onChange={(e) => updateCheckItem(area.id, item.id, { workRequestSkill: e.target.value as WorkRequestSkill })}
                                            >
                                              {WORK_REQUEST_SKILLS.map((skill) => (
                                                <option key={skill} value={skill}>{skill}</option>
                                              ))}
                                            </select>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => createWorkRequestFromItem(area, item)}
                                            className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-black text-amber-900 shadow-sm hover:bg-amber-100"
                                          >
                                            Create Work Request
                                          </button>

                                          <button
                                            type="button"
                                            onClick={openWorkOrders}
                                            className="rounded-lg border border-[#d8c4aa] bg-white px-4 py-2 text-sm font-black text-[#3c2719] shadow-sm hover:bg-[#fbf6ef]"
                                          >
                                            Open Work Orders
                                          </button>
                                        </div>
                                        <p className="mt-2 text-xs font-semibold text-amber-900">
                                          This creates one pending work request for this issue only, so separate trades/vendors can be routed separately.
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-4">
                              <label className="block mb-2 text-sm text-[#3b3324]">Photos</label>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-[#d8c4aa] bg-white p-3">
                                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#7c7468]">
                                    Take Photos — Batch Save
                                  </label>
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => {
                                      addPhotosToArea(area.id, e.target.files);
                                      e.currentTarget.value = "";
                                    }}
                                    className="block w-full rounded-xl border border-[#d8c4aa] bg-white px-3 py-3 text-sm text-[#111111] file:mr-4 file:rounded-lg file:border-0 file:bg-[#8a541c] file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-[#b38f1f]"
                                  />
                                  <p className="mt-2 text-xs text-[#7c7468]">
                                    Opens the device camera/photo picker and lets you select multiple photos before saving them together.
                                  </p>
                                </div>

                                <div className="rounded-xl border border-[#d8c4aa] bg-white p-3">
                                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#7c7468]">
                                    Choose Files — Manual Upload
                                  </label>
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => {
                                      addPhotosToArea(area.id, e.target.files);
                                      e.currentTarget.value = "";
                                    }}
                                    className="block w-full rounded-xl border border-[#d8c4aa] bg-white px-3 py-3 text-sm text-[#111111] file:mr-4 file:rounded-lg file:border-0 file:bg-[#8a541c] file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-[#b38f1f]"
                                  />
                                  <p className="mt-2 text-xs text-[#7c7468]">
                                    Keeps the existing file upload option for selecting saved photos from your device.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {area.photos.length > 0 ? (
                              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                                {area.photos.map((photo) => (
                                  <div
                                    key={photo.id}
                                    className="rounded-xl border border-[#d8c4aa] bg-white p-4"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => openLightbox(photo.id)}
                                      className="group block w-full overflow-hidden rounded-xl border border-[#d8c4aa] bg-[#fbf6ef] text-left focus:outline-none focus:ring-4 focus:ring-[#f4e6d5]"
                                      title="Open larger photo view"
                                    >
                                      <img
                                        src={photo.url}
                                        alt={photo.name || "Report photo"}
                                        className="block h-auto max-h-[420px] w-full object-contain"
                                        onError={(event) => {
                                          event.currentTarget.style.display = "none";
                                        }}
                                      />
                                      <div className="flex items-center justify-between gap-3 bg-[#3c2719] px-3 py-2 text-xs font-black text-white">
                                        <span>Tap to enlarge</span>
                                        <span className="uppercase">{photo.type}</span>
                                      </div>
                                    </button>

                                    <div className="mt-3 grid gap-3">
                                      <div>
                                        <label className="block mb-1 text-xs uppercase tracking-wide text-[#7c7468]">
                                          Photo Type
                                        </label>
                                        <select
                                          className="w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                                          value={photo.type}
                                          onChange={(e) =>
                                            updatePhoto(area.id, photo.id, {
                                              type: e.target.value as PhotoType,
                                            })
                                          }
                                        >
                                          <option value="before">Before</option>
                                          <option value="progress">Progress</option>
                                          <option value="after">After</option>
                                          <option value="issue">Issue</option>
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block mb-1 text-xs uppercase tracking-wide text-[#7c7468]">
                                          Caption
                                        </label>
                                        <input
                                          className="w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2 text-sm text-[#111111] placeholder:text-[#7c7468] focus:outline-none focus:ring-2 focus:ring-[#f4e6d5]"
                                          value={photo.caption}
                                          onChange={(e) =>
                                            updatePhoto(area.id, photo.id, {
                                              caption: e.target.value,
                                            })
                                          }
                                          placeholder="Add caption or issue note"
                                        />
                                      </div>

                                      <div className="flex items-center justify-between text-xs text-[#7c7468]">
                                        <span>{photo.name}</span>
                                        <span>{new Date(photo.createdAt).toLocaleString()}</span>
                                      </div>

                                      <button
                                        onClick={() => deletePhoto(area.id, photo.id)}
                                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                                      >
                                        Delete Photo
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-5 rounded-xl border border-dashed border-[#d8c4aa] bg-white p-6 text-center text-sm text-[#7c7468]">
                                No photos uploaded for this area yet.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-[#d8c4aa] bg-white px-4 py-3 shadow-sm xl:hidden">
                  <div>
                    <h2 className="text-base font-semibold text-[#111111]">Report Preview</h2>
                    <p className="text-xs text-[#7c7468]">Summary, timeline, and data preview.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRightPanel((prev) => !prev)}
                    className="rounded-xl border border-[#d8c4aa] bg-white px-3 py-2 text-xs font-semibold text-[#111111] hover:bg-[#fbf6ef]"
                  >
                    {showRightPanel ? "Hide" : "Show"}
                  </button>
                </div>

                <div className={`${showRightPanel ? "block" : "hidden"} space-y-6 xl:block`}>
                  <div className={card}>
                    <h2 className="text-lg font-semibold mb-4">Report Summary</h2>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-sm text-[#7c7468]">Areas</p>
                      <p className="mt-1 text-2xl font-bold">{inspection.areas.length}</p>
                    </div>

                    <div className="rounded-xl bg-white p-4">
                      <p className="text-sm text-[#7c7468]">Photos</p>
                      <p className="mt-1 text-2xl font-bold">{totalPhotos}</p>
                    </div>

                    <div className="rounded-xl bg-white p-4">
                      <p className="text-sm text-[#7c7468]">Condition Issues</p>
                      <p className="mt-1 text-2xl font-bold">{conditionIssueCount}</p>
                    </div>

                    <div className="rounded-xl bg-white p-4">
                      <p className="text-sm text-[#7c7468]">Immediate Priority</p>
                      <p className="mt-1 text-2xl font-bold">{immediatePriorityCount}</p>
                    </div>
                  </div>
                </div>

                <div className={card}>
                  <h2 className="text-lg font-semibold mb-4">Project Timeline</h2>

                  {allTimelineItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#d8c4aa] bg-white p-6 text-center">
                      <p className="text-[#3b3324]">No timeline activity yet</p>
                      <p className="text-sm text-[#7c7468] mt-2">
                        Upload area photos to build a visual timeline.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[900px] overflow-auto pr-1">
                      {allTimelineItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-[#d8c4aa] bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                            <button
                              type="button"
                              onClick={() => openLightbox(item.id)}
                              className="shrink-0 rounded-lg focus:outline-none focus:ring-4 focus:ring-[#f4e6d5]"
                              title="Open larger photo view"
                            >
                              <img
                                src={item.url}
                                alt={item.name}
                                className="h-36 w-full rounded-lg border border-[#d8c4aa] object-cover sm:h-20 sm:w-20"
                              />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#8a541c] px-2 py-1 text-xs font-bold uppercase text-white">
                                  {item.type}
                                </span>
                                <span className="text-sm font-semibold">{item.areaName}</span>
                              </div>

                              <p className="mt-2 text-sm text-[#3b3324]">
                                {item.caption || "No caption added"}
                              </p>

                              <p className="mt-2 text-xs text-[#9b9286]">
                                {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>

              </section>
            </div>

            <footer className="mt-8 flex flex-col gap-2 border-t border-[#d8c4aa] py-6 text-xs text-[#3f3328] sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
              <div>© 2026 5Tools Operations. All rights reserved.</div>
              <div>Local Save: <span className="font-black text-green-700">Ready</span><span className="mx-3">|</span>Cloud Save: <span className="font-black text-green-700">Ready</span></div>
            </footer>
          </main>
        </div>


        {lightboxPhoto ? (
          <div
            className="no-print fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
            role="dialog"
            aria-modal="true"
            aria-label="Expanded photo viewer"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black uppercase tracking-wide text-white">
                  {lightboxPhoto.areaName || "Photo"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/75">
                  <span className="rounded-full bg-white/15 px-2 py-1 font-bold uppercase">
                    {lightboxPhoto.type}
                  </span>
                  <span>
                    {lightboxIndex + 1} of {allTimelineItems.length}
                  </span>
                  <span>{new Date(lightboxPhoto.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeLightbox}
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-4">
              {allTimelineItems.length > 1 ? (
                <button
                  type="button"
                  onClick={showPreviousPhoto}
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/25 bg-black/50 px-4 py-3 text-2xl font-black text-white hover:bg-black/75"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
              ) : null}

              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.name}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />

              {allTimelineItems.length > 1 ? (
                <button
                  type="button"
                  onClick={showNextPhoto}
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/25 bg-black/50 px-4 py-3 text-2xl font-black text-white hover:bg-black/75"
                  aria-label="Next photo"
                >
                  ›
                </button>
              ) : null}
            </div>

            <div className="border-t border-white/15 px-4 py-3">
              <div className="text-sm font-semibold text-white">
                {lightboxPhoto.caption || lightboxPhoto.name || "No caption added"}
              </div>
              {lightboxPhoto.areaNotes ? (
                <div className="mt-1 line-clamp-2 text-xs text-white/65">
                  Area notes: {lightboxPhoto.areaNotes}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

          {/* PRINT REPORT */}
          <div className="print-report hidden bg-white text-black">
            <div className="print-shell mx-auto max-w-5xl p-8">
              <div className="print-header-rule border-b border-[#d8c4aa] pb-6 pt-4">
                <div className="flex items-start gap-8">
                  <div className="print-logo-wrap w-[240px] shrink-0 p-2">
                    <img
                      src="/5tools-logo.png"
                      alt="5Tools logo"
                      className="h-auto w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1 pt-2">
                    <h1 className="text-[52px] font-black uppercase leading-[0.95] tracking-tight text-[#111111]">
                      Property
                      <br />
                      Condition Report
                    </h1>
                    <p className="print-brand-gold mt-4 text-[22px] font-semibold leading-tight">
                      5Tools Property Condition Report
                    </p>
                  </div>

                </div>
              </div>

              <div className="mt-8 grid grid-cols-[1fr_1fr] gap-8">
                <div className="space-y-8">
                  <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
                    <div className="print-brand-gold text-4xl">⌂</div>
                    <div>
                      <div className="print-label">Property Name</div>
                      <div className="mt-1 text-3xl font-semibold text-[#111111]">
                        {inspection.propertyName || "--"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="print-brand-gold text-4xl">⌖</div>
                    <div>
                      <div className="print-label">Property Address</div>
                      <div className="mt-1 text-3xl font-semibold leading-tight text-[#111111]">
                        {inspection.propertyAddress || "--"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-l border-[#d8c4aa] pl-8">
                  <div className="flex items-start gap-4">
                    <div className="print-brand-gold text-4xl">☰</div>
                    <div>
                      <div className="print-label">Report Summary</div>
                      <div className="mt-2 text-xl leading-9 text-slate-800">
                        This report provides a general overview of the property
                        condition based on a visual walkthrough.
                        <br />
                        See area notes and photos for details.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="print-card mt-8 p-6">
                <div className="grid grid-cols-4 divide-x divide-slate-200">
                  <div className="px-6 py-3 text-center">
                    <div className="print-brand-gold text-5xl">▦</div>
                    <div className="mt-3 text-xl font-bold uppercase text-[#111111]">Areas</div>
                    <div className="mt-2 text-6xl font-black text-[#111111]">{inspection.areas.length}</div>
                  </div>
                  <div className="px-6 py-3 text-center">
                    <div className="print-brand-gold text-5xl">◉</div>
                    <div className="mt-3 text-xl font-bold uppercase text-[#111111]">Photos</div>
                    <div className="mt-2 text-6xl font-black text-[#111111]">{totalPhotos}</div>
                  </div>
                  <div className="px-6 py-3 text-center">
                    <div className="print-brand-gold text-5xl">!</div>
                    <div className="mt-3 text-xl font-bold uppercase text-[#111111]">Issue Photos</div>
                    <div className="mt-2 text-6xl font-black text-[#111111]">{issuePhotos}</div>
                  </div>
                  <div className="px-6 py-3 text-center">
                    <div className="print-brand-gold text-5xl">✓</div>
                    <div className="mt-3 text-xl font-bold uppercase text-[#111111]">Needs Attention</div>
                    <div className="mt-2 text-6xl font-black text-[#111111]">{conditionIssueCount}</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-10">
                {inspection.areas.length === 0 ? (
                  <div className="print-card p-6 text-sm text-slate-600">
                    No report areas have been added.
                  </div>
                ) : (
                  inspection.areas.map((area, index) => (
                    <section
                      key={area.id}
                      className={`print-avoid-break ${index > 0 ? "print-page-break" : ""}`}
                    >
                      <div className="flex items-end justify-between gap-4 border-b-2 border-slate-200 pb-4">
                        <div className="flex items-center gap-4">
                          <div className="print-brand-gold text-5xl">⌂</div>
                          <div>
                            <h2 className="text-4xl font-black uppercase tracking-tight text-[#111111]">{area.name}</h2>
                            <p className="mt-2 text-2xl font-bold text-[#111111]">
                              Status: <span className="print-brand-gold">{area.status}</span> • Type: <span className="print-brand-gold">{area.areaType}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-2xl font-bold text-[#111111]">
                          <span className="print-brand-gold text-4xl">◉</span>
                          <span>Photos: {area.photos.length}</span>
                        </div>
                      </div>

                      <div className="mt-8 grid grid-cols-2 gap-8">
                        <div>
                          <div className="text-xl font-black uppercase tracking-tight text-[#111111]">
                            Area Notes
                          </div>
                          <div className="mt-4 min-h-[150px] rounded-xl border border-[#d8c4aa] bg-slate-50 p-5 text-xl leading-8 text-slate-700 italic">
                            {area.notes || "No notes entered."}
                          </div>

                          <div className="mt-6 text-xl font-black uppercase tracking-tight text-[#111111]">
                            Condition Checklist
                          </div>
                          <div className="mt-4 space-y-3">
                            {area.checkItems.map((item) => (
                              <div key={item.id} className="rounded-xl border border-[#d8c4aa] bg-white p-4 text-base leading-6 text-[#111111]">
                                <div className="text-lg font-black">{item.category}</div>
                                <div className="mt-2 grid grid-cols-3 gap-3 text-sm font-bold">
                                  <div>Rating: <span className="print-brand-gold">{item.rating}</span></div>
                                  <div>Action: <span className="print-brand-gold">{item.action}</span></div>
                                  <div>Priority: <span className="print-brand-gold">{item.priority}</span></div>
                                </div>
                                {item.notes ? (
                                  <div className="mt-2 text-sm text-slate-700">{item.notes}</div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-xl font-black uppercase tracking-tight text-[#111111]">
                            Photo Documentation
                          </div>

                          {area.photos.length === 0 ? (
                            <div className="mt-4 min-h-[150px] rounded-xl border border-[#d8c4aa] bg-slate-50 p-5 text-xl leading-8 text-slate-700 italic">
                              No photos added for this area.
                            </div>
                          ) : (
                            <div className="print-photo-grid mt-4">
                              {area.photos.map((photo) => (
                                <div key={photo.id} className="print-photo-card">
                                  <div className="print-photo-image-wrap aspect-[4/3] min-h-[420px]">
                                    <img
                                      src={photo.url}
                                      alt={photo.name}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>

                                  <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="print-status-pill">{photo.type}</div>
                                    <div className="text-xs text-[#9b9286]">
                                      {new Date(photo.createdAt).toLocaleString()}
                                    </div>
                                  </div>

                                  <div className="mt-3 text-lg font-semibold leading-7 text-[#111111]">
                                    {photo.caption || photo.name}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  ))
                )}
              </div>

              <div className="mt-10 border-t pt-6 grid grid-cols-2 gap-6 text-sm text-slate-800">
                <div>
                  <div className="text-xs font-semibold uppercase text-[#9b9286]">
                    Report Date
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {inspection.inspectionDate || "--"}
                  </div>
                  <div className="text-xs text-[#9b9286]">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-[#9b9286]">
                    Prepared By
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {inspection.inspectorName || "--"}
                  </div>
                  <div className="text-xs text-[#9b9286]">5Tools</div>
                </div>
              </div>

              <div className="print-brand-line mt-10 grid grid-cols-[1fr_280px] gap-8 border-t-2 pt-6">
                <div className="flex items-start gap-4">
                  <div className="print-brand-gold text-5xl">✓</div>
                  <div>
                    <div className="text-2xl font-black uppercase tracking-tight text-[#111111]">
                      Disclaimer
                    </div>
                    <div className="mt-2 text-xl leading-9 text-slate-800">
                      This report is a limited visual property condition summary based on accessible and visible conditions during a walkthrough.
                      It is not a licensed home inspection, code inspection, engineering evaluation, or invasive inspection and should not be relied upon as a substitute
                      for a professional inspection. No warranties or guarantees are expressed or implied.
                      For a full evaluation, a licensed home inspector or specialist should be consulted.
                    </div>
                  </div>
                </div>

                <div className="border-l border-[#d8c4aa] pl-8 text-center">
                  <div className="print-brand-gold text-5xl italic">Thank you!</div>
                  <div className="mt-3 text-4xl font-black text-[#111111]">5Tools</div>
                  <div className="mt-3 text-lg leading-8 text-slate-700">
                    Qualitywork. Honest service.
                    <br />
                    Solutions that last.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </>
  );
}
