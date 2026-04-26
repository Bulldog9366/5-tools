
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase";

const supabase = createClient();
const TABLE_NAME = "inspection_reports";

type PhotoType = "before" | "progress" | "after" | "issue";

type InspectionPhoto = {
  id: string;
  name: string;
  url: string;
  caption: string;
  type: PhotoType;
  createdAt: string;
};

type InspectionArea = {
  id: string;
  name: string;
  status: "Not Started" | "In Progress" | "Needs Attention" | "Complete";
  notes: string;
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

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

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
    const a = area as Partial<InspectionArea>;
    return {
      id: a.id || makeId(),
      name: a.name || "",
      status:
        a.status === "In Progress" ||
        a.status === "Needs Attention" ||
        a.status === "Complete"
          ? a.status
          : "Not Started",
      notes: a.notes || "",
      photos: Array.isArray(a.photos)
        ? a.photos.map((photo) => {
            const p = photo as Partial<InspectionPhoto>;
            return {
              id: p.id || makeId(),
              name: p.name || "",
              url: p.url || "",
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
  const [statusMessage, setStatusMessage] = useState("");
  const [newAreaName, setNewAreaName] = useState("");

  const [isRefreshingCloud, setIsRefreshingCloud] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);


  const fieldClass =
    "w-full min-h-12 rounded-xl border border-slate-300 bg-slate-200 px-3 py-3 text-slate-900 placeholder:text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400";

  const buttonPrimary =
    "min-h-12 rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-slate-900 hover:bg-yellow-300 transition disabled:opacity-50 disabled:cursor-not-allowed";

  const buttonSecondary =
    "min-h-12 rounded-xl border border-slate-500 bg-slate-700 px-4 py-3 text-white hover:bg-slate-600 transition disabled:opacity-50 disabled:cursor-not-allowed";

  const buttonDanger =
    "min-h-12 rounded-xl border border-red-400 bg-red-900/40 px-4 py-3 font-semibold text-red-100 hover:bg-red-800/60 transition disabled:opacity-50 disabled:cursor-not-allowed";

  const card =
    "rounded-2xl border border-slate-700 bg-[#13203d] p-6 shadow";

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

  const totalPhotos = useMemo(() => {
    return inspection.areas.reduce((sum, area) => sum + area.photos.length, 0);
  }, [inspection.areas]);

  const issuePhotos = useMemo(() => {
    return allTimelineItems.filter((item) => item.type === "issue").length;
  }, [allTimelineItems]);

  const completedAreas = useMemo(() => {
    return inspection.areas.filter((area) => area.status === "Complete").length;
  }, [inspection.areas]);

  const needsAttentionAreas = useMemo(() => {
    return inspection.areas.filter((area) => area.status === "Needs Attention").length;
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

    const rows = ((data as CloudInspectionRow[]) || []).map(mapRowToInspection);
    setSavedInspections(rows);

    if (rows.length > 0 && !selectedInspectionId) {
      setSelectedInspectionId(rows[0].id);
    } else if (rows.length === 0) {
      setSelectedInspectionId("");
    }

    setStatusMessage(rows.length ? `Loaded ${rows.length} cloud report${rows.length === 1 ? "" : "s"}.` : "No cloud reports found.");
    setIsRefreshingCloud(false);
  }

  useEffect(() => {
    refreshCloudRecords();
  }, []);

  async function saveInspection() {
    if (!inspection.propertyName.trim() && !inspection.propertyAddress.trim()) {
      setStatusMessage("Enter a property name or address before saving.");
      return;
    }

    setIsSavingCloud(true);
    setStatusMessage("");

    const now = new Date().toISOString();
    const payload = {
      property_name: inspection.propertyName.trim(),
      property_address: inspection.propertyAddress.trim(),
      report_date: inspection.inspectionDate || null,
      prepared_by: inspection.inspectorName.trim(),
      areas_json: inspection.areas,
      updated_at: now,
    };

    if (inspection.id) {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", inspection.id);

      if (error) {
        setStatusMessage(`Cloud save failed: ${error.message}`);
        setIsSavingCloud(false);
        return;
      }

      const nextInspection: SavedInspection = {
        ...inspection,
        updatedAt: now,
      };
      setInspection(nextInspection);
      setSelectedInspectionId(nextInspection.id);
      await refreshCloudRecords();
      setStatusMessage("Report saved to cloud.");
      setIsSavingCloud(false);
      return;
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
      return;
    }

    const nextInspection = mapRowToInspection(data as CloudInspectionRow);
    setInspection(nextInspection);
    setSelectedInspectionId(nextInspection.id);
    await refreshCloudRecords();
    setStatusMessage("Report saved to cloud.");
    setIsSavingCloud(false);
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

    setInspection(mapRowToInspection(data as CloudInspectionRow));
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
    setStatusMessage("Ready for a new report.");
  };

  const printReport = () => {
    window.print();
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

  const addArea = () => {
    if (!newAreaName.trim()) {
      setStatusMessage("Enter an area name first.");
      return;
    }

    const exists = inspection.areas.some(
      (area) => area.name.toLowerCase() === newAreaName.trim().toLowerCase()
    );

    if (exists) {
      setStatusMessage("That area already exists.");
      return;
    }

    const newArea: InspectionArea = {
      id: makeId(),
      name: newAreaName.trim(),
      status: "Not Started",
      notes: "",
      photos: [],
    };

    setInspection((prev) => ({
      ...prev,
      areas: [...prev.areas, newArea],
    }));

    setNewAreaName("");
    setStatusMessage("Area added.");
  };

  const addPresetArea = (name: string) => {
    const exists = inspection.areas.some(
      (area) => area.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setStatusMessage(`${name} already exists.`);
      return;
    }

    const newArea: InspectionArea = {
      id: makeId(),
      name,
      status: "Not Started",
      notes: "",
      photos: [],
    };

    setInspection((prev) => ({
      ...prev,
      areas: [...prev.areas, newArea],
    }));

    setStatusMessage(`${name} added.`);
  };

  const updateArea = (areaId: string, updates: Partial<InspectionArea>) => {
    setInspection((prev) => ({
      ...prev,
      areas: prev.areas.map((area) =>
        area.id === areaId ? { ...area, ...updates } : area
      ),
    }));
  };

  const deleteArea = (areaId: string) => {
    setInspection((prev) => ({
      ...prev,
      areas: prev.areas.filter((area) => area.id !== areaId),
    }));
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

      setInspection((prev) => ({
        ...prev,
        areas: prev.areas.map((area) =>
          area.id === areaId
            ? { ...area, photos: [...createdPhotos, ...area.photos] }
            : area
        ),
      }));

      setStatusMessage(`${createdPhotos.length} photo${createdPhotos.length === 1 ? "" : "s"} added.`);
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
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px !important;
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

      <main className="min-h-screen bg-[#0f1b34] text-white p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="no-print space-y-6">
            <div className={`${card} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-yellow-300">
                  5Tools Report
                </p>
                <h1 className="mt-1 text-2xl font-bold">5 Tools Property Condition App</h1>
                <p className="mt-2 text-sm text-slate-300">
                  Build area-based property condition reports, attach photos, and save them to cloud.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-500 bg-slate-700 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-600 transition"
                >
                  Back to Dashboard
                </Link>

                <button onClick={newInspection} className={buttonSecondary}>
                  New Report
                </button>

                <button onClick={saveInspection} disabled={isSavingCloud} className={buttonPrimary}>
                  {isSavingCloud ? "Saving..." : "Save to Cloud"}
                </button>

                <button onClick={refreshCloudRecords} disabled={isRefreshingCloud} className={buttonSecondary}>
                  {isRefreshingCloud ? "Refreshing..." : "Refresh Cloud List"}
                </button>

                <button onClick={printReport} className={buttonSecondary}>
                  Print Report
                </button>

                <button onClick={deleteInspection} disabled={isDeletingCloud} className={buttonDanger}>
                  {isDeletingCloud ? "Deleting..." : "Delete Report"}
                </button>
              </div>
            </div>

            {statusMessage ? (
              <div className="rounded-xl border border-slate-700 bg-[#13203d] px-4 py-3 text-sm text-slate-200">
                {statusMessage}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="space-y-6">
                <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#13203d] px-4 py-3 shadow-sm xl:hidden">
                  <div>
                    <h2 className="text-base font-semibold text-white">Report Controls</h2>
                    <p className="text-xs text-slate-400">Property header, cloud records, areas, and photos.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLeftPanel((prev) => !prev)}
                    className="rounded-xl border border-slate-500 bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600"
                  >
                    {showLeftPanel ? "Hide" : "Show"}
                  </button>
                </div>

                <div className={`${showLeftPanel ? "block" : "hidden"} space-y-6 xl:block`}>
                <div className={card}>
                  <h2 className="text-lg font-semibold mb-4">Load Saved Report</h2>

                  <select
                    className={fieldClass}
                    value={selectedInspectionId}
                    onChange={(e) => setSelectedInspectionId(e.target.value)}
                  >
                    <option value="">Select saved cloud report</option>
                    {savedInspections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.propertyName || "Untitled Property"}{" "}
                        {item.inspectionDate ? `- ${item.inspectionDate}` : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    className={`${buttonSecondary} mt-3 w-full`}
                    onClick={loadInspection}
                    disabled={isLoadingCloud}
                  >
                    {isLoadingCloud ? "Loading..." : "Load Report"}
                  </button>
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
                  <h2 className="text-lg font-semibold mb-4">Add Area</h2>

                  <div className="flex gap-3">
                    <input
                      className={fieldClass}
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="Living Room, Roof, Exterior, Unit 7 Kitchen..."
                    />
                    <button className={buttonSecondary} onClick={addArea}>
                      Add
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Exterior", "Living Room", "Kitchen", "Bathroom", "Bedroom", "Garage", "Laundry"].map(
                      (preset) => (
                        <button
                          key={preset}
                          onClick={() => addPresetArea(preset)}
                          className="rounded-lg border border-slate-500 bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 transition"
                        >
                          {preset}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {inspection.areas.length === 0 ? (
                  <div className={`${card} text-center border-dashed`}>
                    <p className="text-slate-300">No areas added yet</p>
                    <p className="text-sm text-slate-400 mt-2">
                      Use the Add Area section to build this report.
                    </p>
                  </div>
                ) : (
                  inspection.areas.map((area) => (
                    <div key={area.id} className={card}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold">{area.name}</h2>
                          <p className="mt-1 text-sm text-slate-400">
                            {area.photos.length} photo{area.photos.length === 1 ? "" : "s"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <select
                            className="rounded-xl border border-slate-500 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            value={area.status}
                            onChange={(e) =>
                              updateArea(area.id, {
                                status: e.target.value as InspectionArea["status"],
                              })
                            }
                          >
                            <option>Not Started</option>
                            <option>In Progress</option>
                            <option>Needs Attention</option>
                            <option>Complete</option>
                          </select>

                          <button
                            onClick={() => deleteArea(area.id)}
                            className="rounded-xl border border-red-400 bg-red-900/40 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-800/60 transition"
                          >
                            Remove Area
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block mb-2 text-sm text-slate-300">Area Notes</label>
                        <textarea
                          className={`${fieldClass} min-h-28`}
                          value={area.notes}
                          onChange={(e) => updateArea(area.id, { notes: e.target.value })}
                          placeholder="Document conditions, damage, vendor notes, tenant comments, or scope details..."
                        />
                      </div>

                      <div className="mt-4">
                        <label className="block mb-2 text-sm text-slate-300">Upload Photos</label>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => addPhotosToArea(area.id, e.target.files)}
                          className="block w-full rounded-xl border border-slate-500 bg-slate-700 px-3 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-yellow-400 file:px-4 file:py-2 file:font-semibold file:text-slate-900 hover:file:bg-yellow-300"
                        />
                      </div>

                      {area.photos.length > 0 ? (
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          {area.photos.map((photo) => (
                            <div
                              key={photo.id}
                              className="rounded-2xl border border-slate-700 bg-[#0d1830] p-4"
                            >
                              <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
                                <img
                                  src={photo.url}
                                  alt={photo.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="mt-3 grid gap-3">
                                <div>
                                  <label className="block mb-1 text-xs uppercase tracking-wide text-slate-400">
                                    Photo Type
                                  </label>
                                  <select
                                    className="w-full rounded-lg border border-slate-500 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                                  <label className="block mb-1 text-xs uppercase tracking-wide text-slate-400">
                                    Caption
                                  </label>
                                  <input
                                    className="w-full rounded-lg border border-slate-500 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    value={photo.caption}
                                    onChange={(e) =>
                                      updatePhoto(area.id, photo.id, {
                                        caption: e.target.value,
                                      })
                                    }
                                    placeholder="Add caption or issue note"
                                  />
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400">
                                  <span>{photo.name}</span>
                                  <span>{new Date(photo.createdAt).toLocaleString()}</span>
                                </div>

                                <button
                                  onClick={() => deletePhoto(area.id, photo.id)}
                                  className="rounded-lg border border-red-400 bg-red-900/40 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-800/60 transition"
                                >
                                  Delete Photo
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-xl border border-dashed border-slate-600 bg-[#0d1830] p-6 text-center text-sm text-slate-400">
                          No photos uploaded for this area yet.
                        </div>
                      )}
                    </div>
                  ))
                )}
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#13203d] px-4 py-3 shadow-sm xl:hidden">
                  <div>
                    <h2 className="text-base font-semibold text-white">Report Preview</h2>
                    <p className="text-xs text-slate-400">Summary, timeline, and data preview.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRightPanel((prev) => !prev)}
                    className="rounded-xl border border-slate-500 bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600"
                  >
                    {showRightPanel ? "Hide" : "Show"}
                  </button>
                </div>

                <div className={`${showRightPanel ? "block" : "hidden"} space-y-6 xl:block`}>
                  <div className={card}>
                    <h2 className="text-lg font-semibold mb-4">Report Summary</h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#0d1830] p-4">
                      <p className="text-sm text-slate-400">Areas</p>
                      <p className="mt-1 text-2xl font-bold">{inspection.areas.length}</p>
                    </div>

                    <div className="rounded-xl bg-[#0d1830] p-4">
                      <p className="text-sm text-slate-400">Photos</p>
                      <p className="mt-1 text-2xl font-bold">{totalPhotos}</p>
                    </div>

                    <div className="rounded-xl bg-[#0d1830] p-4">
                      <p className="text-sm text-slate-400">Issue Photos</p>
                      <p className="mt-1 text-2xl font-bold">{issuePhotos}</p>
                    </div>

                    <div className="rounded-xl bg-[#0d1830] p-4">
                      <p className="text-sm text-slate-400">Completed Areas</p>
                      <p className="mt-1 text-2xl font-bold">{completedAreas}</p>
                    </div>
                  </div>
                </div>

                <div className={card}>
                  <h2 className="text-lg font-semibold mb-4">Project Timeline</h2>

                  {allTimelineItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-600 bg-[#0d1830] p-6 text-center">
                      <p className="text-slate-300">No timeline activity yet</p>
                      <p className="text-sm text-slate-400 mt-2">
                        Upload area photos to build a visual timeline.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[900px] overflow-auto pr-1">
                      {allTimelineItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-700 bg-[#0d1830] p-4"
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={item.url}
                              alt={item.name}
                              className="h-20 w-20 rounded-lg object-cover border border-slate-700"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-yellow-400 px-2 py-1 text-xs font-bold uppercase text-slate-900">
                                  {item.type}
                                </span>
                                <span className="text-sm font-semibold">{item.areaName}</span>
                              </div>

                              <p className="mt-2 text-sm text-slate-300">
                                {item.caption || "No caption added"}
                              </p>

                              <p className="mt-2 text-xs text-slate-500">
                                {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={card}>
                  <h2 className="text-lg font-semibold mb-2">Report Preview</h2>

                  <pre className="bg-[#0d1830] p-4 rounded-xl text-sm text-slate-200 overflow-auto max-h-[420px]">
{JSON.stringify(
  {
    reportId: inspection.id || null,
    propertyName: inspection.propertyName,
    propertyAddress: inspection.propertyAddress,
    reportDate: inspection.inspectionDate,
    preparedBy: inspection.inspectorName,
    areaCount: inspection.areas.length,
    photoCount: totalPhotos,
    areas: inspection.areas.map((area) => ({
      id: area.id,
      name: area.name,
      status: area.status,
      notes: area.notes,
      photoCount: area.photos.length,
      photos: area.photos.map((photo) => ({
        id: photo.id,
        name: photo.name,
        caption: photo.caption,
        type: photo.type,
        createdAt: photo.createdAt,
      })),
    })),
  },
  null,
  2
)}
                  </pre>
                </div>
                </div>
              </section>
            </div>
          </div>

          {/* PRINT REPORT */}
          <div className="print-report hidden bg-white text-black">
            <div className="print-shell mx-auto max-w-5xl p-8">
              <div className="print-header-rule border-b border-slate-300 pb-6 pt-4">
                <div className="flex items-start gap-8">
                  <div className="print-logo-wrap w-[240px] shrink-0 p-2">
                    <img
                      src="/5tools-logo.png"
                      alt="5Tools logo"
                      className="h-auto w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1 pt-2">
                    <h1 className="text-[52px] font-black uppercase leading-[0.95] tracking-tight text-slate-900">
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
                      <div className="mt-1 text-3xl font-semibold text-slate-900">
                        {inspection.propertyName || "--"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="print-brand-gold text-4xl">⌖</div>
                    <div>
                      <div className="print-label">Property Address</div>
                      <div className="mt-1 text-3xl font-semibold leading-tight text-slate-900">
                        {inspection.propertyAddress || "--"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-l border-slate-300 pl-8">
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
                    <div className="mt-3 text-xl font-bold uppercase text-slate-900">Areas</div>
                    <div className="mt-2 text-6xl font-black text-slate-900">{inspection.areas.length}</div>
                  </div>
                  <div className="px-6 py-3 text-center">
                    <div className="print-brand-gold text-5xl">◉</div>
                    <div className="mt-3 text-xl font-bold uppercase text-slate-900">Photos</div>
                    <div className="mt-2 text-6xl font-black text-slate-900">{totalPhotos}</div>
                  </div>
                  <div className="px-6 py-3 text-center">
                    <div className="print-brand-gold text-5xl">!</div>
                    <div className="mt-3 text-xl font-bold uppercase text-slate-900">Issue Photos</div>
                    <div className="mt-2 text-6xl font-black text-slate-900">{issuePhotos}</div>
                  </div>
                  <div className="px-6 py-3 text-center">
                    <div className="print-brand-gold text-5xl">✓</div>
                    <div className="mt-3 text-xl font-bold uppercase text-slate-900">Needs Attention</div>
                    <div className="mt-2 text-6xl font-black text-slate-900">{needsAttentionAreas}</div>
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
                            <h2 className="text-4xl font-black uppercase tracking-tight text-slate-900">{area.name}</h2>
                            <p className="mt-2 text-2xl font-bold text-slate-900">
                              Status: <span className="print-brand-gold">{area.status}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                          <span className="print-brand-gold text-4xl">◉</span>
                          <span>Photos: {area.photos.length}</span>
                        </div>
                      </div>

                      <div className="mt-8 grid grid-cols-2 gap-8">
                        <div>
                          <div className="text-xl font-black uppercase tracking-tight text-slate-900">
                            Area Notes
                          </div>
                          <div className="mt-4 min-h-[150px] rounded-2xl border border-slate-300 bg-slate-50 p-5 text-xl leading-8 text-slate-700 italic">
                            {area.notes || "No notes entered."}
                          </div>
                        </div>

                        <div>
                          <div className="text-xl font-black uppercase tracking-tight text-slate-900">
                            Photo Documentation
                          </div>

                          {area.photos.length === 0 ? (
                            <div className="mt-4 min-h-[150px] rounded-2xl border border-slate-300 bg-slate-50 p-5 text-xl leading-8 text-slate-700 italic">
                              No photos added for this area.
                            </div>
                          ) : (
                            <div className="print-photo-grid mt-4">
                              {area.photos.map((photo) => (
                                <div key={photo.id} className="print-photo-card">
                                  <div className="print-photo-image-wrap aspect-video">
                                    <img
                                      src={photo.url}
                                      alt={photo.name}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>

                                  <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="print-status-pill">{photo.type}</div>
                                    <div className="text-xs text-slate-500">
                                      {new Date(photo.createdAt).toLocaleString()}
                                    </div>
                                  </div>

                                  <div className="mt-2 text-sm font-semibold text-slate-900">
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
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Report Date
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {inspection.inspectionDate || "--"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    Prepared By
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {inspection.inspectorName || "--"}
                  </div>
                  <div className="text-xs text-slate-500">5Tools</div>
                </div>
              </div>

              <div className="print-brand-line mt-10 grid grid-cols-[1fr_280px] gap-8 border-t-2 pt-6">
                <div className="flex items-start gap-4">
                  <div className="print-brand-gold text-5xl">✓</div>
                  <div>
                    <div className="text-2xl font-black uppercase tracking-tight text-slate-900">
                      Disclaimer
                    </div>
                    <div className="mt-2 text-xl leading-9 text-slate-800">
                      This report is a general property condition summary based on a visual walkthrough.
                      It is not a licensed home inspection and should not be relied upon as a substitute
                      for a professional inspection. No warranties or guarantees are expressed or implied.
                      For a full evaluation, a licensed home inspector or specialist should be consulted.
                    </div>
                  </div>
                </div>

                <div className="border-l border-slate-300 pl-8 text-center">
                  <div className="print-brand-gold text-5xl italic">Thank you!</div>
                  <div className="mt-3 text-4xl font-black text-slate-900">5Tools</div>
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
      </main>
    </>
  );
}
