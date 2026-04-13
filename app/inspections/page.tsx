"use client";

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

type DbAreaRow = {
  id: string;
  area_name: string;
  overall_comments: string | null;
  repair_notes: string | null;
  sort_order: number;
};

type DbItemRow = {
  area_id: string;
  item_name: string | null;
  condition: string | null;
  comments: string | null;
  repair_notes: string | null;
  sort_order: number;
};

type DbPhotoRow = {
  id: string;
  area_name: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  sort_order: number;
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

const CONDITION_OPTIONS = ["", "Good", "Fair", "Poor", "Safety Issue"];

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);

  const existingAreaNames = useMemo(
    () => new Set(areas.map((area) => area.name.trim().toLowerCase())),
    [areas]
  );

  useEffect(() => {
    void loadInspectionList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      setSavedInspections((data || []) as SavedInspectionSummary[]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error("LOAD LIST ERROR:", error);
      setStatusMessage(`Failed to load saved inspections: ${message}`);
    } finally {
      setIsLoadingList(false);
    }
  }

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
    setStatusMessage("Started a new inspection.");
  }

  function addArea() {
    setStatusMessage("");

    let areaName = "";

    if (selectedArea === "Other") {
      areaName = customAreaName.trim();
      if (!areaName) {
        setStatusMessage("Enter a custom area name.");
        return;
      }
    } else {
      areaName = selectedArea.trim();
      if (!areaName) {
        setStatusMessage("Select an area first.");
        return;
      }
    }

    const normalized = areaName.toLowerCase();

    if (existingAreaNames.has(normalized)) {
      setStatusMessage(`"${areaName}" has already been added.`);
      return;
    }

    setAreas((prev) => [...prev, createArea(areaName)]);
    setSelectedArea("");
    setCustomAreaName("");
    setStatusMessage(`Added area: ${areaName}`);
  }

  function removeArea(areaId: string) {
    setAreas((prev) => prev.filter((area) => area.id !== areaId));
    setStatusMessage("Area removed.");
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

  async function loadInspectionById(id: string) {
    setIsLoadingInspection(true);

    try {
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("inspections")
        .select("id, property_name, property_address, inspection_date, inspector_name")
        .eq("id", id)
        .single();

      if (inspectionError) throw inspectionError;
      if (!inspectionData) throw new Error("Inspection not found.");

      const { data: areaData, error: areaError } = await supabase
        .from("inspection_areas")
        .select("id, area_name, overall_comments, repair_notes, sort_order")
        .eq("inspection_id", id)
        .order("sort_order", { ascending: true });

      if (areaError) throw areaError;

      const dbAreas = (areaData || []) as DbAreaRow[];
      const areaIds = dbAreas.map((area) => area.id);

      let itemData: DbItemRow[] = [];

      if (areaIds.length > 0) {
        const { data: loadedItems, error: itemError } = await supabase
          .from("inspection_items")
          .select("area_id, item_name, condition, comments, repair_notes, sort_order")
          .in("area_id", areaIds)
          .order("sort_order", { ascending: true });

        if (itemError) throw itemError;

        itemData = (loadedItems || []) as DbItemRow[];
      }

      const { data: loadedPhotos, error: photoError } = await supabase
        .from("inspection_photos")
        .select("id, area_name, file_name, file_path, file_size, mime_type, sort_order")
        .eq("inspection_id", id)
        .order("sort_order", { ascending: true });

      if (photoError) throw photoError;

      const photoData = (loadedPhotos || []) as DbPhotoRow[];

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
            };
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

      setInspectionId(inspectionData.id);
      setPropertyName(inspectionData.property_name || "");
      setPropertyAddress(inspectionData.property_address || "");
      setInspectionDate(
        inspectionData.inspection_date || new Date().toISOString().slice(0, 10)
      );
      setInspectorName(inspectionData.inspector_name || "");
      setAreas(rebuiltAreas);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error("LOAD INSPECTION ERROR:", error);
      setStatusMessage(`Failed to load inspection: ${message}`);
    } finally {
      setIsLoadingInspection(false);
    }
  }

  async function loadInspection() {
    if (!selectedInspectionToLoad) {
      setStatusMessage("Select an inspection to load.");
      return;
    }

    await loadInspectionById(selectedInspectionToLoad);
    setStatusMessage("Inspection loaded.");
  }

  async function saveInspection() {
    setStatusMessage("");

    if (!propertyName.trim()) {
      setStatusMessage("Property name is required.");
      return;
    }

    if (!inspectionDate) {
      setStatusMessage("Inspection date is required.");
      return;
    }

    setIsSaving(true);

    try {
      let currentInspectionId = inspectionId;
      const wasUpdating = !!currentInspectionId;

      if (currentInspectionId) {
        const { error: updateError } = await supabase
          .from("inspections")
          .update({
            property_name: propertyName.trim(),
            property_address: propertyAddress.trim() || null,
            inspection_date: inspectionDate,
            inspector_name: inspectorName.trim() || null,
          })
          .eq("id", currentInspectionId);

        if (updateError) throw updateError;

        const { error: deleteAreasError } = await supabase
          .from("inspection_areas")
          .delete()
          .eq("inspection_id", currentInspectionId);

        if (deleteAreasError) throw deleteAreasError;

        const { error: deleteItemsError } = await supabase
          .from("inspection_items")
          .delete()
          .in(
            "area_id",
            (
              await supabase
                .from("inspection_areas")
                .select("id")
                .eq("inspection_id", currentInspectionId)
            ).data?.map((row) => row.id) || []
          );

        if (deleteItemsError) {
          // safe to ignore if area ids are already gone, but keep the failure visible
          console.warn("DELETE ITEMS WARNING:", deleteItemsError);
        }

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
            status: "draft",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        if (!insertedInspection) throw new Error("Failed to create inspection.");

        currentInspectionId = insertedInspection.id;
      }

      if (!currentInspectionId) {
        throw new Error("No inspection ID available.");
      }

      let insertedAreasByIndex: { id: string; sort_order: number }[] = [];

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

        insertedAreasByIndex = insertedAreas || [];

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
        for (let photoIndex = 0; photoIndex < area.photos.length; photoIndex++) {
          const photo = area.photos[photoIndex];
          const safeArea = area.name.replace(/[^\w\-]+/g, "_");
          const safeFileName = `${Date.now()}-${photoIndex}-${photo.name.replace(/[^\w.\-]+/g, "_")}`;
          const filePath = `${currentInspectionId}/${safeArea}/${safeFileName}`;

          const { error: uploadError } = await supabase.storage
            .from("inspection-photos")
            .upload(filePath, photo, {
              upsert: true,
            });

          if (uploadError) throw uploadError;

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

        for (let savedPhotoIndex = 0; savedPhotoIndex < area.savedPhotos.length; savedPhotoIndex++) {
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
      await loadInspectionById(currentInspectionId);

      setStatusMessage(wasUpdating ? "Inspection updated." : "Inspection saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error("SAVE INSPECTION ERROR:", error);
      setStatusMessage(`Failed to save inspection: ${message}`);
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
    <main className="min-h-screen bg-slate-200 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-slate-300 bg-slate-50 p-6 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">Photo Inspection</h1>
          <p className="mt-2 text-sm text-slate-600">
            Area-based inspection with Supabase save, load, and photo storage.
          </p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Inspection Controls</h2>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
                >
                  New Inspection
                </button>

                <button
                  type="button"
                  onClick={saveInspection}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2 font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : inspectionId ? "Update Inspection" : "Save Inspection"}
                </button>

                <button
                  type="button"
                  onClick={() => void loadInspectionList()}
                  disabled={isLoadingList}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingList ? "Refreshing..." : "Refresh Saved List"}
                </button>
              </div>

              {statusMessage && (
                <div className="mt-4 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700">
                  {statusMessage}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Load Saved Inspection</h2>

              <div className="mt-4 space-y-3">
                <select
                  value={selectedInspectionToLoad}
                  onChange={(e) => setSelectedInspectionToLoad(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
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
                  disabled={isLoadingInspection}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingInspection ? "Loading..." : "Load Inspection"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Property Header</h2>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Property Name</label>
                  <input
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    placeholder="Example: 123 Main St"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Property Address</label>
                  <input
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    placeholder="Street, City, State ZIP"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Inspection Date</label>
                  <input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Inspector Name</label>
                  <input
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    placeholder="Inspector name"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Add Area</h2>

              <div className="mt-4 grid gap-3">
                <select
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value);
                    setStatusMessage("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                    placeholder="Enter custom area name"
                  />
                )}

                <button
                  type="button"
                  onClick={addArea}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
                >
                  Add Area
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Inspection Summary</h2>

              <div className="mt-4 space-y-2 text-sm text-slate-700">
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
              <div className="rounded-2xl border border-dashed border-slate-400 bg-slate-50 p-8 text-center shadow-sm">
                <p className="text-lg font-semibold text-slate-800">No areas added yet</p>
                <p className="mt-2 text-sm text-slate-600">
                  Use the Add Area section to build this inspection one area at a time.
                </p>
              </div>
            ) : (
              areas.map((area) => (
                <div
                  key={area.id}
                  className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-300 pb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{area.name}</h2>
                      <p className="text-sm text-slate-600">
                        Area comments, photos, and item-level inspection notes
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeArea(area.id)}
                      className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-700 transition hover:bg-red-100"
                    >
                      Remove Area
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Overall Comments</label>
                      <textarea
                        value={area.overallComments}
                        onChange={(e) =>
                          updateAreaField(area.id, "overallComments", e.target.value)
                        }
                        rows={4}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                        placeholder="Overall condition, general observations, tenant/owner notes..."
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium">Area Repair Notes</label>
                      <textarea
                        value={area.repairNotes}
                        onChange={(e) =>
                          updateAreaField(area.id, "repairNotes", e.target.value)
                        }
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                        placeholder="Repair recommendations, follow-up work, contractor notes..."
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-300 bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Photos</h3>
                          <p className="text-sm text-slate-600">
                            Upload only the photos needed for this area
                          </p>
                        </div>

                        <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700">
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
                        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                          No photos added yet.
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {area.savedPhotos.map((photo, index) => (
                            <div
                              key={`${photo.filePath}-${index}`}
                              className="rounded-xl border border-slate-300 bg-slate-50 p-3"
                            >
                              {photo.publicUrl ? (
                                <img
                                  src={photo.publicUrl}
                                  alt={photo.fileName}
                                  className="mb-3 h-40 w-full rounded-lg object-cover"
                                />
                              ) : null}
                              <div className="text-sm font-medium text-slate-800">
                                {photo.fileName}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">Saved photo</div>
                            </div>
                          ))}

                          {area.photos.map((photo, index) => (
                            <div
                              key={`${photo.name}-${index}`}
                              className="rounded-xl border border-slate-300 bg-slate-50 p-3"
                            >
                              <div className="text-sm font-medium text-slate-800">
                                {photo.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {(photo.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                              <button
                                type="button"
                                onClick={() => removeLocalPhoto(area.id, index)}
                                className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                              >
                                Remove Photo
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-300 bg-white p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Inspection Items</h3>
                          <p className="text-sm text-slate-600">
                            Add only the components you inspected in this area
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => addItem(area.id)}
                          className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700"
                        >
                          Add Item
                        </button>
                      </div>

                      {area.items.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                          No item rows yet. Add items like sink, cabinets, flooring, vanity,
                          tub, siding, gutters, windows, and appliances.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          {area.items.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className="rounded-xl border border-slate-300 bg-slate-50 p-4"
                            >
                              <div className="mb-3 flex items-center justify-between">
                                <h4 className="font-semibold text-slate-800">
                                  Item {itemIndex + 1}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => removeItem(area.id, item.id)}
                                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-sm font-medium">
                                    Item Name
                                  </label>
                                  <input
                                    value={item.name}
                                    onChange={(e) =>
                                      updateItemField(area.id, item.id, "name", e.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                                    placeholder="Example: Sink, Cabinets, Flooring"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-sm font-medium">
                                    Condition
                                  </label>
                                  <select
                                    value={item.condition}
                                    onChange={(e) =>
                                      updateItemField(area.id, item.id, "condition", e.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
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
                                <label className="mb-1 block text-sm font-medium">
                                  Item Comments
                                </label>
                                <textarea
                                  value={item.comments}
                                  onChange={(e) =>
                                    updateItemField(area.id, item.id, "comments", e.target.value)
                                  }
                                  rows={3}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
                                  placeholder="Condition details, observed damage, wear, functionality..."
                                />
                              </div>

                              <div className="mt-3">
                                <label className="mb-1 block text-sm font-medium">
                                  Repair Notes
                                </label>
                                <textarea
                                  value={item.repairNotes}
                                  onChange={(e) =>
                                    updateItemField(area.id, item.id, "repairNotes", e.target.value)
                                  }
                                  rows={3}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
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

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Supabase-Ready Preview</h2>
              <p className="mt-2 text-sm text-slate-600">
                Header, areas, items, and photos are all included in the save/load flow.
              </p>

              <pre className="mt-4 max-h-[400px] overflow-auto rounded-xl border border-slate-300 bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(inspectionPayload, null, 2)}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}