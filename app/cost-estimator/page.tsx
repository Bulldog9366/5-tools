"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LaborMode = "flat" | "hourly";
type ViewMode = "internal" | "owner";

type EstimateLine = {
  id: string;
  category: string;
  item: string;
  description: string;
  qty: number;
  laborMode: LaborMode;
  laborFlat: number;
  laborHours: number;
  laborRate: number;
  materials: number;
  taxable: boolean;
  internalNotes: string;
};

const STORAGE_KEY = "five-tools-cost-estimator-v1";

const PRESETS = [
  {
    label: "Custom Item",
    category: "General",
    description: "",
    laborFlat: 0,
    materials: 0,
  },
  {
    label: "Toilet Installation",
    category: "Plumbing",
    description:
      "Remove existing toilet, install replacement toilet, reset, test, and clean work area.",
    laborFlat: 225,
    materials: 0,
  },
  {
    label: "Smoke / CO Detector Install",
    category: "Electrical",
    description:
      "Remove existing detector and install hardwired smoke / CO combo unit.",
    laborFlat: 95,
    materials: 45,
  },
  {
    label: "Interior Paint Touch-Up",
    category: "Painting",
    description: "Prep and paint affected interior wall/trim areas as needed.",
    laborFlat: 350,
    materials: 75,
  },
  {
    label: "Trim Installation",
    category: "Carpentry",
    description: "Install floor or door trim, caulk, and prep for paint.",
    laborFlat: 300,
    materials: 125,
  },
  {
    label: "LVP Repair Section",
    category: "Flooring",
    description: "Remove damaged LVP section and install replacement flooring.",
    laborFlat: 425,
    materials: 150,
  },
  {
    label: "Basic Haul Away",
    category: "Clean Out",
    description: "Remove and dispose of general debris from property.",
    laborFlat: 275,
    materials: 0,
  },
];

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function cleanNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newLine(): EstimateLine {
  return {
    id: crypto.randomUUID(),
    category: "General",
    item: "Custom Item",
    description: "",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 85,
    materials: 0,
    taxable: true,
    internalNotes: "",
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5b564c]">
      {children}
    </label>
  );
}

export default function CostEstimatorPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("internal");
  const [estimateTitle, setEstimateTitle] = useState("Cost Estimator");

  const [propertyStreet, setPropertyStreet] = useState("");
  const [propertyCity, setPropertyCity] = useState("");
  const propertyState = "WA";
  const [propertyZip, setPropertyZip] = useState("");

  const [clientName, setClientName] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [estimateNotes, setEstimateNotes] = useState(
    "Estimate is provided for owner review and approval. Final cost may vary if additional hidden conditions are discovered."
  );
  const [taxRate, setTaxRate] = useState(10.5);
  const [includeTax, setIncludeTax] = useState(true);
  const [contingency, setContingency] = useState(0);
  const [lines, setLines] = useState<EstimateLine[]>([newLine()]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setViewMode(parsed.viewMode ?? "internal");
      setEstimateTitle(parsed.estimateTitle ?? "Cost Estimator");

      setPropertyStreet(parsed.propertyStreet ?? parsed.propertyAddress ?? "");
      setPropertyCity(parsed.propertyCity ?? "");
      setPropertyZip(parsed.propertyZip ?? "");

      setClientName(parsed.clientName ?? "");
      setPreparedBy(parsed.preparedBy ?? "");
      setEstimateNotes(parsed.estimateNotes ?? "");
      setTaxRate(parsed.taxRate ?? 10.5);
      setIncludeTax(parsed.includeTax ?? true);
      setContingency(parsed.contingency ?? 0);
      setLines(parsed.lines?.length ? parsed.lines : [newLine()]);
    } catch {
      // keep starter state
    }
  }, []);

  function saveLocal() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        viewMode,
        estimateTitle,
        propertyStreet,
        propertyCity,
        propertyState,
        propertyZip,
        clientName,
        preparedBy,
        estimateNotes,
        taxRate,
        includeTax,
        contingency,
        lines,
      })
    );
    alert("Cost estimator saved locally.");
  }

  function clearAll() {
    if (!confirm("Clear this estimate and start fresh?")) return;

    setEstimateTitle("Cost Estimator");
    setPropertyStreet("");
    setPropertyCity("");
    setPropertyZip("");
    setClientName("");
    setPreparedBy("");
    setEstimateNotes(
      "Estimate is provided for owner review and approval. Final cost may vary if additional hidden conditions are discovered."
    );
    setTaxRate(10.5);
    setIncludeTax(true);
    setContingency(0);
    setLines([newLine()]);
  }

  function updateLine(id: string, patch: Partial<EstimateLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function applyPreset(id: string, presetLabel: string) {
    const preset = PRESETS.find((p) => p.label === presetLabel);
    if (!preset) return;

    updateLine(id, {
      item: preset.label,
      category: preset.category,
      description: preset.description,
      laborFlat: preset.laborFlat,
      materials: preset.materials,
    });
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => {
      const labor =
        line.laborMode === "flat"
          ? line.laborFlat
          : line.laborHours * line.laborRate;

      return sum + (labor + line.materials) * line.qty;
    }, 0);

    const taxableSubtotal = lines.reduce((sum, line) => {
      if (!line.taxable) return sum;

      const labor =
        line.laborMode === "flat"
          ? line.laborFlat
          : line.laborHours * line.laborRate;

      return sum + (labor + line.materials) * line.qty;
    }, 0);

    const tax = includeTax ? taxableSubtotal * (taxRate / 100) : 0;
    const total = subtotal + tax + contingency;

    return { subtotal, taxableSubtotal, tax, total };
  }, [lines, taxRate, includeTax, contingency]);

  return (
    <main className="min-h-screen bg-[#ece8df] px-4 py-6 text-[#111111] md:px-8">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-card {
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }

          .print-page {
            padding: 0 !important;
            background: white !important;
          }

          input,
          textarea,
          select {
            border: none !important;
            background: transparent !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold text-[#111111] shadow-sm hover:bg-[#fffdf7]"
          >
            ← Back to Dashboard
          </Link>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                setViewMode(viewMode === "internal" ? "owner" : "internal")
              }
              className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]"
            >
              View: {viewMode === "internal" ? "Internal" : "Owner"}
            </button>

            <button
              onClick={saveLocal}
              className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]"
            >
              Save Local
            </button>

            <button
              onClick={clearAll}
              className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]"
            >
              Clear
            </button>

            <button
              onClick={() => window.print()}
              className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#b8921f]"
            >
              Print / PDF
            </button>
          </div>
        </div>

        <section className="print-card rounded-3xl border border-[#d8d2c4] bg-[#f7f4ed] p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 border-b border-[#d8d2c4] pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 h-2 w-24 rounded-full bg-[#c9a227]" />
              <input
                value={estimateTitle}
                onChange={(e) => setEstimateTitle(e.target.value)}
                className="w-full bg-transparent text-4xl font-bold tracking-tight outline-none"
              />
              <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-[#c9a227]">
                5Tools Cost Estimator
              </p>
            </div>

            <div className="rounded-2xl border border-[#111111] bg-[#111111] px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9a227]">
                5Tools
              </p>
              <p className="mt-1 text-sm">
                Repair • Maintenance • Project Support
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-6">
            <div className="md:col-span-3">
              <FieldLabel>Property / Job Address</FieldLabel>
              <input
                value={propertyStreet}
                onChange={(e) => setPropertyStreet(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
                placeholder="Street address"
              />
            </div>

            <div className="md:col-span-1">
              <FieldLabel>City</FieldLabel>
              <input
                value={propertyCity}
                onChange={(e) => setPropertyCity(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
                placeholder="City"
              />
            </div>

            <div className="md:col-span-1">
              <FieldLabel>State</FieldLabel>
              <div className="mt-2 rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm font-semibold">
                {propertyState}
              </div>
            </div>

            <div className="md:col-span-1">
              <FieldLabel>Zip Code</FieldLabel>
              <input
                value={propertyZip}
                onChange={(e) => setPropertyZip(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
                placeholder="Zip"
              />
            </div>

            <div className="md:col-span-3">
              <FieldLabel>Owner / Client</FieldLabel>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
                placeholder="Owner or client name"
              />
            </div>

            <div className="md:col-span-3">
              <FieldLabel>Prepared By</FieldLabel>
              <input
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
                placeholder="Prepared by"
              />
            </div>
          </div>

          <div className="no-print mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <FieldLabel>Local Tax Rate %</FieldLabel>
              <input
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(cleanNumber(e.target.value))}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <FieldLabel>Tax</FieldLabel>
              <select
                value={includeTax ? "yes" : "no"}
                onChange={(e) => setIncludeTax(e.target.value === "yes")}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="yes">Include local tax</option>
                <option value="no">Do not include tax</option>
              </select>
            </div>

            <div>
              <FieldLabel>Manual Contingency $</FieldLabel>
              <input
                type="number"
                step="0.01"
                value={contingency}
                onChange={(e) => setContingency(cleanNumber(e.target.value))}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {lines.map((line, index) => {
              const labor =
                line.laborMode === "flat"
                  ? line.laborFlat
                  : line.laborHours * line.laborRate;

              const lineTotal = (labor + line.materials) * line.qty;

              return (
                <div
                  key={line.id}
                  className="rounded-2xl border border-[#d8d2c4] bg-white p-4 shadow-sm"
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-[#111111]">
                      Line Item {index + 1}
                    </h3>

                    <button
                      onClick={() =>
                        setLines((current) =>
                          current.length === 1
                            ? current
                            : current.filter((item) => item.id !== line.id)
                        )
                      }
                      className="no-print text-sm font-semibold text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <FieldLabel>Preset / Item</FieldLabel>
                      <select
                        value={line.item}
                        onChange={(e) => applyPreset(line.id, e.target.value)}
                        className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                      >
                        {PRESETS.map((preset) => (
                          <option key={preset.label} value={preset.label}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <FieldLabel>Category</FieldLabel>
                      <input
                        value={line.category}
                        onChange={(e) =>
                          updateLine(line.id, { category: e.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <FieldLabel>Qty</FieldLabel>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.id, {
                            qty: cleanNumber(e.target.value),
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <FieldLabel>Taxable</FieldLabel>
                      <select
                        value={line.taxable ? "yes" : "no"}
                        onChange={(e) =>
                          updateLine(line.id, {
                            taxable: e.target.value === "yes",
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.id, { description: e.target.value })
                      }
                      rows={2}
                      className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm leading-6 outline-none"
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-5">
                    <div>
                      <FieldLabel>Labor Type</FieldLabel>
                      <select
                        value={line.laborMode}
                        onChange={(e) =>
                          updateLine(line.id, {
                            laborMode: e.target.value as LaborMode,
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                      >
                        <option value="flat">Flat Rate</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </div>

                    {line.laborMode === "flat" ? (
                      <div>
                        <FieldLabel>Labor $</FieldLabel>
                        <input
                          type="number"
                          step="0.01"
                          value={line.laborFlat}
                          onChange={(e) =>
                            updateLine(line.id, {
                              laborFlat: cleanNumber(e.target.value),
                            })
                          }
                          className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <FieldLabel>Hours</FieldLabel>
                          <input
                            type="number"
                            step="0.25"
                            value={line.laborHours}
                            onChange={(e) =>
                              updateLine(line.id, {
                                laborHours: cleanNumber(e.target.value),
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                          />
                        </div>

                        <div>
                          <FieldLabel>Rate $</FieldLabel>
                          <input
                            type="number"
                            step="0.01"
                            value={line.laborRate}
                            onChange={(e) =>
                              updateLine(line.id, {
                                laborRate: cleanNumber(e.target.value),
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <FieldLabel>Materials $</FieldLabel>
                      <input
                        type="number"
                        step="0.01"
                        value={line.materials}
                        onChange={(e) =>
                          updateLine(line.id, {
                            materials: cleanNumber(e.target.value),
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2 text-sm outline-none"
                      />
                    </div>

                    <div>
                      <FieldLabel>Line Total</FieldLabel>
                      <div className="mt-2 rounded-xl border border-[#d8d2c4] bg-[#fffdf7] px-3 py-2 text-sm font-bold">
                        {money(lineTotal)}
                      </div>
                    </div>
                  </div>

                  {viewMode === "internal" && (
                    <div className="no-print mt-4">
                      <FieldLabel>Internal Notes</FieldLabel>
                      <textarea
                        value={line.internalNotes}
                        onChange={(e) =>
                          updateLine(line.id, {
                            internalNotes: e.target.value,
                          })
                        }
                        rows={2}
                        className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#fffdf7] px-3 py-2 text-sm leading-6 outline-none"
                        placeholder="Internal notes hidden from owner print view"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="no-print mt-5">
            <button
              onClick={() => setLines((current) => [...current, newLine()])}
              className="rounded-xl bg-[#111111] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#2a2a2a]"
            >
              + Add Line Item
            </button>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <FieldLabel>Estimate Notes</FieldLabel>
              <textarea
                value={estimateNotes}
                onChange={(e) => setEstimateNotes(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm leading-6 outline-none"
              />
            </div>

            <div className="rounded-2xl border border-[#d8d2c4] bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-bold">Estimate Summary</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong>{money(totals.subtotal)}</strong>
                </div>

                <div className="flex justify-between">
                  <span>Taxable Amount</span>
                  <strong>{money(totals.taxableSubtotal)}</strong>
                </div>

                <div className="flex justify-between">
                  <span>
                    Local Tax ({includeTax ? `${taxRate}%` : "Not Included"})
                  </span>
                  <strong>{money(totals.tax)}</strong>
                </div>

                <div className="flex justify-between">
                  <span>Contingency</span>
                  <strong>{money(contingency)}</strong>
                </div>

                <div className="border-t border-[#d8d2c4] pt-4">
                  <div className="flex justify-between text-xl">
                    <span className="font-bold">Total Estimate</span>
                    <strong>{money(totals.total)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}