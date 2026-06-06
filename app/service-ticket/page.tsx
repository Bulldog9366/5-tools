"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

const SERVICE_TICKET_TABLE = "service_tickets";
const WORK_ORDER_PRICING_ROUTE = "/work-order-pricing";
const WORK_ORDER_PRICING_QUEUE_KEY = "five_tools_work_order_pricing_queue_v1";
const SERVICE_TICKET_PRICING_RETURN_QUEUE_KEY = "five_tools_service_ticket_pricing_return_queue_v1";
const SERVICE_TICKET_PRICING_DRAFT_KEY = "five_tools_service_ticket_pricing_return_draft_v1";
const WORK_ORDER_SERVICE_TICKET_QUEUE_KEY = "five_tools_service_ticket_queue_v1";
const LOCAL_SERVICE_TICKETS_KEY = "five_tools_service_tickets_local_v1";
const SHARED_PHOTO_PACKAGE_KEY = "five_tools_work_order_service_ticket_photos_v1";
const PHOTO_BUCKET_NAME = "work-order-photos";
const WORK_ORDER_LOCAL_KEY = "five_tools_work_order_engine_current_v2";
const WORK_ORDER_ARCHIVE_KEY = "five_tools_work_order_engine_archive_v2";

type PhotoItem = {
  id: string;
  name: string;
  dataUrl?: string;
  caption: string;
  uploadedAt: string;
  section: "before" | "after";
  storagePath?: string;
  publicUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  cloudUploadedAt?: string;
  uploadStatus?: "local" | "cloud" | "failed";
  uploadError?: string;
};

type ServiceTicketForm = {
  id: string;
  ticketNumber: string;
  property: string;
  unit: string;
  tenant: string;
  assignedTo: string;
  priority: string;
  status: string;
  trade: string;
  description: string;
  scope: string;
  employeeInstructions: string;
  approvalLimit: string;
  materials: string;
  schedule: string;
  access: string;
  photosRequired: string;
  laborHours: string;
  materialCost: string;
  notes: string;
  completedBy: string;
  completedDate: string;
  beforePhotoData: PhotoItem[];
  afterPhotoData: PhotoItem[];
};

type CloudTicketRow = {
  id: string;
  ticket_number: string | null;
  property: string | null;
  unit: string | null;
  tenant: string | null;
  assigned_to: string | null;
  priority: string | null;
  status: string | null;
  trade: string | null;
  description: string | null;
  scope_of_work: string | null;
  employee_instructions: string | null;
  approval_limit: string | null;
  materials_needed: string | null;
  scheduled_for: string | null;
  access_instructions: string | null;
  photos_required: string | null;
  labor_hours: string | null;
  material_cost: string | null;
  completion_notes: string | null;
  completed_by: string | null;
  completed_date: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkOrderServiceTicketQueueItem = {
  sourceId?: string;
  source?: string;
  workOrderNumber?: string;
  ticketNumber?: string;
  property?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  unit?: string;
  tenant?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  assignedTo?: string;
  priority?: string;
  status?: string;
  trade?: string;
  category?: string;
  description?: string;
  issueDescription?: string;
  scope?: string;
  scopeOfWork?: string;
  employeeInstructions?: string;
  approvalLimit?: string;
  materials?: string | number;
  schedule?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  access?: string;
  accessNotes?: string;
  materialCost?: string | number;
  notes?: string;
  beforePhotoData?: PhotoItem[];
  afterPhotoData?: PhotoItem[];
  photoPackageKey?: string;
  rawWorkOrder?: { beforePhotoData?: PhotoItem[]; afterPhotoData?: PhotoItem[]; id?: string; workOrderNumber?: string };
};

const SCOPE_TEMPLATES = [
  {
    label: "Dishwasher Replacement",
    trade: "Appliance",
    scope:
      "Remove existing dishwasher and disconnect water supply, drain line, and electrical connection. Install replacement dishwasher using existing plumbing and electrical connections. Secure and level unit, verify door operation, test fill/drain operation, check for leaks, clean work area, and document completion with required photos.",
  },
  {
    label: "Refrigerator Replacement",
    trade: "Appliance",
    scope:
      "Remove existing refrigerator if required. Install replacement refrigerator, position and level unit, connect to existing water line if applicable, verify cooling operation and water/ice function if equipped, clean work area, and document completion with required photos.",
  },
  {
    label: "Range / Stove Replacement",
    trade: "Appliance",
    scope:
      "Remove existing range or stove and disconnect existing utilities as applicable. Install replacement unit using existing electrical or gas connection, position unit correctly, verify safe operation of burners/elements and oven, clean work area, and document completion with required photos.",
  },
  {
    label: "Over-the-Range Microwave Replacement",
    trade: "Appliance",
    scope:
      "Remove existing over-the-range microwave. Install replacement microwave using existing mounting location and electrical connection, secure mounting bracket, verify proper operation and vent function if applicable, clean work area, and document completion with required photos.",
  },
  {
    label: "Toilet Replacement",
    trade: "Plumbing",
    scope:
      "Remove existing toilet and wax ring. Install replacement toilet with new wax ring or seal, secure toilet to flange, reconnect water supply, test flush operation, check for leaks at supply and base, clean work area, and document completion with required photos.",
  },
  {
    label: "Faucet Replacement",
    trade: "Plumbing",
    scope:
      "Remove existing faucet. Install replacement faucet using existing plumbing connections, reconnect hot and cold water supply lines, test operation, check for leaks at supply lines and drain area, clean work area, and document completion with required photos.",
  },
  {
    label: "Garbage Disposal Replacement",
    trade: "Plumbing",
    scope:
      "Remove existing garbage disposal. Install replacement disposal using existing sink, drain, and electrical connections, reconnect drain piping and dishwasher discharge if applicable, test operation, check for leaks, clean work area, and document completion with required photos.",
  },
  {
    label: "Light Fixture Replacement",
    trade: "Electrical",
    scope:
      "Remove existing light fixture. Install replacement fixture using existing wiring and mounting location, secure fixture, install bulbs if provided, test switch operation, clean work area, and document completion with required photos.",
  },
  {
    label: "Smoke / CO Detector Replacement",
    trade: "Electrical",
    scope:
      "Remove existing smoke or carbon monoxide detector. Install replacement smoke/CO detector using existing power source or battery setup as applicable, test device function, clean work area, and document completion with required photos.",
  },
  {
    label: "Range Hood Installation - Existing Vent",
    trade: "Appliance",
    scope:
      "Install range hood at existing kitchen location and connect to existing vent ducting where available. Secure unit, connect electrical using existing connection, verify fan/light operation and airflow, clean work area, and document completion with required photos.",
  },
  {
    label: "Vanity Replacement",
    trade: "Plumbing",
    scope:
      "Remove existing vanity and disconnect plumbing. Install replacement vanity using existing plumbing locations, reconnect faucet and drain connections, secure unit, test sink and drain operation, check for leaks, clean work area, and document completion with required photos.",
  },
  {
    label: "Carpet Replacement",
    trade: "Flooring",
    scope:
      "Remove existing carpet and padding as required. Prepare floor area for installation, install replacement carpet and pad, trim edges, secure transitions where applicable, clean work area, and document completion with required photos.",
  },
  {
    label: "LVP Flooring Installation",
    trade: "Flooring",
    scope:
      "Remove existing flooring as required. Prepare subfloor for installation, install LVP flooring with required cuts and transitions, verify clean fit and finish, clean work area, and document completion with required photos.",
  },
  {
    label: "Interior Painting",
    trade: "Painting",
    scope:
      "Prepare interior surfaces as required. Apply primer if needed and paint walls and/or ceilings for proper coverage. Protect adjacent surfaces, clean work area, and document completion with required photos.",
  },
  {
    label: "Drywall Repair",
    trade: "Drywall",
    scope:
      "Repair damaged drywall areas as approved. Patch drywall, apply texture to reasonably match existing surface, prepare repaired area for paint, clean work area, and document completion with required photos.",
  },
  {
    label: "Haul Away / Trash Removal",
    trade: "General",
    scope:
      "Remove and dispose of approved debris or unwanted items from the property. Sweep or clean affected area after removal, provide disposal documentation if required, and document completion with required photos.",
  },
  {
    label: "General Handyman Repair",
    trade: "General",
    scope:
      "Perform approved minor repair work using existing systems and materials where applicable. Verify completed repair is functional, clean work area, and document completion with required photos. Call office before performing work outside the approved request or approval limit.",
  },
];

const SCOPE_PROTECTION_CLAUSE =
  "Unforeseen conditions, damaged existing connections, code-required upgrades, structural modifications, concealed damage, or additional repairs not visible at time of service are not included and require approval before additional work is performed.";

const emptyForm = (): ServiceTicketForm => ({
  id: "",
  ticketNumber: "",
  property: "",
  unit: "",
  tenant: "",
  assignedTo: "",
  priority: "Normal",
  status: "Open",
  trade: "",
  description: "",
  scope: "",
  employeeInstructions: "",
  approvalLimit: "",
  materials: "",
  schedule: "",
  access: "",
  photosRequired: "Before and after photos required.",
  laborHours: "",
  materialCost: "",
  notes: "",
  completedBy: "",
  completedDate: "",
  beforePhotoData: [],
  afterPhotoData: [],
});

function moneyToNumber(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyText(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "";
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
}

function buildPropertyFromWorkOrder(item: WorkOrderServiceTicketQueueItem) {
  const cityStateZip = [item.city, [item.state, item.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return [item.property || item.propertyAddress, cityStateZip]
    .filter(Boolean)
    .join(", ");
}

function rowToForm(row: CloudTicketRow): ServiceTicketForm {
  return {
    id: row.id || "",
    ticketNumber: row.ticket_number || "",
    property: row.property || "",
    unit: row.unit || "",
    tenant: row.tenant || "",
    assignedTo: row.assigned_to || "",
    priority: row.priority || "Normal",
    status: row.status || "Open",
    trade: row.trade || "",
    description: row.description || "",
    scope: row.scope_of_work || "",
    employeeInstructions: row.employee_instructions || "",
    approvalLimit: row.approval_limit || "",
    materials: row.materials_needed || "",
    schedule: row.scheduled_for || "",
    access: row.access_instructions || "",
    photosRequired: row.photos_required || "Before and after photos required.",
    laborHours: row.labor_hours || "",
    materialCost: row.material_cost || "",
    notes: row.completion_notes || "",
    completedBy: row.completed_by || "",
    completedDate: row.completed_date || "",
    beforePhotoData: [],
    afterPhotoData: [],
  };
}

function formToRow(form: ServiceTicketForm) {
  return {
    id: form.id || crypto.randomUUID(),
    ticket_number: form.ticketNumber,
    property: form.property,
    unit: form.unit,
    tenant: form.tenant,
    assigned_to: form.assignedTo,
    priority: form.priority,
    status: form.status,
    trade: form.trade,
    description: form.description,
    scope_of_work: form.scope,
    employee_instructions: form.employeeInstructions,
    approval_limit: form.approvalLimit,
    materials_needed: form.materials,
    scheduled_for: form.schedule || null,
    access_instructions: form.access,
    photos_required: form.photosRequired,
    labor_hours: form.laborHours,
    material_cost: String(moneyToNumber(form.materialCost)),
    completion_notes: form.notes,
    completed_by: form.completedBy,
    completed_date: form.completedDate || null,
    updated_at: new Date().toISOString(),
  };
}


function getPhotoPackageKey(ticketNumber: string, id?: string) {
  return id || ticketNumber || "unsaved-service-ticket";
}

function readSharedPhotoPackages() {
  if (typeof window === "undefined") return {} as Record<string, { beforePhotoData?: PhotoItem[]; afterPhotoData?: PhotoItem[]; updatedAt?: string }>;
  try {
    const raw = localStorage.getItem(SHARED_PHOTO_PACKAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { beforePhotoData?: PhotoItem[]; afterPhotoData?: PhotoItem[]; updatedAt?: string }>) : {};
  } catch {
    return {};
  }
}


function isSameStoredPhoto(candidate: unknown, target: PhotoItem) {
  if (!candidate || typeof candidate !== "object") return false;
  const photo = candidate as Partial<PhotoItem>;
  const looksLikePhoto = Boolean(
    photo.storagePath ||
      photo.publicUrl ||
      photo.uploadedAt ||
      (photo.section && photo.name)
  );
  if (!looksLikePhoto) return false;

  if (target.id && photo.id === target.id) return true;
  if (target.storagePath && photo.storagePath === target.storagePath) return true;
  if (target.publicUrl && photo.publicUrl === target.publicUrl) return true;

  return Boolean(
    target.name &&
      photo.name === target.name &&
      photo.section === target.section &&
      String(photo.sizeBytes || "") === String(target.sizeBytes || "")
  );
}

function removePhotoFromStoredValue(value: unknown, target: PhotoItem): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isSameStoredPhoto(item, target))
      .map((item) => removePhotoFromStoredValue(item, target));
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      next[key] = removePhotoFromStoredValue(item, target);
    });
    return next;
  }

  return value;
}

function purgeDeletedPhotoReferences(target?: PhotoItem) {
  if (typeof window === "undefined" || !target) return;

  const storageKeys = Array.from(
    new Set([
      SHARED_PHOTO_PACKAGE_KEY,
      LOCAL_SERVICE_TICKETS_KEY,
      WORK_ORDER_SERVICE_TICKET_QUEUE_KEY,
      WORK_ORDER_LOCAL_KEY,
      WORK_ORDER_ARCHIVE_KEY,
      "five_tools_service_ticket_draft_v1",
      "serviceTickets",
    ]),
  );

  storageKeys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const cleaned = removePhotoFromStoredValue(parsed, target);
      localStorage.setItem(key, JSON.stringify(cleaned));
    } catch {
      // Ignore bad legacy values so one old key does not block delete sync.
    }
  });

  if (target.dataUrl?.startsWith("blob:")) URL.revokeObjectURL(target.dataUrl);
}

function saveSharedPhotoPackage(form: ServiceTicketForm) {
  if (typeof window === "undefined") return;
  const key = getPhotoPackageKey(form.ticketNumber, form.id);
  if (!key || key === "unsaved-service-ticket") return;

  const packages = readSharedPhotoPackages();
  packages[key] = {
    beforePhotoData: stripPhotoDataUrls(form.beforePhotoData || []),
    afterPhotoData: stripPhotoDataUrls(form.afterPhotoData || []),
    updatedAt: new Date().toISOString(),
  };

  if (form.ticketNumber && form.id && form.ticketNumber !== form.id) {
    packages[form.ticketNumber] = packages[key];
  }

  safeSetLocalStorage(SHARED_PHOTO_PACKAGE_KEY, JSON.stringify(packages));
}

function readJsonFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeKey(value: unknown) {
  return String(value || "").trim();
}

function findWorkOrderPhotosByKeys(keys: string[]) {
  const cleanedKeys = Array.from(new Set(keys.map(normalizeKey).filter(Boolean)));
  const hasMatch = (candidate: any) => {
    const candidateKeys = [candidate?.id, candidate?.workOrderNumber, candidate?.work_order_number, candidate?.sourceId]
      .map(normalizeKey)
      .filter(Boolean);
    return candidateKeys.some((candidateKey) => cleanedKeys.includes(candidateKey));
  };

  const currentWorkOrder = readJsonFromStorage<any>(WORK_ORDER_LOCAL_KEY, null);
  if (currentWorkOrder && hasMatch(currentWorkOrder)) {
    return {
      beforePhotoData: currentWorkOrder.beforePhotoData || [],
      afterPhotoData: currentWorkOrder.afterPhotoData || [],
    };
  }

  const archive = readJsonFromStorage<any[]>(WORK_ORDER_ARCHIVE_KEY, []);
  const archivedMatch = Array.isArray(archive) ? archive.find(hasMatch) : null;
  if (archivedMatch) {
    return {
      beforePhotoData: archivedMatch.beforePhotoData || [],
      afterPhotoData: archivedMatch.afterPhotoData || [],
    };
  }

  return null;
}

function loadSharedPhotoPackage(form: ServiceTicketForm, extraKeys: string[] = []) {
  const packages = readSharedPhotoPackages();
  const keys = Array.from(new Set([form.id, form.ticketNumber, ...extraKeys].map(normalizeKey).filter(Boolean)));
  const pack = keys.map((key) => packages[key]).find(Boolean);
  const workOrderPack = findWorkOrderPhotosByKeys(keys);

  return {
    beforePhotoData: pack?.beforePhotoData || workOrderPack?.beforePhotoData || form.beforePhotoData || [],
    afterPhotoData: pack?.afterPhotoData || workOrderPack?.afterPhotoData || form.afterPhotoData || [],
  };
}

function getPhotoDisplaySrc(photo: PhotoItem) {
  return photo.dataUrl || photo.publicUrl || "";
}

function stripPhotoDataUrls(photos: PhotoItem[] = []) {
  return photos.map(({ dataUrl, ...photo }) => photo);
}

function storageSafeTicket(ticket: ServiceTicketForm): ServiceTicketForm {
  return {
    ...ticket,
    beforePhotoData: stripPhotoDataUrls(ticket.beforePhotoData || []),
    afterPhotoData: stripPhotoDataUrls(ticket.afterPhotoData || []),
  };
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Could not save ${key} to localStorage`, error);
    return false;
  }
}

function safeStorageSegment(value: string) {
  return (value || "service-ticket")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "service-ticket";
}

function fileExtensionFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return ext === "jpeg" ? "jpg" : ext;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Photo could not be read."));
    reader.readAsDataURL(file);
  });
}

function buildPhotoStoragePath(form: ServiceTicketForm, section: "before" | "after", photoId: string, fileName: string) {
  const ticketKey = safeStorageSegment(form.ticketNumber || form.id || "unsaved-ticket");
  return `work-orders/${ticketKey}/${section}/${safeStorageSegment(photoId)}.${fileExtensionFromName(fileName)}`;
}

function PhotoPanel({
  title,
  photos,
  onAddPhotos,
  onCaptionChange,
  onRemovePhoto,
  onSaveCloud,
}: {
  title: string;
  photos: PhotoItem[];
  onAddPhotos: (files: FileList | null) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onRemovePhoto: (id: string) => void;
  onSaveCloud: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-[#2b190f]">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-[#5f4a39]">Shared with Work Order by ticket/work order number.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onAddPhotos(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="rounded-xl bg-[#8a541c] px-4 py-2 text-sm font-black text-white hover:bg-[#6f4526]"
          >
            Add Photos
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSaveCloud();
            }}
            className="mt-2 rounded-xl border border-[#8a541c] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]"
          >
            Save Photos to Cloud
          </button>
        </div>
      </div>

      {photos.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-xl border border-[#d8c4aa] bg-white shadow-sm">
              {getPhotoDisplaySrc(photo) ? (
                <img src={getPhotoDisplaySrc(photo)} alt={photo.caption || photo.name} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-[#f3eadf] text-sm font-bold text-[#6f5a45]">No preview</div>
              )}
              <div className="space-y-2 p-3">
                <p className="truncate text-xs font-black text-[#2b190f]">{photo.name}</p>
                <p className={`text-[11px] font-bold ${photo.uploadStatus === "cloud" ? "text-green-700" : photo.uploadStatus === "failed" ? "text-red-700" : "text-[#9a5a16]"}`}>
                  {photo.uploadStatus === "cloud" ? "Saved to Supabase" : photo.uploadStatus === "failed" ? `Local only — ${photo.uploadError || "cloud upload failed"}` : "Loaded / local preview"}
                </p>
                <input
                  value={photo.caption || ""}
                  onChange={(e) => onCaptionChange(photo.id, e.target.value)}
                  placeholder="Caption / location"
                  className="w-full rounded-lg border border-[#d8c4aa] bg-[#fffaf4] px-2 py-2 text-sm text-[#111111] outline-none focus:border-[#a56a2a]"
                />
                <button type="button" onClick={() => onRemovePhoto(photo.id)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-100">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#d8c4aa] bg-white p-4 text-sm font-bold text-[#6f5a45]">No photos loaded.</p>
      )}
    </div>
  );
}

export default function ServiceTicketPage() {
  const [form, setForm] = useState<ServiceTicketForm>(() => emptyForm());
  const [message, setMessage] = useState("Ready for a new service ticket.");
  const [savedTickets, setSavedTickets] = useState<CloudTicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [localTickets, setLocalTickets] = useState<ServiceTicketForm[]>([]);
  const [selectedLocalTicketId, setSelectedLocalTicketId] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [selectedScopeTemplate, setSelectedScopeTemplate] = useState("");
  const [includeProtectionClause, setIncludeProtectionClause] = useState(true);

  const [activeSection, setActiveSection] = useState<
    "intake" | "scope" | "map" | "completion" | "cloud" | "actions"
  >("intake");

  const inputClass =
    "w-full rounded-lg border border-[#d8c4aa] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none transition placeholder:text-[#9c8d7d] focus:border-[#a56a2a] focus:ring-2 focus:ring-[#f4e6d5]";

  const labelClass = "mb-1 block text-xs font-black uppercase tracking-wide text-[#3c2719]";

  const selectedTicket = useMemo(
    () => savedTickets.find((ticket) => ticket.id === selectedTicketId),
    [savedTickets, selectedTicketId]
  );

  useEffect(() => {
    loadLocalTickets(false);

    const seed = localStorage.getItem("serviceTicketSeed");
    if (!seed) {
      loadCloudTickets(false);
      return;
    }

    try {
      const data = JSON.parse(seed);

      setForm((prev) => {
        const seeded: ServiceTicketForm = {
          ...prev,
          ticketNumber: data.ticketNumber || data.workOrderNumber || prev.ticketNumber,
          property: data.property || data.propertyAddress || "",
          unit: data.unit || "",
          tenant: data.tenant || data.tenantName || "",
          assignedTo: data.assignedTo || data.assignedto || data.vendor || data.vendorName || "",
          priority: data.priority || "Normal",
          status: data.status || "Open",
          trade: data.trade || data.category || data.title || data.projectName || "",
          description: data.description || data.issueDescription || data.notes || "",
          scope: data.scope || data.scopeOfWork || "",
          employeeInstructions: data.employeeInstructions || "",
          approvalLimit: data.approvalLimit || data.maintenanceLimit || "",
          materials: data.materials || "",
          schedule: data.schedule || data.duedate || data.dueDate || data.scheduledDate || "",
          access: data.access || data.accessNotes || "",
          laborHours: data.laborHours || "",
          materialCost: data.materialCost || data.actualCost || data.actualcost || "",
          notes: data.notes || "",
          beforePhotoData: data.beforePhotoData || data.rawWorkOrder?.beforePhotoData || prev.beforePhotoData || [],
          afterPhotoData: data.afterPhotoData || data.rawWorkOrder?.afterPhotoData || prev.afterPhotoData || [],
        };

        const sharedPhotos = loadSharedPhotoPackage(seeded, [
          String(data.sourceId || ""),
          String(data.workOrderNumber || ""),
          String(data.sharedPhotoPackageKey || data.photoPackageKey || ""),
          String(data.rawWorkOrder?.id || ""),
          String(data.rawWorkOrder?.workOrderNumber || ""),
        ]);

        return {
          ...seeded,
          beforePhotoData: seeded.beforePhotoData.length ? seeded.beforePhotoData : sharedPhotos.beforePhotoData,
          afterPhotoData: seeded.afterPhotoData.length ? seeded.afterPhotoData : sharedPhotos.afterPhotoData,
        };
      });

      setMessage("Service ticket created from Project Tracker.");
      localStorage.removeItem("serviceTicketSeed");
      loadCloudTickets(false);
    } catch (error) {
      console.error(error);
      setMessage("Could not load Project Tracker ticket data.");
      loadCloudTickets(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof ServiceTicketForm>(
    field: K,
    value: ServiceTicketForm[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }


  function refreshSharedPhotos(showStatus = true) {
    const sharedPhotos = loadSharedPhotoPackage(form);
    setForm((prev) => ({ ...prev, ...sharedPhotos }));
    if (showStatus) {
      const count = (sharedPhotos.beforePhotoData?.length || 0) + (sharedPhotos.afterPhotoData?.length || 0);
      setMessage(count ? `Loaded ${count} shared photo(s) from Work Order photo package.` : "No shared Work Order photos found for this ticket number.");
    }
  }

  async function uploadServiceTicketPhotoFile(baseForm: ServiceTicketForm, section: "before" | "after", photoId: string, file: File) {
    const storagePath = buildPhotoStoragePath(baseForm, section, photoId, file.name);
    const { error } = await supabase.storage.from(PHOTO_BUCKET_NAME).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (error) throw error;

    const { data } = supabase.storage.from(PHOTO_BUCKET_NAME).getPublicUrl(storagePath);
    return {
      storagePath,
      publicUrl: data.publicUrl,
      cloudUploadedAt: new Date().toISOString(),
    };
  }

  async function deleteServiceTicketPhotoFile(photo: PhotoItem) {
    if (!photo.storagePath) return;
    const { error } = await supabase.storage.from(PHOTO_BUCKET_NAME).remove([photo.storagePath]);
    if (error) throw error;
  }

  async function addPhotos(section: "before" | "after", files: FileList | null) {
    if (!files?.length) return;
    setMessage(`Adding ${section} service ticket photos locally...`);

    try {
      const baseForm: ServiceTicketForm = {
        ...form,
        id: form.id || crypto.randomUUID(),
        ticketNumber: form.ticketNumber || `ST-${Date.now()}`,
      };

      const added: PhotoItem[] = await Promise.all(
        Array.from(files).map(async (file) => {
          const id = `${section}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const dataUrl = await fileToDataUrl(file);

          return {
            id,
            name: file.name,
            dataUrl,
            caption: "",
            uploadedAt: new Date().toISOString(),
            section,
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
            uploadStatus: "local" as const,
          };
        }),
      );

      setForm((prev) => {
        const next = {
          ...prev,
          id: baseForm.id,
          ticketNumber: baseForm.ticketNumber,
          beforePhotoData: section === "before" ? [...(prev.beforePhotoData || []), ...added] : prev.beforePhotoData || [],
          afterPhotoData: section === "after" ? [...(prev.afterPhotoData || []), ...added] : prev.afterPhotoData || [],
        };
        saveSharedPhotoPackage(next);
        return next;
      });

      setMessage(`${added.length} ${section} photo(s) added for preview. Use Save Photos to Cloud when ready. Local browser storage will keep only cloud-safe photo references, not large image data.`);
    } catch (error) {
      setMessage(`Photo add failed: ${error instanceof Error ? error.message : "Could not read photos"}`);
    }
  }

  async function savePhotosToCloud(section: "before" | "after") {
    const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
    const photos = form[key] || [];
    const pending = photos.filter((photo) => photo.uploadStatus !== "cloud" && photo.dataUrl);

    if (!pending.length) {
      setMessage(`No unsaved ${section} photos to upload.`);
      return;
    }

    setCloudBusy(true);
    setMessage(`Saving ${pending.length} ${section} photo(s) to Supabase...`);

    const baseForm: ServiceTicketForm = {
      ...form,
      id: form.id || crypto.randomUUID(),
      ticketNumber: form.ticketNumber || `ST-${Date.now()}`,
    };

    try {
      const uploaded = await Promise.all(
        photos.map(async (photo) => {
          if (photo.uploadStatus === "cloud" || !photo.dataUrl) return photo;

          try {
            const response = await fetch(photo.dataUrl);
            const blob = await response.blob();
            const file = new File([blob], photo.name || `${photo.id}.jpg`, { type: photo.mimeType || blob.type || "image/jpeg" });
            const cloud = await uploadServiceTicketPhotoFile(baseForm, section, photo.id, file);
            return {
              ...photo,
              ...cloud,
              uploadStatus: "cloud" as const,
              uploadError: "",
            };
          } catch (error) {
            return {
              ...photo,
              uploadStatus: "failed" as const,
              uploadError: error instanceof Error ? error.message : "Supabase upload failed",
            };
          }
        }),
      );

      const next = {
        ...form,
        id: baseForm.id,
        ticketNumber: baseForm.ticketNumber,
        [key]: uploaded,
      } as ServiceTicketForm;

      setForm(next);
      saveSharedPhotoPackage(next);

      const cloudCount = uploaded.filter((photo) => photo.uploadStatus === "cloud").length;
      const failedCount = uploaded.filter((photo) => photo.uploadStatus === "failed").length;
      setMessage(
        failedCount
          ? `${cloudCount} ${section} photo(s) saved to Supabase. ${failedCount} failed and stayed local.`
          : `${cloudCount} ${section} photo(s) saved to Supabase and shared with Work Order.`,
      );
    } finally {
      setCloudBusy(false);
    }
  }

  function updatePhotoCaption(section: "before" | "after", id: string, caption: string) {
    setForm((prev) => {
      const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
      const next = {
        ...prev,
        [key]: (prev[key] || []).map((photo) => (photo.id === id ? { ...photo, caption } : photo)),
      } as ServiceTicketForm;
      saveSharedPhotoPackage(next);
      return next;
    });
  }

  async function removePhoto(section: "before" | "after", id: string) {
    const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
    const photo = (form[key] || []).find((item) => item.id === id);

    if (photo) {
      purgeDeletedPhotoReferences(photo);
    }

    const next = {
      ...form,
      [key]: (form[key] || []).filter((item) => item.id !== id),
    } as ServiceTicketForm;

    setForm(next);
    saveSharedPhotoPackage(next);

    if (photo?.storagePath) {
      try {
        await deleteServiceTicketPhotoFile(photo);
        purgeDeletedPhotoReferences(photo);
        setMessage(`${section === "before" ? "Before" : "After"} photo removed from this ticket, shared package, and Supabase.`);
        return;
      } catch (error) {
        setMessage(
          `${section === "before" ? "Before" : "After"} photo removed from shared records, but Supabase file delete failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
        return;
      }
    }

    setMessage(`${section === "before" ? "Before" : "After"} photo removed from this ticket and shared package.`);
  }

  const fullPropertyAddress = useMemo(() => {
    return [form.property.trim(), form.unit.trim() ? `Unit ${form.unit.trim()}` : ""]
      .filter(Boolean)
      .join(", ");
  }, [form.property, form.unit]);

  const encodedPropertyAddress = encodeURIComponent(fullPropertyAddress);
  const mapSearchUrl = fullPropertyAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodedPropertyAddress}`
    : "";
  const directionsUrl = fullPropertyAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodedPropertyAddress}`
    : "";
  const mapEmbedUrl = fullPropertyAddress
    ? `https://maps.google.com/maps?q=${encodedPropertyAddress}&output=embed`
    : "";

  function openPropertyMap() {
    if (!mapSearchUrl) {
      setMessage("Enter a property address before opening the map.");
      return;
    }

    window.open(mapSearchUrl, "_blank", "noopener,noreferrer");
  }

  function openPropertyDirections() {
    if (!directionsUrl) {
      setMessage("Enter a property address before opening directions.");
      return;
    }

    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  }

  async function copyPropertyAddress() {
    if (!fullPropertyAddress) {
      setMessage("Enter a property address before copying.");
      return;
    }

    try {
      await navigator.clipboard.writeText(fullPropertyAddress);
      setMessage("Property address copied to clipboard.");
    } catch {
      setMessage("Could not copy address. You may need to copy it manually.");
    }
  }


  function applyScopeTemplate(templateLabel: string) {
    setSelectedScopeTemplate(templateLabel);

    const template = SCOPE_TEMPLATES.find((item) => item.label === templateLabel);

    if (!template) {
      setMessage("Select a scope template to auto-fill the scope of work.");
      return;
    }

    const scopeText = includeProtectionClause
      ? `${template.scope}\n\n${SCOPE_PROTECTION_CLAUSE}`
      : template.scope;

    setForm((prev) => ({
      ...prev,
      trade: prev.trade.trim() ? prev.trade : template.trade,
      description: prev.description.trim() ? prev.description : template.label,
      scope: scopeText,
    }));

    setMessage(`${template.label} scope added. You can edit the Scope of Work field before saving or printing.`);
  }

  function buildScopeOfWork() {
    const parts: string[] = [];

    if (form.trade.trim()) {
      parts.push(`Trade / Category: ${form.trade.trim()}`);
    }

    if (form.description.trim()) {
      parts.push(`Problem Reported: ${form.description.trim()}`);
    }

    parts.push(
      "Scope of Work: Diagnose reported issue, perform approved repair work within assigned trade/category, test completed work, clean work area, and document completion."
    );

    if (form.materials.trim()) {
      parts.push(`Expected Materials / Parts: ${form.materials.trim()}`);
    }

    if (form.access.trim()) {
      parts.push(`Access Instructions: ${form.access.trim()}`);
    }

    if (form.approvalLimit.trim()) {
      parts.push(`Approval Limit: ${form.approvalLimit.trim()}`);
    }

    parts.push(`Photo Requirement: ${form.photosRequired || "Before and after photos required."}`);

    setForm((prev) => ({ ...prev, scope: parts.join("\n\n") }));
    setMessage("Scope of work built from the ticket details.");
  }

  function readLocalTickets(): ServiceTicketForm[] {
    try {
      const primary = localStorage.getItem(LOCAL_SERVICE_TICKETS_KEY);
      const legacy = localStorage.getItem("serviceTickets");
      const raw = primary || legacy || "[]";
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocalTickets(tickets: ServiceTicketForm[]) {
    const storageTickets = tickets.map(storageSafeTicket);
    safeSetLocalStorage(LOCAL_SERVICE_TICKETS_KEY, JSON.stringify(storageTickets));
    safeSetLocalStorage("serviceTickets", JSON.stringify(storageTickets));
    setLocalTickets(storageTickets);
  }

  function loadLocalTickets(showStatus = true) {
    const tickets = readLocalTickets();
    setLocalTickets(tickets);
    if (showStatus) {
      setMessage(tickets.length ? "Local service tickets loaded." : "No local service tickets found.");
    }
  }

  function saveLocalTicket(customForm?: ServiceTicketForm, showStatus = true) {
    const base = customForm || form;
    const existing = readLocalTickets();
    const id = base.id || crypto.randomUUID();

    const ticket: ServiceTicketForm = {
      ...base,
      id,
    };

    const next = [ticket, ...existing.filter((item) => item.id !== id)].slice(0, 100);
    writeLocalTickets(next);
    setForm(ticket);
    saveSharedPhotoPackage(ticket);
    setSelectedLocalTicketId(id);
    if (showStatus) setMessage("Service ticket saved locally.");
    return ticket;
  }

  function loadSelectedLocalTicket() {
    const ticket = localTickets.find((item) => item.id === selectedLocalTicketId);

    if (!ticket) {
      setMessage("Select a saved local ticket first.");
      return;
    }

    const withPhotos = { ...emptyForm(), ...ticket };
    const sharedPhotos = loadSharedPhotoPackage(withPhotos);
    setForm({ ...withPhotos, ...sharedPhotos });
    setSelectedTicketId("");
    setMessage("Selected local service ticket loaded.");
  }

  function deleteSelectedLocalTicket() {
    const idToDelete = selectedLocalTicketId || form.id;

    if (!idToDelete) {
      setMessage("Select or load a local ticket before deleting.");
      return;
    }

    const label = form.ticketNumber || "selected local service ticket";
    if (!window.confirm(`Delete local copy of ${label}? Cloud records will not be deleted.`)) return;

    const next = readLocalTickets().filter((item) => item.id !== idToDelete);
    writeLocalTickets(next);
    setSelectedLocalTicketId(next[0]?.id || "");

    if (form.id === idToDelete) {
      setForm(emptyForm());
    }

    setMessage("Local service ticket deleted. Cloud records were not changed.");
  }

  async function saveCloudTicket() {
    setCloudBusy(true);
    setMessage("Saving service ticket photos and ticket to Supabase...");

    try {
      let workingForm: ServiceTicketForm = {
        ...form,
        id: form.id || crypto.randomUUID(),
        ticketNumber: form.ticketNumber || `ST-${Date.now()}`,
      };

      const uploadPendingPhotosForSection = async (section: "before" | "after") => {
        const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
        const photos = workingForm[key] || [];

        if (!photos.some((photo) => photo.uploadStatus !== "cloud" && photo.dataUrl)) return;

        const uploaded = await Promise.all(
          photos.map(async (photo) => {
            if (photo.uploadStatus === "cloud" || !photo.dataUrl) return photo;

            try {
              const response = await fetch(photo.dataUrl);
              const blob = await response.blob();
              const file = new File([blob], photo.name || `${photo.id}.jpg`, {
                type: photo.mimeType || blob.type || "image/jpeg",
              });
              const cloud = await uploadServiceTicketPhotoFile(workingForm, section, photo.id, file);
              return {
                ...photo,
                ...cloud,
                uploadStatus: "cloud" as const,
                uploadError: "",
              };
            } catch (error) {
              return {
                ...photo,
                uploadStatus: "failed" as const,
                uploadError: error instanceof Error ? error.message : "Supabase upload failed",
              };
            }
          }),
        );

        workingForm = {
          ...workingForm,
          [key]: uploaded,
        } as ServiceTicketForm;
      };

      await uploadPendingPhotosForSection("before");
      await uploadPendingPhotosForSection("after");

      setForm(workingForm);
      saveSharedPhotoPackage(workingForm);

      const payload = formToRow(workingForm);
      const { data, error } = await supabase
        .from(SERVICE_TICKET_TABLE)
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        const loaded = rowToForm(data as CloudTicketRow);
        const sharedPhotos = loadSharedPhotoPackage(workingForm);
        setForm({ ...loaded, ...sharedPhotos });
        setSelectedTicketId((data as CloudTicketRow).id);
      }

      const beforeCloud = (workingForm.beforePhotoData || []).filter((photo) => photo.uploadStatus === "cloud").length;
      const afterCloud = (workingForm.afterPhotoData || []).filter((photo) => photo.uploadStatus === "cloud").length;
      const failed = [...(workingForm.beforePhotoData || []), ...(workingForm.afterPhotoData || [])].filter((photo) => photo.uploadStatus === "failed").length;

      setMessage(
        failed
          ? `Service ticket saved to Supabase. ${beforeCloud + afterCloud} photo(s) uploaded; ${failed} photo(s) failed and remain local.`
          : `Service ticket saved to Supabase with ${beforeCloud + afterCloud} shared photo(s).`,
      );
      await loadCloudTickets(false);
    } catch (error) {
      console.error(error);
      const details = error instanceof Error ? error.message : JSON.stringify(error);
      setMessage(`Cloud save failed: ${details}`);
    } finally {
      setCloudBusy(false);
    }
  }

  async function loadCloudTickets(showStatus = true) {
    if (showStatus) setMessage("Loading cloud service tickets...");

    try {
      const { data, error } = await supabase
        .from(SERVICE_TICKET_TABLE)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setSavedTickets((data || []) as CloudTicketRow[]);
      if (showStatus) setMessage("Cloud service tickets loaded.");
    } catch (error) {
      console.error(error);
      if (showStatus) {
        const details = error instanceof Error ? error.message : JSON.stringify(error);
        setMessage(`Cloud load failed: ${details}`);
      }
    }
  }

  function loadSelectedTicket() {
    if (!selectedTicket) {
      setMessage("Select a saved cloud ticket first.");
      return;
    }

    const loaded = rowToForm(selectedTicket);
    const sharedPhotos = loadSharedPhotoPackage(loaded);
    setForm({ ...loaded, ...sharedPhotos });
    setMessage("Selected cloud service ticket loaded with shared photos when available.");
  }

  async function deleteCloudTicket() {
    const idToDelete = form.id || selectedTicketId;

    if (!idToDelete) {
      setMessage("Load or select a cloud service ticket before deleting.");
      return;
    }

    const label = form.ticketNumber || selectedTicket?.ticket_number || "selected service ticket";
    const confirmed = window.confirm("Delete " + label + " from cloud? This cannot be undone.");

    if (!confirmed) return;

    setCloudBusy(true);
    setMessage("Deleting service ticket from cloud...");

    try {
      const { error } = await supabase
        .from(SERVICE_TICKET_TABLE)
        .delete()
        .eq("id", idToDelete);

      if (error) throw error;

      setForm(emptyForm());
      setSelectedTicketId("");
      setMessage("Service ticket deleted from cloud.");
      await loadCloudTickets(false);
    } catch (error) {
      console.error(error);
      const details = error instanceof Error ? error.message : JSON.stringify(error);
      setMessage("Cloud delete failed: " + details);
    } finally {
      setCloudBusy(false);
    }
  }

  function loadPushedWorkOrder() {
    try {
      const raw = localStorage.getItem(WORK_ORDER_SERVICE_TICKET_QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      const items: WorkOrderServiceTicketQueueItem[] = Array.isArray(queue) ? queue : [];

      if (!items.length) {
        setMessage("No pushed work order found. Push one from Work Order Engine first.");
        return;
      }

      const item = items[0];
      const sourceId = item.sourceId || item.workOrderNumber || item.ticketNumber;
      const schedule =
        item.schedule || [item.scheduledDate, item.scheduledTime].filter(Boolean).join(" at ");
      const tenantContactLines = [
        item.tenantPhone ? `Tenant phone: ${item.tenantPhone}` : "",
        item.tenantEmail ? `Tenant email: ${item.tenantEmail}` : "",
      ].filter(Boolean);
      const instructionLines = [
        item.employeeInstructions || "",
        item.access || item.accessNotes ? `Access: ${item.access || item.accessNotes}` : "",
        ...tenantContactLines,
        schedule ? `Schedule: ${schedule}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const importedTicket: ServiceTicketForm = {
        ...emptyForm(),
        id: crypto.randomUUID(),
        ticketNumber: item.ticketNumber || item.workOrderNumber || "",
        property: buildPropertyFromWorkOrder(item),
        unit: item.unit || "",
        tenant: item.tenant || item.tenantName || "",
        assignedTo: item.assignedTo || "",
        priority: item.priority || "Normal",
        status: item.status || "Open",
        trade: item.trade || item.category || "",
        description: item.description || item.issueDescription || "",
        scope: item.scope || item.scopeOfWork || "",
        employeeInstructions: instructionLines,
        approvalLimit: item.approvalLimit || "",
        materials: typeof item.materials === "number" ? String(item.materials) : item.materials || "",
        schedule,
        access: item.access || item.accessNotes || "",
        materialCost: formatMoneyText(item.materialCost || item.materials),
        notes: item.notes || "",
        beforePhotoData: item.beforePhotoData || item.rawWorkOrder?.beforePhotoData || [],
        afterPhotoData: item.afterPhotoData || item.rawWorkOrder?.afterPhotoData || [],
      };

      const sharedPhotos = loadSharedPhotoPackage(importedTicket, [String(sourceId || ""), item.photoPackageKey || ""]);
      const importedWithPhotos = {
        ...importedTicket,
        beforePhotoData: importedTicket.beforePhotoData.length ? importedTicket.beforePhotoData : sharedPhotos.beforePhotoData,
        afterPhotoData: importedTicket.afterPhotoData.length ? importedTicket.afterPhotoData : sharedPhotos.afterPhotoData,
      };
      saveSharedPhotoPackage(importedWithPhotos);
      const savedTicket = saveLocalTicket(importedWithPhotos, false);
      setForm(savedTicket);
      setSelectedTicketId("");

      const filtered = items.filter(
        (entry) => (entry.sourceId || entry.workOrderNumber || entry.ticketNumber) !== sourceId,
      );
      localStorage.setItem(WORK_ORDER_SERVICE_TICKET_QUEUE_KEY, JSON.stringify(filtered));
      setActiveSection("intake");
      setMessage("Pushed work order loaded and saved locally. Use Save Cloud when ready to share or recall from another device.");
    } catch (error) {
      console.error(error);
      setMessage("Could not load pushed work order from Work Order Engine.");
    }
  }

  function newTicket() {
    setForm(emptyForm());
    setSelectedTicketId("");
    setSelectedLocalTicketId("");
    setMessage("Ready for a new service ticket.");
  }

  function printTicket() {
    window.print();
  }

  function sendToWorkOrderPricing() {
    const pricingPayload = {
      sourceId: form.id || form.ticketNumber,
      source: "Service Ticket",
      ticketNumber: form.ticketNumber,
      workOrderNumber: form.ticketNumber,
      status: form.status,
      priority: form.priority,
      propertyAddress: form.property,
      property: form.property,
      unit: form.unit,
      requestorName: form.tenant,
      tenantName: form.tenant,
      trade: form.trade,
      category: form.trade || "General Maintenance",
      issueCategory: form.trade || "General Maintenance",
      issueDescription: form.description,
      problemDescription: form.description,
      scopeOfWork: form.scope,
      scope: form.scope,
      description: form.scope || form.description,
      employeeInstructions: form.employeeInstructions,
      accessNotes: form.access,
      access: form.access,
      maintenanceLimit: form.approvalLimit,
      assignedTo: form.assignedTo,
      scheduledDate: form.schedule,
      scheduledTime: "",
      materials: form.materials,
      laborHours: form.laborHours,
      materialCost: moneyToNumber(form.materialCost),
      completionNotes: form.notes,
      completedBy: form.completedBy,
      completedDate: form.completedDate,
      beforePhotoData: form.beforePhotoData || [],
      afterPhotoData: form.afterPhotoData || [],
      rawServiceTicket: form,
      createdAt: new Date().toISOString(),
      route: WORK_ORDER_PRICING_ROUTE,
    };

    try {
      const rawQueue = localStorage.getItem(WORK_ORDER_PRICING_QUEUE_KEY);
      const queue = rawQueue ? JSON.parse(rawQueue) : [];
      const list = Array.isArray(queue) ? queue : [];
      const currentKey = pricingPayload.sourceId || pricingPayload.ticketNumber;
      const filtered = list.filter(
        (item: { sourceId?: string; ticketNumber?: string; workOrderNumber?: string }) =>
          (item.sourceId || item.ticketNumber || item.workOrderNumber) !== currentKey,
      );

      localStorage.setItem(
        WORK_ORDER_PRICING_QUEUE_KEY,
        JSON.stringify([pricingPayload, ...filtered]),
      );
      localStorage.setItem("five_tools_work_order_pricing_seed_v1", JSON.stringify(pricingPayload));
      setMessage("Service ticket sent to Work Order Pricing.");
      window.location.href = WORK_ORDER_PRICING_ROUTE;
    } catch {
      setMessage("Could not send service ticket to Work Order Pricing.");
    }
  }


  function importPricingFromWorkOrderPricing() {
    try {
      const draftRaw = localStorage.getItem(SERVICE_TICKET_PRICING_DRAFT_KEY);
      const queueRaw = localStorage.getItem(SERVICE_TICKET_PRICING_RETURN_QUEUE_KEY);
      const draft = draftRaw ? JSON.parse(draftRaw) : null;
      const queue = queueRaw ? JSON.parse(queueRaw) : [];
      const list = [draft, ...(Array.isArray(queue) ? queue : [])].filter(Boolean);

      if (!list.length) {
        setMessage("No returned Work Order Pricing found for this service ticket.");
        return;
      }

      const currentKeys = [form.id, form.ticketNumber].filter(Boolean).map(String);
      const match =
        list.find((item: { sourceId?: string; ticketNumber?: string; workOrderNumber?: string }) =>
          [item.sourceId, item.ticketNumber, item.workOrderNumber]
            .filter(Boolean)
            .map(String)
            .some((key) => currentKeys.includes(key)),
        ) || list[0];

      const estimateTotal = moneyToNumber(match.estimateTotal || match.total || match.grandTotal || match.subtotal);
      const materialTotal = moneyToNumber(match.materialsTotal);
      const laborTotal = moneyToNumber(match.laborTotal);
      const tripFee = moneyToNumber(match.tripFee);
      const taxAmount = moneyToNumber(match.taxAmount);
      const lineItems = Array.isArray(match.lineItems) ? match.lineItems : [];

      const pricingSummary = [
        "",
        "Work Order Pricing Imported:",
        `Pricing Record: ${match.pricingRecordId || "--"}`,
        `Estimate Status: ${match.estimateStatus || "Completed"}`,
        `Materials: $${materialTotal.toFixed(2)}`,
        `Labor/Packages: $${laborTotal.toFixed(2)}`,
        `Trip/Other: $${tripFee.toFixed(2)}`,
        `Tax: $${taxAmount.toFixed(2)}`,
        `Total: $${estimateTotal.toFixed(2)}`,
        lineItems.length
          ? `Line Items:
${lineItems
              .map(
                (line: any) =>
                  `- ${line.description || "Line Item"}: $${moneyToNumber(line.total).toFixed(2)}`,
              )
              .join("\n")}`
          : "Line Items: none returned",
      ].join("\n");

      setForm((current) => {
        const updated: ServiceTicketForm = {
          ...current,
          materialCost: estimateTotal ? estimateTotal.toFixed(2) : current.materialCost,
          notes: `${current.notes || ""}${pricingSummary}`.trim(),
        };
        saveLocalTicket(updated, false);
        return updated;
      });

      const matchKey = String(match.sourceId || match.ticketNumber || match.workOrderNumber || "");
      if (matchKey && Array.isArray(queue)) {
        const filtered = queue.filter(
          (item: { sourceId?: string; ticketNumber?: string; workOrderNumber?: string }) =>
            String(item.sourceId || item.ticketNumber || item.workOrderNumber || "") !== matchKey,
        );
        localStorage.setItem(SERVICE_TICKET_PRICING_RETURN_QUEUE_KEY, JSON.stringify(filtered));
      }
      localStorage.removeItem(SERVICE_TICKET_PRICING_DRAFT_KEY);
      setActiveSection("completion");
      setMessage("Returned Work Order Pricing imported into this service ticket.");
    } catch (error) {
      console.error(error);
      setMessage("Could not import returned Work Order Pricing.");
    }
  }


  const printGeneratedDate = new Date().toLocaleDateString();

  const displayValue = (value: string, fallback = "—") => {
    const cleaned = value.trim();
    return cleaned ? cleaned : fallback;
  };

  const printSchedule = form.schedule
    ? new Date(form.schedule).toLocaleString([], {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  const printDescriptionLines = form.description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const printScopeLines = form.scope
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const printMaterialsLines = form.materials
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const printNotesLines = form.notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);


  return (
<>
      <style>{`
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: letter;
            margin: 0.55in;
          }

          html,
          body {
            background: #ffffff !important;
            color: #111111 !important;
          }

          .screen-only {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          #service-ticket-print {
            font-family: Arial, Helvetica, sans-serif;
            color: #111111;
            background: #ffffff;
            font-size: 10.5pt;
            line-height: 1.42;
          }

          #service-ticket-print p {
            margin: 0 0 5px 0;
          }

          #service-ticket-print .print-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            border-bottom: 2px solid #111111;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }

          #service-ticket-print .brand {
            font-size: 18pt;
            font-weight: 800;
            letter-spacing: 0.02em;
          }

          #service-ticket-print .subtitle {
            margin-top: 3px;
            color: #444444;
            font-size: 9.5pt;
          }

          #service-ticket-print .ticket-title {
            text-align: right;
            font-size: 20pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          #service-ticket-print .ticket-number {
            margin-top: 4px;
            text-align: right;
            color: #333333;
            font-size: 10pt;
            font-weight: 700;
          }

          #service-ticket-print .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }

          #service-ticket-print .info-box {
            border: 1px solid #c9c9c9;
            padding: 8px 9px;
            min-height: 42px;
          }

          #service-ticket-print .info-label {
            display: block;
            color: #555555;
            font-size: 7.5pt;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          #service-ticket-print .info-value {
            display: block;
            margin-top: 3px;
            font-size: 10pt;
            font-weight: 700;
          }

          #service-ticket-print .section {
            break-inside: avoid;
            margin-top: 15px;
          }

          #service-ticket-print .section-title {
            border-bottom: 1px solid #111111;
            padding-bottom: 4px;
            margin-bottom: 8px;
            font-size: 10pt;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          #service-ticket-print .body-box {
            border: 1px solid #d4d4d4;
            padding: 10px 12px;
            min-height: 34px;
          }

          #service-ticket-print .print-list {
            margin: 0;
            padding-left: 18px;
          }

          #service-ticket-print .print-list li {
            margin-bottom: 4px;
          }

          #service-ticket-print .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }

          #service-ticket-print .completion-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }

          #service-ticket-print .photo-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }

          #service-ticket-print .photo-card {
            border: 1px solid #d4d4d4;
            padding: 5px;
            break-inside: avoid;
          }

          #service-ticket-print .photo-card img {
            width: 100%;
            height: 120px;
            object-fit: cover;
            display: block;
          }

          #service-ticket-print .photo-caption {
            margin-top: 4px;
            font-size: 8pt;
            color: #444444;
            font-weight: 700;
          }

          #service-ticket-print .footer {
            margin-top: 24px;
            border-top: 1px solid #999999;
            padding-top: 8px;
            color: #555555;
            font-size: 8.5pt;
          }
        }
      `}</style>

      <div className="screen-only min-h-screen bg-[#f3eadf] text-[#111111]">
        <header className="border-b border-[#d8c4aa] bg-[#f7efe5]">
          <div className="mx-auto flex max-w-[1450px] flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/5tools-logo.png"
                alt="5 Tools"
                className="h-20 w-auto"
              />
              <div>
                <div className="text-xs font-black uppercase tracking-[0.32em] text-[#9a5a16]">5 Tools Field Service</div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-[#2b190f]">Service Ticket</h1>
                <p className="mt-1 text-sm font-semibold text-[#5f4a39]">Employee work order, field instructions, map tools, completion notes, and work order pricing handoff.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="rounded-xl border border-[#b38b66] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">← Dashboard</Link>
              <Link href="/work-order-pricing" className="rounded-xl border border-[#b38b66] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Pricing</Link>
              <button type="button" onClick={newTicket} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">New</button>
              <button type="button" onClick={loadPushedWorkOrder} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Load Pushed WO</button>
              <button type="button" onClick={() => printTicket()} className="rounded-xl bg-[#8a541c] px-4 py-2 text-sm font-black text-white hover:bg-[#6f4526]">Print / PDF</button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6">
          {message ? (
            <div className="mb-5 rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] px-4 py-3 text-sm font-bold text-[#3c2719] shadow-sm">
              Status: {message}
            </div>
          ) : null}

          <section className="mb-5 rounded-3xl border border-[#d8c4aa] bg-[#fffaf4] p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#9a5a16]">Current Ticket</div>
                <div className="mt-1 text-2xl font-black text-[#2b190f]">{form.ticketNumber || "New Ticket"}</div>
                <div className="mt-1 truncate text-sm font-semibold text-[#5f4a39]">{form.property || "No property selected"}</div>
              </div>
              <div className="rounded-2xl border border-[#d8c4aa] bg-white p-4">
                <div className="text-xs font-black uppercase tracking-wide text-[#5f4a39]">Status / Priority</div>
                <div className="mt-2 text-xl font-black text-[#2b190f]">{form.status || "Open"}</div>
                <div className="text-sm font-semibold text-[#9a5a16]">{form.priority || "Normal"}</div>
              </div>
              <div className="rounded-2xl border border-[#d8c4aa] bg-white p-4">
                <div className="text-xs font-black uppercase tracking-wide text-[#5f4a39]">Trade</div>
                <div className="mt-2 text-xl font-black text-[#2b190f]">{form.trade || "Not Set"}</div>
                <div className="text-sm font-semibold text-[#9a5a16]">Assigned: {form.assignedTo || "—"}</div>
              </div>
              <div className="rounded-2xl border border-[#d8c4aa] bg-white p-4">
                <div className="text-xs font-black uppercase tracking-wide text-[#5f4a39]">Cost Snapshot</div>
                <div className="mt-2 text-xl font-black text-[#2b190f]">${moneyToNumber(form.materialCost).toFixed(2)}</div>
                <div className="text-sm font-semibold text-[#9a5a16]">{form.laborHours || "0.00"} labor hrs</div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <section className="rounded-3xl border border-[#d8c4aa] bg-[#fffaf4] p-5 shadow-sm">
                <h2 className="text-xl font-black text-[#2b190f]">Ticket Sections</h2>
                <div className="mt-4 grid gap-3">
                  {[
                    ["intake", "Work Order Intake", "Property, tenant, schedule, issue"],
                    ["scope", "Scope & Instructions", "Templates, scope, materials, approvals"],
                    ["map", "Map & Dispatch", "Map, directions, copy address"],
                    ["completion", "Completion", "Labor, materials, notes, close-out"],
                    ["cloud", "Cloud Tickets", "Save, load, delete"],
                    ["actions", "Actions", "Pricing, print, local save"],
                  ].map(([key, title, desc]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveSection(key as typeof activeSection)}
                      className={`flex items-center justify-between border px-4 py-3 text-left transition ${
                        activeSection === key
                          ? "border-[#4a2f1d] bg-[#4a2f1d] text-white"
                          : "border-[#d8c4aa] bg-white text-[#2f1f14] hover:bg-[#fbf6ef]"
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-black">{title}</span>
                        <span className={`mt-1 block text-xs ${activeSection === key ? "text-[#f7efe5]" : "text-[#6f5a45]"}`}>{desc}</span>
                      </span>
                      <span>→</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-[#d8c4aa] bg-[#fffaf4] p-5 shadow-sm">
                <h2 className="text-lg font-black text-[#2b190f]">Fast Actions</h2>
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={() => saveLocalTicket()} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Save Local</button>
                  <button type="button" onClick={() => saveCloudTicket()} disabled={cloudBusy} className="rounded-xl bg-[#8a541c] px-4 py-2.5 text-sm font-black text-white hover:bg-[#6f4526] disabled:opacity-60">{cloudBusy ? "Saving..." : "Save Cloud"}</button>
                  <button type="button" onClick={() => sendToWorkOrderPricing()} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Send to Work Order Pricing</button>
                  <button type="button" onClick={() => importPricingFromWorkOrderPricing()} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Import Pricing Return</button>
                  <button type="button" onClick={() => refreshSharedPhotos(true)} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Refresh Shared Photos</button>
                  <button type="button" onClick={() => printTicket()} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Print Ticket</button>
                </div>
              </section>
            </aside>

            <section className="rounded-3xl border border-[#d8c4aa] bg-white p-5 shadow-sm">
              {activeSection === "intake" ? (
                <div>
                  <h2 className="text-2xl font-black text-[#2b190f]">Work Order Intake</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Primary job information, property details, tenant contact, and issue description.</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <div><label className={labelClass}>Ticket #</label><input value={form.ticketNumber} onChange={(e) => update("ticketNumber", e.target.value)} className={inputClass} placeholder="Ticket #" /></div>
                    <div><label className={labelClass}>Status</label><select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputClass}><option>Open</option><option>Scheduled</option><option>In Progress</option><option>Completed</option><option>Closed</option><option>Canceled</option></select></div>
                    <div><label className={labelClass}>Priority</label><select value={form.priority} onChange={(e) => update("priority", e.target.value)} className={inputClass}><option>Normal</option><option>Low</option><option>High</option><option>Urgent</option></select></div>
                    <div><label className={labelClass}>Trade / Category</label><input value={form.trade} onChange={(e) => update("trade", e.target.value)} className={inputClass} placeholder="Plumbing, electrical..." /></div>
                    <div><label className={labelClass}>Assigned To</label><input value={form.assignedTo} onChange={(e) => update("assignedTo", e.target.value)} className={inputClass} placeholder="Employee / vendor" /></div>
                  </div>
                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-4">
                      <h3 className="text-sm font-black uppercase tracking-wide text-[#2b190f]">Property / Unit</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_150px]">
                        <div><label className={labelClass}>Property Address</label><input value={form.property} onChange={(e) => update("property", e.target.value)} className={inputClass} placeholder="Property address" /></div>
                        <div><label className={labelClass}>Unit</label><input value={form.unit} onChange={(e) => update("unit", e.target.value)} className={inputClass} placeholder="Unit" /></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={openPropertyMap} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Map</button>
                        <button type="button" onClick={openPropertyDirections} className="rounded-xl bg-[#8a541c] px-4 py-2 text-sm font-black text-white hover:bg-[#6f4526]">Directions</button>
                        <button type="button" onClick={copyPropertyAddress} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Copy</button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-4">
                      <h3 className="text-sm font-black uppercase tracking-wide text-[#2b190f]">Schedule / Contact</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div><label className={labelClass}>Scheduled Date / Time</label><input type="datetime-local" value={form.schedule} onChange={(e) => update("schedule", e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Tenant Contact</label><input value={form.tenant} onChange={(e) => update("tenant", e.target.value)} className={inputClass} placeholder="Tenant contact" /></div>
                      </div>
                      <div className="mt-3"><label className={labelClass}>Access Instructions</label><textarea value={form.access} onChange={(e) => update("access", e.target.value)} rows={4} className={inputClass} placeholder="Lockbox, gate code, pets, parking, etc." /></div>
                    </div>
                  </div>
                  <div className="mt-5"><label className={labelClass}>Issue Description</label><textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={6} className={inputClass} placeholder="Describe the reported issue and location." /></div>
                </div>
              ) : null}

              {activeSection === "scope" ? (
                <div>
                  <h2 className="text-2xl font-black text-[#2b190f]">Scope & Instructions</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Build the field scope, select templates, and list materials or approval limits.</p>
                  <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-4">
                      <label className={labelClass}>Scope Template</label>
                      <select value={selectedScopeTemplate} onChange={(e) => applyScopeTemplate(e.target.value)} className={inputClass}>
                        <option value="">Select template</option>
                        {SCOPE_TEMPLATES.map((template) => <option key={template.label} value={template.label}>{template.label}</option>)}
                      </select>
                      <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#3c2719]"><input type="checkbox" checked={includeProtectionClause} onChange={(e) => setIncludeProtectionClause(e.target.checked)} /> Include protection clause</label>
                      <button type="button" onClick={buildScopeOfWork} className="mt-4 w-full rounded-xl bg-[#8a541c] px-4 py-2.5 text-sm font-black text-white hover:bg-[#6f4526]">Build Scope from Ticket</button>
                      <div className="mt-4"><label className={labelClass}>Approval Limit</label><input value={form.approvalLimit} onChange={(e) => update("approvalLimit", e.target.value)} className={inputClass} placeholder="$500 / call office before exceeding" /></div>
                      <div className="mt-4"><label className={labelClass}>Photo Requirement</label><input value={form.photosRequired} onChange={(e) => update("photosRequired", e.target.value)} className={inputClass} placeholder="Before and after photos required" /></div>
                    </div>
                    <div className="space-y-4">
                      <div><label className={labelClass}>Scope of Work</label><textarea value={form.scope} onChange={(e) => update("scope", e.target.value)} rows={10} className={inputClass} /></div>
                      <div><label className={labelClass}>Employee Instructions</label><textarea value={form.employeeInstructions} onChange={(e) => update("employeeInstructions", e.target.value)} rows={5} className={inputClass} placeholder="Call office before extra work, document findings, photo requirements." /></div>
                      <div><label className={labelClass}>Materials / Parts Needed</label><textarea value={form.materials} onChange={(e) => update("materials", e.target.value)} rows={4} className={inputClass} /></div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSection === "map" ? (
                <div>
                  <h2 className="text-2xl font-black text-[#2b190f]">Map & Dispatch</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Use this section for property directions, dispatch checks, and copying the jobsite address.</p>
                  <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
                    <div className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-4">
                      <div className="text-xs font-black uppercase tracking-wide text-[#9a5a16]">Jobsite</div>
                      <div className="mt-2 text-2xl font-black text-[#2b190f]">{fullPropertyAddress || "No address entered"}</div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <button type="button" onClick={openPropertyMap} className="rounded-xl border border-[#b38b66] bg-white px-4 py-3 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Open Map</button>
                        <button type="button" onClick={openPropertyDirections} className="rounded-xl bg-[#8a541c] px-4 py-3 text-sm font-black text-white hover:bg-[#6f4526]">Directions</button>
                        <button type="button" onClick={copyPropertyAddress} className="rounded-xl border border-[#b38b66] bg-white px-4 py-3 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Copy Address</button>
                      </div>
                      <div className="mt-4 rounded-xl border border-[#d8c4aa] bg-white p-4 text-sm leading-6 text-[#5f4a39]">
                        <strong className="text-[#2b190f]">Dispatch Notes</strong><br />
                        Assigned: {form.assignedTo || "—"}<br />
                        Schedule: {form.schedule || "—"}<br />
                        Access: {form.access || "—"}
                      </div>
                    </div>
                    <div className="min-h-[360px] overflow-hidden rounded-2xl border border-[#d8c4aa] bg-[#fffaf4]">
                      {mapEmbedUrl ? (
                        <iframe title="Property map" src={mapEmbedUrl} className="h-[420px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                      ) : (
                        <div className="flex h-[420px] items-center justify-center p-6 text-center text-sm font-bold text-[#7a4d20]">Enter a property address to preview the map.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSection === "completion" ? (
                <div>
                  <h2 className="text-2xl font-black text-[#2b190f]">Completion</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Close out labor, material cost, completion notes, and employee information.</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div><label className={labelClass}>Labor Hours</label><input value={form.laborHours} onChange={(e) => update("laborHours", e.target.value)} className={inputClass} placeholder="0.00" /></div>
                    <div><label className={labelClass}>Material Cost</label><input value={form.materialCost} onChange={(e) => update("materialCost", e.target.value)} className={inputClass} placeholder="0.00" /></div>
                    <div><label className={labelClass}>Completed By</label><input value={form.completedBy} onChange={(e) => update("completedBy", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Completed Date</label><input type="date" value={form.completedDate} onChange={(e) => update("completedDate", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="mt-5"><label className={labelClass}>Completion Notes</label><textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={9} className={inputClass} placeholder="Work performed, findings, additional repairs needed, photos, follow-up." /></div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => refreshSharedPhotos(true)} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Load / Refresh Shared Work Order Photos</button>
                  </div>
                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <PhotoPanel
                      title="Before Photos"
                      photos={form.beforePhotoData || []}
                      onAddPhotos={(files) => addPhotos("before", files)}
                      onCaptionChange={(id, caption) => updatePhotoCaption("before", id, caption)}
                      onRemovePhoto={(id) => removePhoto("before", id)}
                      onSaveCloud={() => savePhotosToCloud("before")}
                    />
                    <PhotoPanel
                      title="After Photos"
                      photos={form.afterPhotoData || []}
                      onAddPhotos={(files) => addPhotos("after", files)}
                      onCaptionChange={(id, caption) => updatePhotoCaption("after", id, caption)}
                      onRemovePhoto={(id) => removePhoto("after", id)}
                      onSaveCloud={() => savePhotosToCloud("after")}
                    />
                  </div>
                </div>
              ) : null}

              {activeSection === "cloud" ? (
                <div>
                  <h2 className="text-2xl font-black text-[#2b190f]">Saved Tickets</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Save and recall service tickets locally or from Supabase cloud.</p>

                  <div className="mt-5 rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-4">
                    <label className={labelClass}>Saved Local Tickets</label>
                    <select value={selectedLocalTicketId} onChange={(e) => setSelectedLocalTicketId(e.target.value)} className={inputClass}>
                      <option value="">Select Local Ticket</option>
                      {localTickets.map((ticket) => (
                        <option key={ticket.id} value={ticket.id}>
                          {(ticket.ticketNumber || "No Ticket #") + " — " + (ticket.property || "No Property") + " — " + (ticket.status || "Open")}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => loadLocalTickets(true)} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee]">Local List</button>
                      <button type="button" onClick={loadSelectedLocalTicket} disabled={!selectedLocalTicketId} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee] disabled:opacity-60">Load Local</button>
                      <button type="button" onClick={() => saveLocalTicket()} className="rounded-xl bg-[#8a541c] px-4 py-2.5 text-sm font-black text-white hover:bg-[#6f4526]">Save Local</button>
                      <button type="button" onClick={deleteSelectedLocalTicket} disabled={!selectedLocalTicketId && !form.id} className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-60">Delete Local</button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-4">
                    <label className={labelClass}>Saved Cloud Tickets</label>
                    <select value={selectedTicketId} onChange={(e) => setSelectedTicketId(e.target.value)} className={inputClass}>
                      <option value="">New record / no selection</option>
                      {savedTickets.map((ticket) => (
                        <option key={ticket.id} value={ticket.id}>
                          {(ticket.ticket_number || "Ticket")} — {(ticket.property || "No property")} — {(ticket.status || "Status")}
                        </option>
                      ))}
                    </select>
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      <button type="button" onClick={() => loadCloudTickets(true)} disabled={cloudBusy} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee] disabled:opacity-60">Cloud List</button>
                      <button type="button" onClick={loadSelectedTicket} disabled={cloudBusy || !selectedTicketId} className="rounded-xl border border-[#b38b66] bg-white px-4 py-2.5 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ee] disabled:opacity-60">Load Selected</button>
                      <button type="button" onClick={() => saveCloudTicket()} disabled={cloudBusy} className="rounded-xl bg-[#8a541c] px-4 py-2.5 text-sm font-black text-white hover:bg-[#6f4526] disabled:opacity-60">Save Cloud</button>
                      <button type="button" onClick={deleteCloudTicket} disabled={cloudBusy || (!form.id && !selectedTicketId)} className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-60">Delete Cloud</button>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSection === "actions" ? (
                <div>
                  <h2 className="text-2xl font-black text-[#2b190f]">Actions</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Quick actions for field ticket processing.</p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <button type="button" onClick={newTicket} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">New Ticket</span><span className="mt-1 block text-sm text-[#5f4a39]">Clear screen and start fresh.</span></button>
                    <button type="button" onClick={loadPushedWorkOrder} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Load Pushed Work Order</span><span className="mt-1 block text-sm text-[#5f4a39]">Import the work order sent from Work Order Engine.</span></button>
                    <button type="button" onClick={() => saveLocalTicket()} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Save Local</span><span className="mt-1 block text-sm text-[#5f4a39]">Save ticket to browser storage.</span></button>
                    <button type="button" onClick={() => saveCloudTicket()} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Save Cloud</span><span className="mt-1 block text-sm text-[#5f4a39]">Save ticket to Supabase.</span></button>
                    <button type="button" onClick={() => sendToWorkOrderPricing()} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Send to Work Order Pricing</span><span className="mt-1 block text-sm text-[#5f4a39]">Push data to Work Order Pricing.</span></button>
                    <button type="button" onClick={() => importPricingFromWorkOrderPricing()} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Import Pricing Return</span><span className="mt-1 block text-sm text-[#5f4a39]">Pull completed pricing back from Work Order Pricing.</span></button>
                    <button type="button" onClick={() => printTicket()} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Print / PDF</span><span className="mt-1 block text-sm text-[#5f4a39]">Print professional ticket.</span></button>
                    <button type="button" onClick={() => refreshSharedPhotos(true)} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Refresh Shared Photos</span><span className="mt-1 block text-sm text-[#5f4a39]">Pull the Work Order photo package again.</span></button>
                    <button type="button" onClick={openPropertyDirections} className="rounded-2xl border border-[#d8c4aa] bg-[#fffaf4] p-5 text-left hover:bg-[#fbf6ef]"><span className="block text-lg font-black text-[#2b190f]">Open Directions</span><span className="mt-1 block text-sm text-[#5f4a39]">Launch Google directions.</span></button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>

    <section id="service-ticket-print" className="print-only">
      <div className="print-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="/5tools-logo.png"
            alt="5 Tools"
            style={{ width: "90px", height: "auto" }}
          />
          <div>
            <div className="brand">5 Tools Handyman Services</div>
            <div className="subtitle">Employee Work Order / Service Ticket</div>
          </div>
        </div>
        <div>
          <div className="ticket-title">Service Ticket</div>
          <div className="ticket-number">Ticket #: {displayValue(form.ticketNumber)}</div>
        </div>
      </div>

      <div className="summary-grid">
        <div className="info-box">
          <span className="info-label">Property</span>
          <span className="info-value">{displayValue(form.property)}</span>
        </div>
        <div className="info-box">
          <span className="info-label">Unit</span>
          <span className="info-value">{displayValue(form.unit)}</span>
        </div>
        <div className="info-box">
          <span className="info-label">Tenant / Contact</span>
          <span className="info-value">{displayValue(form.tenant)}</span>
        </div>
        <div className="info-box">
          <span className="info-label">Generated</span>
          <span className="info-value">{printGeneratedDate}</span>
        </div>
        <div className="info-box">
          <span className="info-label">Assigned To</span>
          <span className="info-value">{displayValue(form.assignedTo)}</span>
        </div>
        <div className="info-box">
          <span className="info-label">Trade</span>
          <span className="info-value">{displayValue(form.trade)}</span>
        </div>
        <div className="info-box">
          <span className="info-label">Priority</span>
          <span className="info-value">{displayValue(form.priority)}</span>
        </div>
        <div className="info-box">
          <span className="info-label">Status</span>
          <span className="info-value">{displayValue(form.status)}</span>
        </div>
      </div>

      <div className="two-column">
        <div className="section">
          <div className="section-title">Schedule / Access</div>
          <div className="body-box">
            <p><strong>Scheduled For:</strong> {printSchedule}</p>
            <p><strong>Access:</strong> {displayValue(form.access)}</p>
            <p><strong>Approval Limit:</strong> {displayValue(form.approvalLimit)}</p>
            <p><strong>Photos:</strong> {displayValue(form.photosRequired)}</p>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Office / Employee Notes</div>
          <div className="body-box">
            {form.employeeInstructions.trim() ? (
              <p>{form.employeeInstructions}</p>
            ) : (
              <p>—</p>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Service Request</div>
        <div className="body-box">
          {printDescriptionLines.length ? (
            printDescriptionLines.map((line) => <p key={line}>{line}</p>)
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Scope of Work</div>
        <div className="body-box">
          {printScopeLines.length ? (
            <ul className="print-list">
              {printScopeLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Materials / Parts Needed</div>
        <div className="body-box">
          {printMaterialsLines.length ? (
            <ul className="print-list">
              {printMaterialsLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Completion</div>
        <div className="completion-grid">
          <div className="info-box">
            <span className="info-label">Labor Hours</span>
            <span className="info-value">{displayValue(form.laborHours)}</span>
          </div>
          <div className="info-box">
            <span className="info-label">Material Cost</span>
            <span className="info-value">{displayValue(form.materialCost)}</span>
          </div>
          <div className="info-box">
            <span className="info-label">Completed By</span>
            <span className="info-value">{displayValue(form.completedBy)}</span>
          </div>
          <div className="info-box">
            <span className="info-label">Completed Date</span>
            <span className="info-value">{displayValue(form.completedDate)}</span>
          </div>
        </div>
        <div className="body-box" style={{ marginTop: "8px" }}>
          {printNotesLines.length ? (
            printNotesLines.map((line) => <p key={line}>{line}</p>)
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      {form.beforePhotoData.length || form.afterPhotoData.length ? (
        <div className="section">
          <div className="section-title">Before / After Photos</div>
          {form.beforePhotoData.length ? (
            <div className="body-box" style={{ marginBottom: "8px" }}>
              <p><strong>Before Photos</strong></p>
              <div className="photo-grid">
                {form.beforePhotoData.map((photo) => getPhotoDisplaySrc(photo) ? (
                  <div key={photo.id} className="photo-card">
                    <img src={getPhotoDisplaySrc(photo)} alt={photo.caption || photo.name} />
                    <div className="photo-caption">{photo.caption || photo.name}</div>
                  </div>
                ) : null)}
              </div>
            </div>
          ) : null}
          {form.afterPhotoData.length ? (
            <div className="body-box">
              <p><strong>After Photos</strong></p>
              <div className="photo-grid">
                {form.afterPhotoData.map((photo) => getPhotoDisplaySrc(photo) ? (
                  <div key={photo.id} className="photo-card">
                    <img src={getPhotoDisplaySrc(photo)} alt={photo.caption || photo.name} />
                    <div className="photo-caption">{photo.caption || photo.name}</div>
                  </div>
                ) : null)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="footer">
        5 Tools Handyman Services — This service ticket is based on the requested work and visible conditions at the time of service. This document is not a licensed home inspection report. Additional concealed damage, unsafe conditions, or work outside the approved scope requires office approval before proceeding.
      </div>
    </section>
</>
  );
}
