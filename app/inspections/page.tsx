"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../lib/supabase";

type SavedPhoto = {
  id?: string;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  publicUrl?: string;
};

type InspectionItem = {
  id: string;
  name: string;
  condition: string;
  comments: string;
  repairNotes: string;
};

type Area = {
  id: string;
  name: string;
  overallComments: string;
  repairNotes: string;
  photos: File[];
  savedPhotos: SavedPhoto[];
  items: InspectionItem[];
};

type SavedInspectionSummary = {
  id: string;
  property_name: string;
  property_address: string | null;
  inspection_date: string | null;
  inspector_name: string | null;
  created_at: string;
};

type LocalInspectionStoredPhoto = {
  id?: string;
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
  publicUrl?: string;
};

type LocalInspectionAreaRecord = {
  id: string;
  name: string;
  overallComments: string;
  repairNotes: string;
  savedPhotos: LocalInspectionStoredPhoto[];
  items: InspectionItem[];
};

type LocalInspectionRecord = {
  id: string;
  property_name: string;
  property_address: string | null;
  inspection_date: string | null;
  inspector_name: string | null;
  created_at: string;
  source: "local";
  areas: LocalInspectionAreaRecord[];
};

type InspectionAreaRow = {
  id: string;
  area_name: string;
  overall_comments: string | null;
  repair_notes: string | null;
  sort_order: number;
};

type InspectionItemRow = {
  area_id: string;
  item_name: string | null;
  condition: string | null;
  comments: string | null;
  repair_notes: string | null;
  sort_order: number;
};

type InspectionPhotoRow = {
  id: string;
  area_name: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  sort_order: number;
};

type StatusType = "info" | "success" | "error";

type StatusState = {
  type: StatusType;
  message: string;
};

const COMMON_AREAS = [
  "Exterior",
  "Entry",
  "Living Room",
  "Dining Room",
  "Kitchen",
  "Hallway",
  "Bathroom",
  "Bedroom 1",
  "Bedroom 2",
  "Bedroom 3",
  "Laundry",
  "Garage",
  "Utility Room",
  "Attic",
  "Basement",
  "Other",
] as const;

const CONDITION_OPTIONS = ["", "Good", "Fair", "Poor", "Safety Issue"] as const;

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error_description?: unknown;
    };

    const parts = [
      typeof maybeError.message === "string" ? maybeError.message : "",
      typeof maybeError.details === "string" ? maybeError.details : "",
      typeof maybeError.hint === "string" ? maybeError.hint : "",
      typeof maybeError.error_description === "string" ? maybeError.error_description : "",
      typeof maybeError.code === "string" ? `Code: ${maybeError.code}` : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  return "Unknown error";
}

function sanitizePathPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const LOCAL_INSPECTION_DB_NAME = "5tools-photo-inspections-db";
const LOCAL_INSPECTION_STORE_NAME = "inspections";

function isLocalInspectionId(value: string) {
  return value.startsWith("local:");
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";
  const details = typeof maybeError.details === "string" ? maybeError.details.toLowerCase() : "";
  const hint = typeof maybeError.hint === "string" ? maybeError.hint.toLowerCase() : "";
  const combined = [message, details, hint].filter(Boolean).join(" ");

  return (
    code === "42P01" ||
    (code === "PGRST205" &&
      combined.includes("could not find the table") &&
      combined.includes("inspections"))
  );
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read photo."));
    };

    reader.onerror = () => reject(new Error("Failed to read photo."));
    reader.readAsDataURL(file);
  });
}

async function openLocalInspectionDb() {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this browser.");
  }

  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(LOCAL_INSPECTION_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(LOCAL_INSPECTION_STORE_NAME)) {
        database.createObjectStore(LOCAL_INSPECTION_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open local inspection database."));
  });
}

async function readAllLocalInspectionRecords() {
  try {
    const database = await openLocalInspectionDb();

    return await new Promise<LocalInspectionRecord[]>((resolve, reject) => {
      const transaction = database.transaction(LOCAL_INSPECTION_STORE_NAME, "readonly");
      const store = transaction.objectStore(LOCAL_INSPECTION_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve((request.result || []) as LocalInspectionRecord[]);
      request.onerror = () => reject(request.error || new Error("Failed to read local inspections."));
    });
  } catch (error) {
    console.error("LOCAL INSPECTION READ ERROR:", error);
    return [] as LocalInspectionRecord[];
  }
}

async function readLocalInspectionRecordById(id: string) {
  try {
    const database = await openLocalInspectionDb();

    return await new Promise<LocalInspectionRecord | null>((resolve, reject) => {
      const transaction = database.transaction(LOCAL_INSPECTION_STORE_NAME, "readonly");
      const store = transaction.objectStore(LOCAL_INSPECTION_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () =>
        resolve(request.result ? (request.result as LocalInspectionRecord) : null);
      request.onerror = () => reject(request.error || new Error("Failed to read local inspection."));
    });
  } catch (error) {
    console.error("LOCAL INSPECTION READ BY ID ERROR:", error);
    return null;
  }
}

async function writeLocalInspectionRecord(record: LocalInspectionRecord) {
  const database = await openLocalInspectionDb();

  return await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(LOCAL_INSPECTION_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LOCAL_INSPECTION_STORE_NAME);
    store.put(record);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("Failed to save local inspection backup."));
    transaction.onabort = () =>
      reject(transaction.error || new Error("Local inspection backup transaction aborted."));
  });
}

function localRecordToSummary(record: LocalInspectionRecord): SavedInspectionSummary {
  return {
    id: record.id,
    property_name: record.property_name || "Unnamed property",
    property_address: record.property_address,
    inspection_date: record.inspection_date,
    inspector_name: record.inspector_name,
    created_at: record.created_at,
  };
}

function createBlankItem(name = ""): InspectionItem {
  return {
    id: makeId(),
    name,
    condition: "",
    comments: "",
    repairNotes: "",
  };
}

function createArea(name: string): Area {
  return {
    id: makeId(),
    name,
    overallComments: "",
    repairNotes: "",
    photos: [],
    savedPhotos: [],
    items: [],
  };
}

function formatInspectionLabel(inspection: SavedInspectionSummary) {
  const property = inspection.property_name || "Unnamed property";
  const date = inspection.inspection_date || "No date";
  return `${property} — ${date}`;
}

function statusClasses(type: StatusType) {
  if (type === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  if (type === "error") {
    return "border-red-300 bg-red-50 text-red-800";
  }

  return "border-[#334155] bg-[#111827]/95 text-[#d1d5db]";
}

function LocalPhotoPreview({ file, alt }: { file: File; alt: string }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  if (!previewUrl) return null;

  return <img src={previewUrl} alt={alt} className="mb-3 h-40 w-full rounded-xl border border-[#1f2937] object-cover" />;
}

export default function InspectionsPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [inspectionId, setInspectionId] = useState<string | null>(null);

  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [inspectorName, setInspectorName] = useState("");

  const [selectedArea, setSelectedArea] = useState("");
  const [customAreaName, setCustomAreaName] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);

  const [savedInspections, setSavedInspections] = useState<SavedInspectionSummary[]>([]);
  const [selectedInspectionToLoad, setSelectedInspectionToLoad] = useState("");

  const [status, setStatus] = useState<StatusState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);

  const existingAreaNames = useMemo(
    () => new Set(areas.map((area) => area.name.trim().toLowerCase())),
    [areas]
  );

  async function loadInspectionList() {
    setIsLoadingList(true);

    try {
      const { data, error } = await supabase
        .from("inspections")
        .select(
          "id, property_name, property_address, inspection_date, inspector_name, created_at"
        )
        .order("property_name", { ascending: true })
        .order("inspection_date", { ascending: false });

      if (error) throw error;

      const cloudRows = (data || []) as SavedInspectionSummary[];
      const localRows = (await readAllLocalInspectionRecords())
        .map(localRecordToSummary)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

      setSavedInspections([...localRows, ...cloudRows]);
    } catch (error: unknown) {
      console.error("LOAD INSPECTION LIST ERROR:", error);

      if (isMissingTableError(error)) {
        const localRows = (await readAllLocalInspectionRecords())
          .map(localRecordToSummary)
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

        setSavedInspections(localRows);
        setStatus({
          type: localRows.length > 0 ? "info" : "error",
          message:
            localRows.length > 0
              ? "Cloud inspections table is missing in Supabase. Showing local browser backups only."
              : "Cloud inspections table is missing in Supabase. Create the inspections tables to enable cloud save.",
        });
      } else {
        setStatus({
          type: "error",
          message: `Failed to load saved inspections: ${getErrorMessage(error)}`,
        });
      }
    } finally {
      setIsLoadingList(false);
    }
  }

  useEffect(() => {
    void loadInspectionList();
  }, []);

  function resetForm() {
    setInspectionId(null);
    setPropertyName("");
    setPropertyAddress("");
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setInspectorName("");
    setSelectedArea("");
    setCustomAreaName("");
    setAreas([]);
    setSelectedInspectionToLoad("");
    setStatus({ type: "info", message: "Started a new inspection." });
  }

  function addArea() {
    setStatus(null);

    let areaName = "";

    if (selectedArea === "Other") {
      areaName = customAreaName.trim();
      if (!areaName) {
        setStatus({ type: "error", message: "Enter a custom area name." });
        return;
      }
    } else {
      areaName = selectedArea.trim();
      if (!areaName) {
        setStatus({ type: "error", message: "Select an area first." });
        return;
      }
    }

    const normalized = areaName.toLowerCase();

    if (existingAreaNames.has(normalized)) {
      setStatus({
        type: "error",
        message: `"${areaName}" has already been added.`,
      });
      return;
    }

    setAreas((prev) => [...prev, createArea(areaName)]);
    setSelectedArea("");
    setCustomAreaName("");
    setStatus({ type: "success", message: `Added area: ${areaName}` });
  }

  function removeArea(areaId: string) {
    setAreas((prev) => prev.filter((area) => area.id !== areaId));
    setStatus({ type: "info", message: "Area removed." });
  }

  function updateAreaField<K extends keyof Area>(areaId: string, field: K, value: Area[K]) {
    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              [field]: value,
            }
          : area
      )
    );
  }

  function addItem(areaId: string) {
    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              items: [...area.items, createBlankItem()],
            }
          : area
      )
    );
  }

  function removeItem(areaId: string, itemId: string) {
    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              items: area.items.filter((item) => item.id !== itemId),
            }
          : area
      )
    );
  }

  function updateItemField<K extends keyof InspectionItem>(
    areaId: string,
    itemId: string,
    field: K,
    value: InspectionItem[K]
  ) {
    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              items: area.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      [field]: value,
                    }
                  : item
              ),
            }
          : area
      )
    );
  }

  function handlePhotoUpload(areaId: string, files: FileList | null) {
    if (!files) return;

    const newFiles = Array.from(files);

    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              photos: [...area.photos, ...newFiles],
            }
          : area
      )
    );
  }

  function removeLocalPhoto(areaId: string, indexToRemove: number) {
    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              photos: area.photos.filter((_, index) => index !== indexToRemove),
            }
          : area
      )
    );
  }

  function removeSavedPhoto(areaId: string, filePath: string) {
    setAreas((prev) =>
      prev.map((area) =>
        area.id === areaId
          ? {
              ...area,
              savedPhotos: area.savedPhotos.filter((photo) => photo.filePath !== filePath),
            }
          : area
      )
    );

    setStatus({ type: "info", message: "Saved photo removed from this inspection draft." });
  }

  async function loadInspectionById(id: string) {
    setIsLoadingInspection(true);

    try {
      if (isLocalInspectionId(id)) {
        const localRecord = await readLocalInspectionRecordById(id);

        if (!localRecord) {
          throw new Error("Local inspection backup not found.");
        }

        const rebuiltLocalAreas: Area[] = localRecord.areas.map((area) => ({
          id: area.id || makeId(),
          name: area.name,
          overallComments: area.overallComments || "",
          repairNotes: area.repairNotes || "",
          photos: [],
          savedPhotos: (area.savedPhotos || []).map((photo) => ({
            id: photo.id,
            fileName: photo.fileName,
            filePath: photo.filePath,
            fileSize: photo.fileSize ?? null,
            mimeType: photo.mimeType ?? null,
            publicUrl: photo.publicUrl,
          })),
          items: (area.items || []).map((item) => ({
            id: item.id || makeId(),
            name: item.name || "",
            condition: item.condition || "",
            comments: item.comments || "",
            repairNotes: item.repairNotes || "",
          })),
        }));

        setInspectionId(localRecord.id);
        setPropertyName(localRecord.property_name || "");
        setPropertyAddress(localRecord.property_address || "");
        setInspectionDate(localRecord.inspection_date || new Date().toISOString().slice(0, 10));
        setInspectorName(localRecord.inspector_name || "");
        setAreas(rebuiltLocalAreas);

        return true;
      }

      const [inspectionResult, areaResult, photoResult] = await Promise.all([
        supabase
          .from("inspections")
          .select("id, property_name, property_address, inspection_date, inspector_name")
          .eq("id", id)
          .single(),
        supabase
          .from("inspection_areas")
          .select("id, area_name, overall_comments, repair_notes, sort_order")
          .eq("inspection_id", id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("inspection_photos")
          .select("id, area_name, file_name, file_path, file_size, mime_type, sort_order")
          .eq("inspection_id", id)
          .order("sort_order", { ascending: true }),
      ]);

      if (inspectionResult.error) throw inspectionResult.error;
      if (areaResult.error) throw areaResult.error;
      if (photoResult.error) throw photoResult.error;

      const dbAreas = (areaResult.data || []) as InspectionAreaRow[];
      const photoData = (photoResult.data || []) as InspectionPhotoRow[];
      const areaIds = dbAreas.map((area) => area.id);

      let itemData: InspectionItemRow[] = [];

      if (areaIds.length > 0) {
        const { data: loadedItems, error: itemError } = await supabase
          .from("inspection_items")
          .select("area_id, item_name, condition, comments, repair_notes, sort_order")
          .in("area_id", areaIds)
          .order("sort_order", { ascending: true });

        if (itemError) throw itemError;

        itemData = (loadedItems || []) as InspectionItemRow[];
      }

      const rebuiltAreas: Area[] = dbAreas.map((dbArea) => {
        const matchingItems = itemData
          .filter((item) => item.area_id === dbArea.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({
            id: makeId(),
            name: item.item_name || "",
            condition: item.condition || "",
            comments: item.comments || "",
            repairNotes: item.repair_notes || "",
          }));

        const matchingSavedPhotos = photoData
          .filter((photo) => photo.area_name === dbArea.area_name)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((photo) => {
            const {
              data: { publicUrl },
            } = supabase.storage.from("inspection-photos").getPublicUrl(photo.file_path);

            return {
              id: photo.id,
              fileName: photo.file_name,
              filePath: photo.file_path,
              fileSize: photo.file_size,
              mimeType: photo.mime_type,
              publicUrl,
            } satisfies SavedPhoto;
          });

        return {
          id: makeId(),
          name: dbArea.area_name,
          overallComments: dbArea.overall_comments || "",
          repairNotes: dbArea.repair_notes || "",
          photos: [],
          savedPhotos: matchingSavedPhotos,
          items: matchingItems,
        };
      });

      const inspectionData = inspectionResult.data;

      setInspectionId(inspectionData.id);
      setPropertyName(inspectionData.property_name || "");
      setPropertyAddress(inspectionData.property_address || "");
      setInspectionDate(
        inspectionData.inspection_date || new Date().toISOString().slice(0, 10)
      );
      setInspectorName(inspectionData.inspector_name || "");
      setAreas(rebuiltAreas);

      return true;
    } catch (error: unknown) {
      console.error("LOAD INSPECTION ERROR:", error);
      setStatus({
        type: "error",
        message: `Failed to load inspection: ${getErrorMessage(error)}`,
      });
      return false;
    } finally {
      setIsLoadingInspection(false);
    }
  }

  async function loadInspection() {
    if (!selectedInspectionToLoad) {
      setStatus({ type: "error", message: "Select an inspection to load." });
      return;
    }

    const success = await loadInspectionById(selectedInspectionToLoad);

    if (success) {
      setStatus({ type: "success", message: "Inspection loaded." });
    }
  }

  async function saveInspection() {
    setStatus(null);

    if (!propertyName.trim()) {
      setStatus({ type: "error", message: "Property name is required." });
      return;
    }

    if (!inspectionDate) {
      setStatus({ type: "error", message: "Inspection date is required." });
      return;
    }

    setIsSaving(true);

    let currentInspectionId = inspectionId;
    const wasUpdating = Boolean(currentInspectionId);
    const uploadedPaths: string[] = [];
    let createdInspectionId: string | null = null;

    try {
      if (currentInspectionId) {
        const [existingPhotosResult, existingAreasResult, updateInspectionResult] =
          await Promise.all([
            supabase
              .from("inspection_photos")
              .select("file_path")
              .eq("inspection_id", currentInspectionId),
            supabase.from("inspection_areas").select("id").eq("inspection_id", currentInspectionId),
            supabase
              .from("inspections")
              .update({
                property_name: propertyName.trim(),
                property_address: propertyAddress.trim() || null,
                inspection_date: inspectionDate,
                inspector_name: inspectorName.trim() || null,
              })
              .eq("id", currentInspectionId),
          ]);

        if (existingPhotosResult.error) throw existingPhotosResult.error;
        if (existingAreasResult.error) throw existingAreasResult.error;
        if (updateInspectionResult.error) throw updateInspectionResult.error;

        const retainedSavedPhotoPaths = new Set(
          areas.flatMap((area) => area.savedPhotos.map((photo) => photo.filePath)).filter(Boolean)
        );

        const pathsToDeleteFromStorage = (existingPhotosResult.data || [])
          .map((photo) => photo.file_path)
          .filter(
            (filePath): filePath is string =>
              Boolean(filePath) && !retainedSavedPhotoPaths.has(filePath)
          );

        if (pathsToDeleteFromStorage.length > 0) {
          const { error: storageDeleteError } = await supabase.storage
            .from("inspection-photos")
            .remove(pathsToDeleteFromStorage);

          if (storageDeleteError) throw storageDeleteError;
        }

        const existingAreaIds = (existingAreasResult.data || []).map((area) => area.id);

        if (existingAreaIds.length > 0) {
          const { error: deleteItemsError } = await supabase
            .from("inspection_items")
            .delete()
            .in("area_id", existingAreaIds);

          if (deleteItemsError) throw deleteItemsError;
        }

        const { error: deleteAreasError } = await supabase
          .from("inspection_areas")
          .delete()
          .eq("inspection_id", currentInspectionId);

        if (deleteAreasError) throw deleteAreasError;

        const { error: deletePhotoRowsError } = await supabase
          .from("inspection_photos")
          .delete()
          .eq("inspection_id", currentInspectionId);

        if (deletePhotoRowsError) throw deletePhotoRowsError;
      } else {
        const { data: insertedInspection, error: insertError } = await supabase
          .from("inspections")
          .insert({
            property_name: propertyName.trim(),
            property_address: propertyAddress.trim() || null,
            inspection_date: inspectionDate,
            inspector_name: inspectorName.trim() || null,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        currentInspectionId = insertedInspection.id;
        createdInspectionId = insertedInspection.id;
      }

      if (!currentInspectionId) {
        throw new Error("No inspection ID available.");
      }

      const insertedAreasByIndex: { id: string; sort_order: number }[] = [];

      if (areas.length > 0) {
        const areaRows = areas.map((area, index) => ({
          inspection_id: currentInspectionId,
          area_name: area.name,
          overall_comments: area.overallComments || null,
          repair_notes: area.repairNotes || null,
          sort_order: index,
        }));

        const { data: insertedAreas, error: areasInsertError } = await supabase
          .from("inspection_areas")
          .insert(areaRows)
          .select("id, sort_order");

        if (areasInsertError) throw areasInsertError;

        insertedAreasByIndex.push(...((insertedAreas || []) as { id: string; sort_order: number }[]));

        const itemRows: {
          area_id: string;
          item_name: string | null;
          condition: string | null;
          comments: string | null;
          repair_notes: string | null;
          sort_order: number;
        }[] = [];

        insertedAreasByIndex.forEach((dbArea) => {
          const matchingArea = areas[dbArea.sort_order];
          if (!matchingArea) return;

          matchingArea.items.forEach((item, itemIndex) => {
            itemRows.push({
              area_id: dbArea.id,
              item_name: item.name || null,
              condition: item.condition || null,
              comments: item.comments || null,
              repair_notes: item.repairNotes || null,
              sort_order: itemIndex,
            });
          });
        });

        if (itemRows.length > 0) {
          const { error: itemsInsertError } = await supabase
            .from("inspection_items")
            .insert(itemRows);

          if (itemsInsertError) throw itemsInsertError;
        }
      }

      const photoRows: {
        inspection_id: string;
        area_name: string;
        file_name: string;
        file_path: string;
        file_size: number | null;
        mime_type: string | null;
        sort_order: number;
      }[] = [];

      for (const area of areas) {
        const safeAreaName = sanitizePathPart(area.name || "area") || "area";

        for (let photoIndex = 0; photoIndex < area.photos.length; photoIndex += 1) {
          const photo = area.photos[photoIndex];
          const safeOriginalName = sanitizePathPart(photo.name || "photo") || "photo";
          const uniquePrefix = makeId();
          const filePath = `${currentInspectionId}/${safeAreaName}/${uniquePrefix}-${safeOriginalName}`;

          const { error: uploadError } = await supabase.storage
            .from("inspection-photos")
            .upload(filePath, photo, {
              upsert: false,
            });

          if (uploadError) throw uploadError;

          uploadedPaths.push(filePath);

          photoRows.push({
            inspection_id: currentInspectionId,
            area_name: area.name,
            file_name: photo.name,
            file_path: filePath,
            file_size: photo.size ?? null,
            mime_type: photo.type ?? null,
            sort_order: photoIndex,
          });
        }

        for (
          let savedPhotoIndex = 0;
          savedPhotoIndex < area.savedPhotos.length;
          savedPhotoIndex += 1
        ) {
          const savedPhoto = area.savedPhotos[savedPhotoIndex];

          photoRows.push({
            inspection_id: currentInspectionId,
            area_name: area.name,
            file_name: savedPhoto.fileName,
            file_path: savedPhoto.filePath,
            file_size: savedPhoto.fileSize ?? null,
            mime_type: savedPhoto.mimeType ?? null,
            sort_order: area.photos.length + savedPhotoIndex,
          });
        }
      }

      if (photoRows.length > 0) {
        const { error: photoInsertError } = await supabase
          .from("inspection_photos")
          .insert(photoRows);

        if (photoInsertError) throw photoInsertError;
      }

      setInspectionId(currentInspectionId);
      setSelectedInspectionToLoad(currentInspectionId);

      await loadInspectionList();
      const reloaded = await loadInspectionById(currentInspectionId);

      if (reloaded) {
        setStatus({
          type: "success",
          message: wasUpdating ? "Inspection updated." : "Inspection saved.",
        });
      } else {
        setStatus({
          type: "info",
          message:
            (wasUpdating ? "Inspection updated" : "Inspection saved") +
            ", but the form could not be refreshed automatically.",
        });
      }
    } catch (error: unknown) {
      console.error("SAVE INSPECTION ERROR:", error);
      console.error("SAVE INSPECTION PAYLOAD:", {
        inspectionId: currentInspectionId,
        propertyName,
        propertyAddress,
        inspectionDate,
        inspectorName,
        areaCount: areas.length,
        localPhotoCount: areas.reduce((sum, area) => sum + area.photos.length, 0),
        savedPhotoCount: areas.reduce((sum, area) => sum + area.savedPhotos.length, 0),
      });

      if (isMissingTableError(error)) {
        try {
          const localId =
            isLocalInspectionId(inspectionId || "") && inspectionId
              ? inspectionId
              : `local:${makeId()}`;

          const serializedAreas: LocalInspectionAreaRecord[] = [];

          for (const area of areas) {
            const localPhotosFromUploads: LocalInspectionStoredPhoto[] = await Promise.all(
              area.photos.map(async (photo, photoIndex) => ({
                id: `local-photo-${photoIndex}-${makeId()}`,
                fileName: photo.name,
                filePath: `local-backup/${sanitizePathPart(area.name || "area")}/${makeId()}-${sanitizePathPart(photo.name || "photo")}`,
                fileSize: photo.size ?? null,
                mimeType: photo.type ?? null,
                publicUrl: await fileToDataUrl(photo),
              }))
            );

            serializedAreas.push({
              id: area.id,
              name: area.name,
              overallComments: area.overallComments,
              repairNotes: area.repairNotes,
              savedPhotos: [...(area.savedPhotos || []), ...localPhotosFromUploads],
              items: area.items,
            });
          }

          const localRecord: LocalInspectionRecord = {
            id: localId,
            property_name: propertyName.trim(),
            property_address: propertyAddress.trim() || null,
            inspection_date: inspectionDate,
            inspector_name: inspectorName.trim() || null,
            created_at: new Date().toISOString(),
            source: "local",
            areas: serializedAreas,
          };

          await writeLocalInspectionRecord(localRecord);
          setInspectionId(localId);
          setSelectedInspectionToLoad(localId);

          await loadInspectionList();
          await loadInspectionById(localId);

          setStatus({
            type: "info",
            message:
              "Cloud save is not available because the Supabase inspections table is missing. A full local browser backup was saved in IndexedDB instead.",
          });
          return;
        } catch (localSaveError: unknown) {
          console.error("LOCAL BACKUP SAVE ERROR:", localSaveError);
          setStatus({
            type: "error",
            message: `Cloud save failed and local backup also failed: ${getErrorMessage(localSaveError)}`,
          });
          return;
        }
      }

      if (uploadedPaths.length > 0) {
        const { error: cleanupStorageError } = await supabase.storage
          .from("inspection-photos")
          .remove(uploadedPaths);

        if (cleanupStorageError) {
          console.error("UPLOAD CLEANUP ERROR:", cleanupStorageError);
        }
      }

      if (createdInspectionId) {
        const { error: cleanupInspectionError } = await supabase
          .from("inspections")
          .delete()
          .eq("id", createdInspectionId);

        if (cleanupInspectionError) {
          console.error("NEW INSPECTION CLEANUP ERROR:", cleanupInspectionError);
        }
      }

      setStatus({
        type: "error",
        message: `Failed to save inspection: ${getErrorMessage(error)}`,
      });
    } finally {
      setIsSaving(false);
    }
  }

  const inspectionPayload = useMemo(
    () => ({
      inspectionId,
      propertyName,
      propertyAddress,
      inspectionDate,
      inspectorName,
      areas: areas.map((area) => ({
        id: area.id,
        name: area.name,
        overallComments: area.overallComments,
        repairNotes: area.repairNotes,
        photos: area.photos.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
        savedPhotos: area.savedPhotos,
        items: area.items,
      })),
    }),
    [inspectionId, propertyName, propertyAddress, inspectionDate, inspectorName, areas]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0f172a] px-4 py-6 text-[#f9fafb] md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(217,119,6,0.10),transparent_25%)]" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="rounded-2xl border border-[#1f2937] bg-[#111827]/95 px-6 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-4xl font-bold tracking-wide text-[#fbbf24]">5Tools</div>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-sm font-medium text-[#9ca3af]">
                  Repair &amp; Maintenance Workspace
                </p>
                <span className="hidden h-[2px] w-16 bg-[#fbbf24] md:block" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-xl border border-[#1f2937] bg-[#111827] px-4 py-2 text-sm font-semibold text-[#f9fafb] transition hover:bg-[#1f2937]"
              >
                Back to Dashboard
              </Link>
              <div className="rounded-xl border border-[#1f2937] bg-[#0f172a] px-4 py-2 text-sm text-[#9ca3af]">
                Photo Inspection
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <h2 className="text-xl font-semibold text-[#f9fafb]">Inspection Controls</h2>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving || isLoadingInspection}
                  className="w-full rounded-xl border border-[#1f2937] bg-[#111827] px-4 py-2 font-medium text-[#f9fafb] transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  New Inspection
                </button>

                <button
                  type="button"
                  onClick={saveInspection}
                  disabled={isSaving || isLoadingInspection}
                  className="w-full rounded-xl border border-[#fbbf24] bg-[#fbbf24] px-4 py-2 font-medium text-black transition hover:bg-[#d97706] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : inspectionId ? "Update Inspection" : "Save Inspection"}
                </button>

                <button
                  type="button"
                  onClick={() => void loadInspectionList()}
                  disabled={isLoadingList || isSaving}
                  className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-4 py-2 font-medium text-[#f9fafb] transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingList ? "Refreshing..." : "Refresh Saved List"}
                </button>
              </div>

              {status && (
                <div
                  className={`mt-4 rounded-xl border px-3 py-3 text-sm ${statusClasses(status.type)}`}
                >
                  {status.message}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <h2 className="text-xl font-semibold text-[#f9fafb]">Load Saved Inspection</h2>

              <div className="mt-4 space-y-3">
                <select
                  value={selectedInspectionToLoad}
                  onChange={(e) => setSelectedInspectionToLoad(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                >
                  <option value="">Select saved inspection</option>
                  {savedInspections.map((inspection) => (
                    <option key={inspection.id} value={inspection.id}>
                      {formatInspectionLabel(inspection)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void loadInspection()}
                  disabled={isLoadingInspection || isSaving}
                  className="w-full rounded-xl border border-[#1f2937] bg-[#111827] px-4 py-2 font-medium text-[#f9fafb] transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingInspection ? "Loading..." : "Load Inspection"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <h2 className="text-xl font-semibold text-[#f9fafb]">Property Header</h2>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#d1d5db]">Property Name</label>
                  <input
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                    placeholder="Example: 123 Main St"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#d1d5db]">Property Address</label>
                  <input
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                    placeholder="Street, City, State ZIP"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#d1d5db]">Inspection Date</label>
                  <input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#d1d5db]">Inspector Name</label>
                  <input
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                    placeholder="Inspector name"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <h2 className="text-xl font-semibold text-[#f9fafb]">Add Area</h2>

              <div className="mt-4 grid gap-3">
                <select
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value);
                    setStatus(null);
                  }}
                  className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                >
                  <option value="">Select area</option>
                  {COMMON_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>

                {selectedArea === "Other" && (
                  <input
                    value={customAreaName}
                    onChange={(e) => setCustomAreaName(e.target.value)}
                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                    placeholder="Enter custom area name"
                  />
                )}

                <button
                  type="button"
                  onClick={addArea}
                  className="rounded-xl border border-[#1f2937] bg-[#111827] px-4 py-2 font-medium text-white transition hover:bg-[#1f2937]"
                >
                  Add Area
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <h2 className="text-xl font-semibold text-[#f9fafb]">Inspection Summary</h2>

              <div className="mt-4 space-y-2 text-sm text-[#d1d5db]">
                <p>
                  <span className="font-medium">Current record:</span>{" "}
                  {inspectionId ? "Existing saved inspection" : "New unsaved inspection"}
                </p>
                <p>
                  <span className="font-medium">Areas added:</span> {areas.length}
                </p>
                <p>
                  <span className="font-medium">Total items:</span>{" "}
                  {areas.reduce((sum, area) => sum + area.items.length, 0)}
                </p>
                <p>
                  <span className="font-medium">Selected local photos:</span>{" "}
                  {areas.reduce((sum, area) => sum + area.photos.length, 0)}
                </p>
                <p>
                  <span className="font-medium">Saved photos:</span>{" "}
                  {areas.reduce((sum, area) => sum + area.savedPhotos.length, 0)}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            {areas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#475569] bg-[#111827]/80 p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                <p className="text-lg font-semibold text-[#f9fafb]">No areas added yet</p>
                <p className="mt-2 text-sm text-[#9ca3af]">
                  Use the Add Area section to build this inspection one area at a time.
                </p>
              </div>
            ) : (
              areas.map((area) => (
                <div
                  key={area.id}
                  className="rounded-3xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                >
                  <div className="flex flex-col gap-3 border-b border-[#334155] pb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-[#f9fafb]">{area.name}</h2>
                      <p className="text-sm text-[#9ca3af]">
                        Area comments, photos, and item-level inspection notes
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeArea(area.id)}
                      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 font-medium text-red-300 transition hover:bg-red-500/20"
                    >
                      Remove Area
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#d1d5db]">Overall Comments</label>
                      <textarea
                        value={area.overallComments}
                        onChange={(e) =>
                          updateAreaField(area.id, "overallComments", e.target.value)
                        }
                        rows={4}
                        className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                        placeholder="Overall condition, general observations, tenant/owner notes..."
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#d1d5db]">Area Repair Notes</label>
                      <textarea
                        value={area.repairNotes}
                        onChange={(e) => updateAreaField(area.id, "repairNotes", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                        placeholder="Repair recommendations, follow-up work, contractor notes..."
                      />
                    </div>

                    <div className="rounded-2xl border border-[#1f2937] bg-[#0b1220] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-[#f9fafb]">Photos</h3>
                          <p className="text-sm text-[#9ca3af]">
                            Upload only the photos needed for this area
                          </p>
                        </div>

                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-[#1f2937] bg-[#111827] px-4 py-2 font-medium text-white transition hover:bg-[#1f2937]">
                          Add Photos
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handlePhotoUpload(area.id, e.target.files)}
                          />
                        </label>
                      </div>

                      {area.photos.length === 0 && area.savedPhotos.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-[#334155] bg-[#0f172a] p-4 text-sm text-[#94a3b8]">
                          No photos added yet.
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {area.savedPhotos.map((photo, index) => (
                            <div
                              key={`${photo.filePath}-${index}`}
                              className="rounded-2xl border border-[#1f2937] bg-[#0b1220] p-3"
                            >
                              {photo.publicUrl ? (
                                <img
                                  src={photo.publicUrl}
                                  alt={photo.fileName}
                                  className="mb-3 h-40 w-full rounded-xl border border-[#1f2937] object-cover"
                                />
                              ) : null}
                              <div className="text-sm font-medium text-[#f9fafb]">
                                {photo.fileName}
                              </div>
                              <div className="mt-1 text-xs text-[#94a3b8]">Saved photo</div>
                              <button
                                type="button"
                                onClick={() => removeSavedPhoto(area.id, photo.filePath)}
                                className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20"
                              >
                                Remove Saved Photo
                              </button>
                            </div>
                          ))}

                          {area.photos.map((photo, index) => (
                            <div
                              key={`${photo.name}-${photo.size}-${index}`}
                              className="rounded-2xl border border-[#1f2937] bg-[#0b1220] p-3"
                            >
                              <LocalPhotoPreview file={photo} alt={photo.name} />
                              <div className="text-sm font-medium text-[#f9fafb]">{photo.name}</div>
                              <div className="mt-1 text-xs text-[#94a3b8]">
                                {(photo.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                              <div className="mt-1 text-xs text-[#94a3b8]">Local photo</div>
                              <button
                                type="button"
                                onClick={() => removeLocalPhoto(area.id, index)}
                                className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20"
                              >
                                Remove Photo
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#1f2937] bg-[#0b1220] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-[#f9fafb]">Inspection Items</h3>
                          <p className="text-sm text-[#9ca3af]">
                            Add only the components you inspected in this area
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => addItem(area.id)}
                          className="rounded-xl border border-[#1f2937] bg-[#111827] px-4 py-2 font-medium text-white transition hover:bg-[#1f2937]"
                        >
                          Add Item
                        </button>
                      </div>

                      {area.items.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-[#334155] bg-[#0f172a] p-4 text-sm text-[#94a3b8]">
                          No item rows yet. Add items like sink, cabinets, flooring, vanity,
                          tub, siding, gutters, windows, and appliances.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          {area.items.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-[#1f2937] bg-[#0b1220] p-4"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <h4 className="font-semibold text-[#f9fafb]">
                                  Item {itemIndex + 1}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => removeItem(area.id, item.id)}
                                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-sm font-medium text-[#d1d5db]">
                                    Item Name
                                  </label>
                                  <input
                                    value={item.name}
                                    onChange={(e) =>
                                      updateItemField(area.id, item.id, "name", e.target.value)
                                    }
                                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                                    placeholder="Example: Sink, Cabinets, Flooring"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-sm font-medium text-[#d1d5db]">
                                    Condition
                                  </label>
                                  <select
                                    value={item.condition}
                                    onChange={(e) =>
                                      updateItemField(area.id, item.id, "condition", e.target.value)
                                    }
                                    className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                                  >
                                    {CONDITION_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option || "Select condition"}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="mt-3">
                                <label className="mb-1 block text-sm font-medium text-[#d1d5db]">
                                  Item Comments
                                </label>
                                <textarea
                                  value={item.comments}
                                  onChange={(e) =>
                                    updateItemField(area.id, item.id, "comments", e.target.value)
                                  }
                                  rows={3}
                                  className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                                  placeholder="Condition details, observed damage, wear, functionality..."
                                />
                              </div>

                              <div className="mt-3">
                                <label className="mb-1 block text-sm font-medium text-[#d1d5db]">
                                  Repair Notes
                                </label>
                                <textarea
                                  value={item.repairNotes}
                                  onChange={(e) =>
                                    updateItemField(area.id, item.id, "repairNotes", e.target.value)
                                  }
                                  rows={3}
                                  className="w-full rounded-xl border border-[#334155] bg-[#0f172a] px-3 py-2 text-[#f9fafb] outline-none focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20"
                                  placeholder="Repair recommendation, replacement needed, monitor only..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="rounded-3xl border border-[#1f2937] bg-[#111827]/95 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
              <h2 className="text-xl font-semibold text-[#f9fafb]">Supabase-Ready Preview</h2>
              <p className="mt-2 text-sm text-[#9ca3af]">
                Header, areas, items, and photos are all included in the save/load flow.
              </p>

              <pre className="mt-4 max-h-[400px] overflow-auto rounded-xl border border-[#1f2937] bg-[#020617] p-4 text-xs text-[#e5e7eb]">
                {JSON.stringify(inspectionPayload, null, 2)}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
