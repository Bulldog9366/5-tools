"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type LaborMode = "flat" | "hourly";
type ViewMode = "internal" | "owner";
type TaxMode = "include" | "exclude";

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

type JobInfo = {
  street: string;
  city: string;
  state: string;
  zip: string;
  client: string;
  preparedBy: string;
};

type Preset = {
  item: string;
  category: string;
  description: string;
  qty: number;
  laborMode: LaborMode;
  laborFlat: number;
  laborHours: number;
  laborRate: number;
  materials: number;
  taxable: boolean;
};

const STORAGE_KEY = "five-tools-cost-estimator-v2";
const TABLE_NAME = "cost_estimates";

const MATERIAL_PRESETS: Preset[] = [
  {
    item: "10yr Battery Smoke Detector",
    category: "Electrical",
    description: "Install 10-year battery-operated photoelectric smoke detector.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 27.5,
    taxable: true,
  },
  {
    item: "CO Detector",
    category: "Electrical",
    description: "Install carbon monoxide detector.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 28,
    taxable: true,
  },
  {
    item: "Kitchen Sink Faucet",
    category: "Plumbing",
    description: "Supply kitchen sink faucet for replacement installation.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 165,
    taxable: true,
  },
  {
    item: "Bathroom Sink Faucet",
    category: "Plumbing",
    description: "Supply bathroom sink faucet for replacement installation.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 95,
    taxable: true,
  },
  {
    item: "Electrical Outlet",
    category: "Electrical",
    description: "Standard duplex electrical outlet material.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 2.5,
    taxable: true,
  },
  {
    item: "GFCI Outlet",
    category: "Electrical",
    description: "GFCI outlet material for wet-area or protected circuit location.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 18,
    taxable: true,
  },
  {
    item: "Wax-Free Toilet Gasket",
    category: "Plumbing",
    description: "Wax-free toilet gasket material for toilet reset or repair.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 12,
    taxable: true,
  },
  {
    item: "Light Bulb (LED)",
    category: "Electrical",
    description: "LED replacement light bulb.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 4,
    taxable: true,
  },
  {
    item: "Entry Door Lockset (Handle + Deadbolt)",
    category: "Hardware",
    description: "Rental-grade entry door handle and deadbolt lockset.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 85,
    taxable: true,
  },
  {
    item: "Trip / Service Fee",
    category: "General",
    description: "Trip/service fee for site visit, fuel, vehicle expense, or material pickup.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 65,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
];

const SERVICE_PRESETS: Preset[] = [
  {
    item: "Drywall Repair (Small)",
    category: "Drywall",
    description: "Patch small drywall holes, dings, cracks, or minor damage.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 125,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Drywall Repair (Water Damage)",
    category: "Drywall",
    description: "Cut out damaged drywall section, replace, patch, and prepare for finish.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 350,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Plumbing Repair - Minor",
    category: "Plumbing",
    description: "Minor plumbing repair, leak correction, adjustment, or drain service.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 145,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Toilet Rebuild",
    category: "Plumbing",
    description: "Replace standard toilet internal components such as fill valve, flapper, or supply components.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 185,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Toilet Installation",
    category: "Plumbing",
    description: "Remove existing toilet, install replacement toilet, reset, test, and clean work area.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 225,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Fixture Install - Plumbing",
    category: "Plumbing",
    description: "Install owner-approved plumbing fixture and test for proper operation.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 225,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Electrical Fixture Install",
    category: "Electrical",
    description: "Install electrical fixture such as light fixture, ceiling fan, or similar approved fixture.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 185,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Switch / Dimmer Install",
    category: "Electrical",
    description: "Replace standard switch or dimmer and test operation.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 125,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Interior Painting",
    category: "Painting",
    description: "Interior painting labor for standard room or defined area.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 450,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Touch-Up Paint",
    category: "Painting",
    description: "Touch-up paint for minor corrections, scuffs, patches, or turnover work.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 150,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Door Repair / Adjustment",
    category: "Carpentry",
    description: "Repair or adjust sticking door, latch alignment, hinges, or basic door hardware.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 125,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "Door Installation",
    category: "Carpentry",
    description: "Install standard interior door or similar approved door component.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 275,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
  {
    item: "General Carpentry Repair",
    category: "Carpentry",
    description: "General carpentry or wood repair including fence, gate, trim, or small structural repair work.",
    qty: 1,
    laborMode: "hourly",
    laborFlat: 0,
    laborHours: 1,
    laborRate: 95,
    materials: 0,
    taxable: true,
  },
  {
    item: "Door Lock Replacement (Handle + Deadbolt)",
    category: "Carpentry",
    description: "Remove and replace entry handle and deadbolt, align hardware, and verify operation.",
    qty: 1,
    laborMode: "flat",
    laborFlat: 125,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
  },
];

const ALL_PRESETS = [...SERVICE_PRESETS, ...MATERIAL_PRESETS];

const emptyJob: JobInfo = {
  street: "",
  city: "",
  state: "WA",
  zip: "",
  client: "",
  preparedBy: "",
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function money(value: number) {
  return (Number(value) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function moneyInput(value: number) {
  return (Number(value) || 0).toFixed(2);
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  const normalized = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

type CurrencyInputProps = {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
};

function CurrencyInput({ value, onChange, placeholder = "0.00" }: CurrencyInputProps) {
  const [draft, setDraft] = useState(moneyInput(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(moneyInput(value));
    }
  }, [value, isFocused]);

  return (
    <div className="currency-wrap">
      <span className="currency-prefix">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          const firstDot = raw.indexOf(".");
          const cleanDraft = firstDot === -1 ? raw : raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
          setDraft(cleanDraft);
          onChange(parseMoney(cleanDraft));
        }}
        onFocus={(e) => {
          setIsFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setIsFocused(false);
          const formatted = moneyInput(parseMoney(draft));
          setDraft(formatted);
          onChange(parseMoney(formatted));
        }}
        className="currency-input"
      />
    </div>
  );
}

function numberValue(value: number) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function newBlankLine(): EstimateLine {
  return {
    id: makeId(),
    category: "General",
    item: "Custom Line Item",
    description: "",
    qty: 1,
    laborMode: "flat",
    laborFlat: 0,
    laborHours: 0,
    laborRate: 0,
    materials: 0,
    taxable: true,
    internalNotes: "",
  };
}

function lineFromPreset(preset: Preset): EstimateLine {
  return {
    id: makeId(),
    category: preset.category,
    item: preset.item,
    description: preset.description,
    qty: preset.qty,
    laborMode: preset.laborMode,
    laborFlat: preset.laborFlat,
    laborHours: preset.laborHours,
    laborRate: preset.laborRate,
    materials: preset.materials,
    taxable: preset.taxable,
    internalNotes: "",
  };
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export default function CostEstimator() {
  const [job, setJob] = useState<JobInfo>(emptyJob);
  const [lines, setLines] = useState<EstimateLine[]>([lineFromPreset(SERVICE_PRESETS[4])]);
  const [taxRate, setTaxRate] = useState(10.5);
  const [taxMode, setTaxMode] = useState<TaxMode>("include");
  const [manualContingency, setManualContingency] = useState(0);
  const [estimateNotes, setEstimateNotes] = useState(
    "Estimate is provided for owner review and approval. Final cost may vary if additional hidden conditions are discovered."
  );
  const [viewMode, setViewMode] = useState<ViewMode>("internal");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setJob(parsed.job || emptyJob);
      setLines(Array.isArray(parsed.lines) && parsed.lines.length ? parsed.lines : [lineFromPreset(SERVICE_PRESETS[4])]);
      setTaxRate(numberValue(parsed.taxRate ?? 10.5));
      setTaxMode(parsed.taxMode === "exclude" ? "exclude" : "include");
      setManualContingency(numberValue(parsed.manualContingency ?? 0));
      setEstimateNotes(parsed.estimateNotes || estimateNotes);
    } catch {
      setStatus("Local saved estimate could not be loaded.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const lineDetails = lines.map((line) => {
      const qty = numberValue(line.qty);
      const laborUnit = line.laborMode === "hourly" ? numberValue(line.laborHours) * numberValue(line.laborRate) : numberValue(line.laborFlat);
      const materialUnit = numberValue(line.materials);
      const laborTotal = laborUnit;
      const materialTotal = materialUnit * qty;
      const subtotal = laborTotal + materialTotal;
      const taxableAmount = line.taxable ? subtotal : 0;
      const tax = taxMode === "include" ? taxableAmount * (numberValue(taxRate) / 100) : 0;
      const total = subtotal + tax;

      return {
        id: line.id,
        laborUnit,
        materialUnit,
        laborTotal,
        materialTotal,
        subtotal,
        taxableAmount,
        tax,
        total,
      };
    });

    const subtotal = lineDetails.reduce((sum, line) => sum + line.subtotal, 0);
    const taxableAmount = lineDetails.reduce((sum, line) => sum + line.taxableAmount, 0);
    const tax = lineDetails.reduce((sum, line) => sum + line.tax, 0);
    const total = subtotal + tax + numberValue(manualContingency);

    return { lineDetails, subtotal, taxableAmount, tax, total };
  }, [lines, manualContingency, taxMode, taxRate]);


  const estimateNumber = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}-${String(lines.length).padStart(3, "0")}`;
  }, [lines.length]);

  function detailForLine(lineId: string) {
    return totals.lineDetails.find((item) => item.id === lineId);
  }

  const tripFeeAmount = useMemo(() => {
    const tripLine = lines.find((line) => isTripLine(line));
    return tripLine ? numberValue(tripLine.laborFlat) : 0;
  }, [lines]);

  function updateTripFee(value: number) {
    const amount = numberValue(value);
    setLines((prev) => {
      const existingTrip = prev.find((line) => isTripLine(line));

      if (!existingTrip && amount <= 0) return prev;

      if (!existingTrip) {
        const tripPreset = MATERIAL_PRESETS.find((preset) => preset.item === "Trip / Service Fee");
        if (!tripPreset) return prev;
        return [...prev, { ...lineFromPreset(tripPreset), laborFlat: amount }];
      }

      return prev.map((line) => (isTripLine(line) ? { ...line, laborFlat: amount, materials: 0, taxable: true } : line));
    });
  }

  function isTripLine(line: EstimateLine) {
    const item = line.item.toLowerCase();
    return item.includes("trip") || item.includes("service fee");
  }

  function updateJob(field: keyof JobInfo, value: string) {
    setJob((prev) => ({ ...prev, [field]: field === "state" ? "WA" : value }));
  }

  function updateLine(id: string, patch: Partial<EstimateLine>) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function applyPreset(lineId: string, itemName: string) {
    const preset = ALL_PRESETS.find((item) => item.item === itemName);
    if (!preset) return;

    updateLine(lineId, {
      category: preset.category,
      item: preset.item,
      description: preset.description,
      qty: preset.qty,
      laborMode: preset.laborMode,
      laborFlat: preset.laborFlat,
      laborHours: preset.laborHours,
      laborRate: preset.laborRate,
      materials: preset.materials,
      taxable: preset.taxable,
    });
  }

  function addLine() {
    setLines((prev) => [...prev, newBlankLine()]);
  }

  function addTripFee() {
    const tripPreset = MATERIAL_PRESETS.find((preset) => preset.item === "Trip / Service Fee");
    if (!tripPreset) return;
    setLines((prev) => [...prev, lineFromPreset(tripPreset)]);
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length === 1 ? [newBlankLine()] : prev.filter((line) => line.id !== id)));
  }

  function saveLocal() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ job, lines, taxRate, taxMode, manualContingency, estimateNotes })
    );
    setStatus("Saved locally.");
  }

  async function saveCloud() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Cloud save failed: Supabase environment variables are missing.");
      return;
    }

    const payload = {
      job,
      lines,
      taxRate,
      taxMode,
      manualContingency,
      estimateNotes,
      totals,
      savedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from(TABLE_NAME).insert({
      title: job.street || job.client || "Cost Estimate",
      property_street: job.street,
      property_city: job.city,
      property_state: "WA",
      property_zip: job.zip,
      client_name: job.client,
      prepared_by: job.preparedBy,
      payload,
    });

    setStatus(error ? `Cloud save failed: ${error.message}` : "Saved to cloud.");
  }

  async function loadCloud() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Cloud load failed: Supabase environment variables are missing.");
      return;
    }

    const { data, error } = await supabase.from(TABLE_NAME).select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (error) {
      setStatus(`Cloud load failed: ${error.message}`);
      return;
    }

    if (!data?.payload) {
      setStatus("No cloud estimate found.");
      return;
    }

    const payload = data.payload as any;
    setJob(payload.job || {
      street: data.property_street || "",
      city: data.property_city || "",
      state: "WA",
      zip: data.property_zip || "",
      client: data.client_name || "",
      preparedBy: data.prepared_by || "",
    });
    setLines(Array.isArray(payload.lines) && payload.lines.length ? payload.lines : [newBlankLine()]);
    setTaxRate(numberValue(payload.taxRate ?? 10.5));
    setTaxMode(payload.taxMode === "exclude" ? "exclude" : "include");
    setManualContingency(numberValue(payload.manualContingency ?? 0));
    setEstimateNotes(payload.estimateNotes || "");
    setStatus("Loaded latest cloud estimate.");
  }

  function clearEstimate() {
    setJob(emptyJob);
    setLines([lineFromPreset(SERVICE_PRESETS[4])]);
    setTaxRate(10.5);
    setTaxMode("include");
    setManualContingency(0);
    setEstimateNotes("Estimate is provided for owner review and approval. Final cost may vary if additional hidden conditions are discovered.");
    setStatus("Estimate cleared.");
  }

  function printEstimate() {
    const previousMode = viewMode;
    setViewMode("owner");
    window.setTimeout(() => {
      window.print();
      setViewMode(previousMode);
    }, 75);
  }

  return (
    <main className="min-h-screen bg-[#eee9df] text-[#111111]">
      <style jsx global>{`
        .print-only { display: none; }

        @media print {
          @page {
            size: letter;
            margin: 0.45in;
          }

          html,
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print,
          .app-ui {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b border-[#d8d2c4] bg-[#eee9df]/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="rounded-lg border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]">
            ← Back to Dashboard
          </Link>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setViewMode(viewMode === "internal" ? "owner" : "internal")} className="rounded-lg border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]">
              View: {viewMode === "internal" ? "Internal" : "Owner"}
            </button>
            <button onClick={loadCloud} className="rounded-lg border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]">
              Load Cloud
            </button>
            <button onClick={saveCloud} className="rounded-lg border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]">
              Save Cloud
            </button>
            <button onClick={saveLocal} className="rounded-lg border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]">
              Save Local
            </button>
            <button onClick={clearEstimate} className="rounded-lg border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-[#fffdf7]">
              Clear
            </button>
            <button onClick={printEstimate} className="rounded-lg bg-[#c9a227] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#b38f1f]">
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      <section className="app-ui mx-auto max-w-6xl px-5 py-6">
        <div className="print-card rounded-2xl border border-[#d8d2c4] bg-[#f7f4ed] p-5 shadow-sm">
          <header className="mb-5 border-b border-[#d8d2c4] pb-5">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="mb-3 h-1.5 w-20 rounded-full bg-[#c9a227]" />
                <h1 className="text-3xl font-extrabold tracking-tight">Cost Estimator</h1>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#c18f00]">5Tools Cost Estimator</p>
              </div>
              <div className="rounded-2xl bg-black px-5 py-4 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#c9a227]">5Tools</p>
                <p className="mt-1 text-xs font-semibold">Repair • Maintenance • Project Support</p>
              </div>
            </div>
          </header>

          {status && <div className="no-print mb-4 rounded-xl border border-[#d8d2c4] bg-white px-4 py-3 text-sm font-semibold text-[#3b3324]">{status}</div>}

          <section className="grid gap-4 md:grid-cols-12">
            <label className="md:col-span-6">
              <span className="label">Property / Job Address</span>
              <input value={job.street} onChange={(e) => updateJob("street", e.target.value)} placeholder="Street address" className="input" />
            </label>
            <label className="md:col-span-2">
              <span className="label">City</span>
              <input value={job.city} onChange={(e) => updateJob("city", e.target.value)} placeholder="City" className="input" />
            </label>
            <label className="md:col-span-2">
              <span className="label">State</span>
              <input value="WA" readOnly className="input font-bold" />
            </label>
            <label className="md:col-span-2">
              <span className="label">Zip Code</span>
              <input value={job.zip} onChange={(e) => updateJob("zip", e.target.value)} placeholder="Zip" className="input" />
            </label>
            <label className="md:col-span-6">
              <span className="label">Owner / Client</span>
              <input value={job.client} onChange={(e) => updateJob("client", e.target.value)} placeholder="Owner or client name" className="input" />
            </label>
            <label className="md:col-span-6">
              <span className="label">Prepared By</span>
              <input value={job.preparedBy} onChange={(e) => updateJob("preparedBy", e.target.value)} placeholder="Prepared by" className="input" />
            </label>
            <label className="md:col-span-4">
              <span className="label">Local Tax Rate %</span>
              <input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(numberValue(Number(e.target.value)))} className="input" />
            </label>
            <label className="md:col-span-4">
              <span className="label">Tax</span>
              <select value={taxMode} onChange={(e) => setTaxMode(e.target.value as TaxMode)} className="input">
                <option value="include">Include local tax</option>
                <option value="exclude">Exclude local tax</option>
              </select>
            </label>
            <label className="md:col-span-4">
              <span className="label">Manual Contingency $</span>
              <CurrencyInput value={manualContingency} onChange={setManualContingency} />
            </label>
            <label className="md:col-span-4">
              <span className="label">Trip / Service Fee $</span>
              <CurrencyInput value={tripFeeAmount} onChange={updateTripFee} />
            </label>
          </section>

          <section className="mt-6 space-y-4">
            {lines.map((line, index) => {
              const detail = totals.lineDetails.find((item) => item.id === line.id);
              return (
                <div key={line.id} className="rounded-2xl border border-[#d8d2c4] bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="font-bold">Line Item {index + 1}</h2>
                    {viewMode === "internal" && (
                      <button onClick={() => removeLine(line.id)} className="no-print text-sm font-bold text-red-600 hover:underline">
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-12">
                    <label className="md:col-span-3">
                      <span className="label">Preset / Item</span>
                      <select value={line.item} onChange={(e) => applyPreset(line.id, e.target.value)} className="input">
                        <option value={line.item}>{line.item}</option>
                        <optgroup label="Labor / Services">
                          {SERVICE_PRESETS.map((preset) => <option key={preset.item} value={preset.item}>{preset.item}</option>)}
                        </optgroup>
                        <optgroup label="Materials / Fees">
                          {MATERIAL_PRESETS.map((preset) => <option key={preset.item} value={preset.item}>{preset.item}</option>)}
                        </optgroup>
                      </select>
                    </label>
                    <label className="md:col-span-3">
                      <span className="label">Category</span>
                      <input value={line.category} onChange={(e) => updateLine(line.id, { category: e.target.value })} className="input" />
                    </label>
                    <label className="md:col-span-3">
                      <span className="label">Qty</span>
                      <input type="number" min="0" step="0.01" value={line.qty} onChange={(e) => updateLine(line.id, { qty: numberValue(Number(e.target.value)) })} className="input" />
                    </label>
                    <label className="md:col-span-3">
                      <span className="label">Taxable</span>
                      <select value={line.taxable ? "yes" : "no"} onChange={(e) => updateLine(line.id, { taxable: e.target.value === "yes" })} className="input">
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                    <label className="md:col-span-12">
                      <span className="label">Description</span>
                      <textarea value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} className="input min-h-[70px]" />
                    </label>
                    <label className="md:col-span-3">
                      <span className="label">Labor Type</span>
                      <select value={line.laborMode} onChange={(e) => updateLine(line.id, { laborMode: e.target.value as LaborMode })} className="input">
                        <option value="flat">Flat Rate</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </label>
                    {line.laborMode === "flat" ? (
                      <label className="md:col-span-3">
                        <span className="label">Labor $</span>
                        <CurrencyInput value={line.laborFlat} onChange={(value) => updateLine(line.id, { laborFlat: value })} />
                      </label>
                    ) : (
                      <>
                        <label className="md:col-span-2">
                          <span className="label">Hours</span>
                          <input type="number" step="0.25" value={line.laborHours} onChange={(e) => updateLine(line.id, { laborHours: numberValue(Number(e.target.value)) })} className="input" />
                        </label>
                        <label className="md:col-span-2">
                          <span className="label">Rate $</span>
                          <CurrencyInput value={line.laborRate} onChange={(value) => updateLine(line.id, { laborRate: value })} />
                        </label>
                      </>
                    )}
                    <label className="md:col-span-3">
                      <span className="label">Materials $</span>
                      <CurrencyInput value={line.materials} onChange={(value) => updateLine(line.id, { materials: value })} />
                    </label>
                    <label className="md:col-span-3">
                      <span className="label">Line Total</span>
                      <input value={money(detail?.total || 0)} readOnly className="input font-bold" />
                    </label>
                    {viewMode === "internal" && (
                      <label className="print-owner-hide md:col-span-12">
                        <span className="label">Internal Notes</span>
                        <textarea value={line.internalNotes} onChange={(e) => updateLine(line.id, { internalNotes: e.target.value })} placeholder="Internal notes hidden from owner print view" className="input min-h-[62px]" />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <div className="no-print mt-4 flex flex-wrap gap-2">
            <button onClick={addLine} className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#222]">
              + Add Line Item
            </button>
            <button onClick={addTripFee} className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2 text-sm font-bold text-[#111111] shadow-sm hover:bg-[#fffdf7]">
              + Trip / Service Fee
            </button>
          </div>

          <section className="mt-6 grid gap-5 lg:grid-cols-12">
            <label className="lg:col-span-8">
              <span className="label">Estimate Notes</span>
              <textarea value={estimateNotes} onChange={(e) => setEstimateNotes(e.target.value)} className="input min-h-[88px] bg-white" />
            </label>

            <aside className="lg:col-span-4 rounded-2xl border border-[#d8d2c4] bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">Estimate Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="summary-row"><span>Trip / Service Fee</span><strong>{money(tripFeeAmount)}</strong></div>
                <div className="summary-row"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                <div className="summary-row"><span>Taxable Amount</span><strong>{money(totals.taxableAmount)}</strong></div>
                <div className="summary-row"><span>Local Tax ({taxRate}%)</span><strong>{money(totals.tax)}</strong></div>
                <div className="summary-row"><span>Contingency</span><strong>{money(manualContingency)}</strong></div>
                <div className="border-t border-[#d8d2c4] pt-3 summary-row text-base"><span>Total Estimate</span><strong>{money(totals.total)}</strong></div>
              </div>
            </aside>
          </section>
        </div>
      </section>



      <section className="print-only bg-white px-2 py-0 text-[#111111]">
        <div className="mx-auto max-w-[7.5in]">
          <header className="mb-6 border-b border-[#d8d2c4] pb-4">
            <div className="flex items-start justify-between gap-8">
              <div>
                <div className="mb-3 h-1.5 w-20 rounded-full bg-[#c9a227]" />
                <h1 className="text-3xl font-extrabold tracking-tight">Cost Estimate</h1>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#c18f00]">5Tools Cost Estimator</p>
              </div>

              <div className="min-w-[2.25in] rounded-2xl bg-[#111111] px-5 py-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#c9a227]">5Tools</p>
                <p className="mt-1 text-[11px] font-semibold">Repair • Maintenance • Project Support</p>
                <p className="mt-3 text-[10px] font-semibold text-[#d8d2c4]">Estimate # {estimateNumber}</p>
              </div>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 text-[12px]">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#3b3324]">Property / Job Address</p>
              <p className="mt-1 font-semibold">{job.street || "Street address"}</p>
              <p className="text-[#555]">{job.city || "City"}, WA {job.zip || "Zip"}</p>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#3b3324]">Prepared For</p>
              <p className="mt-1 font-semibold">{job.client || "Owner / Client"}</p>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#3b3324]">Prepared By</p>
              <p className="mt-1 font-semibold">{job.preparedBy || "Prepared by"}</p>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#3b3324]">Estimate Details</p>
              <p className="mt-1 font-semibold">Estimate # {estimateNumber}</p>
              <p className="text-[#555]">Local Tax: {taxMode === "include" ? `${taxRate}%` : "Not Included"}</p>
            </div>
          </section>

          <section className="mb-5 break-inside-avoid">
            <div className="mb-2 flex items-center justify-between border-b-2 border-[#111111] pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]">Scope of Work</h2>
              <span className="text-[11px] font-bold text-[#6b6255]">Owner Review Copy</span>
            </div>

            <ul className="space-y-2 text-[11px] leading-5 text-[#222]">
              {lines.map((line, index) => (
                <li key={line.id} className="flex gap-2">
                  <span className="font-extrabold text-[#c18f00]">{index + 1}.</span>
                  <span>{line.description || line.item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-5 break-inside-avoid">
            <div className="mb-2 border-b-2 border-[#111111] pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]">Materials</h2>
            </div>

            <div className="space-y-2">
              {lines.filter((line) => !isTripLine(line) && (detailForLine(line.id)?.materialTotal || 0) > 0).length === 0 ? (
                <p className="text-[11px] text-[#555]">No material charges listed.</p>
              ) : (
                lines
                  .filter((line) => !isTripLine(line) && (detailForLine(line.id)?.materialTotal || 0) > 0)
                  .map((line) => {
                    const detail = detailForLine(line.id);
                    return (
                      <div key={`${line.id}-materials`} className="grid grid-cols-[1fr_0.7in_1in_1in] gap-3 border-b border-[#eee3d1] py-2 text-[11px]">
                        <div>
                          <p className="font-extrabold">{line.item}</p>
                          <p className="mt-1 text-[10px] leading-4 text-[#6b6255]">{line.category}</p>
                        </div>
                        <div className="text-right">Qty {line.qty}</div>
                        <div className="text-right">{money(line.materials)} ea.</div>
                        <div className="text-right font-extrabold">{money(detail?.materialTotal || 0)}</div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          <section className="mb-5 break-inside-avoid">
            <div className="mb-2 border-b-2 border-[#111111] pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]">Labor</h2>
            </div>

            <div className="space-y-2">
              {lines.filter((line) => !isTripLine(line) && (detailForLine(line.id)?.laborTotal || 0) > 0).length === 0 ? (
                <p className="text-[11px] text-[#555]">No labor charges listed.</p>
              ) : (
                lines
                  .filter((line) => !isTripLine(line) && (detailForLine(line.id)?.laborTotal || 0) > 0)
                  .map((line) => {
                    const detail = detailForLine(line.id);
                    return (
                      <div key={`${line.id}-labor`} className="grid grid-cols-[1fr_1.1in_1in] gap-3 border-b border-[#eee3d1] py-2 text-[11px]">
                        <div>
                          <p className="font-extrabold">{line.item}</p>
                          <p className="mt-1 text-[10px] leading-4 text-[#6b6255]">{line.laborMode === "hourly" ? `${line.laborHours} hour(s) @ ${money(line.laborRate)}/hr` : "Flat rate"}</p>
                        </div>
                        <div className="text-right">{line.laborMode === "hourly" ? "Hourly" : "Flat Rate"}</div>
                        <div className="text-right font-extrabold">{money(detail?.laborTotal || 0)}</div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          <section className="mb-5 break-inside-avoid">
            <div className="mb-2 border-b-2 border-[#111111] pb-2">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.18em]">Trip / Service Fee</h2>
            </div>

            <div className="space-y-2">
              {lines.filter((line) => isTripLine(line)).length === 0 ? (
                <p className="text-[11px] text-[#555]">No trip or service fee listed.</p>
              ) : (
                lines
                  .filter((line) => isTripLine(line))
                  .map((line) => {
                    const detail = detailForLine(line.id);
                    return (
                      <div key={`${line.id}-trip`} className="grid grid-cols-[1fr_1in] gap-3 border-b border-[#eee3d1] py-2 text-[11px]">
                        <div>
                          <p className="font-extrabold">{line.item}</p>
                          <p className="mt-1 text-[10px] leading-4 text-[#6b6255]">{line.description}</p>
                        </div>
                        <div className="text-right font-extrabold">{money(detail?.subtotal || 0)}</div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          <section className="grid grid-cols-[1fr_2.45in] gap-6 border-t border-[#d8d2c4] pt-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#3b3324]">Estimate Notes</p>
              <p className="mt-2 text-[11px] leading-5 text-[#222]">{estimateNotes}</p>
            </div>

            <aside className="rounded-xl border border-[#d8d2c4] bg-[#fffdf7] p-4 text-[11px]">
              <h2 className="mb-3 text-sm font-extrabold">Estimate Summary</h2>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dotted border-[#b9ad99] pb-1"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dotted border-[#b9ad99] pb-1"><span>Taxable Labor & Materials</span><strong>{money(totals.taxableAmount)}</strong></div>
                <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dotted border-[#b9ad99] pb-1"><span>Local Tax ({taxMode === "include" ? `${taxRate}%` : "Not Included"})</span><strong>{money(totals.tax)}</strong></div>
                <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dotted border-[#b9ad99] pb-1"><span>Contingency</span><strong>{money(manualContingency)}</strong></div>
                <div className="mt-3 border-t border-[#d8d2c4] pt-3 text-[14px]">
                  <div className="grid grid-cols-[1fr_auto] gap-4"><span className="font-extrabold">Total Estimate</span><strong>{money(totals.total)}</strong></div>
                </div>
              </div>
            </aside>
          </section>

          <footer className="mt-6 border-t border-[#d8d2c4] pt-3 text-[9px] leading-4 text-[#555]">
            This estimate is provided for owner review and approval. Final cost may vary if additional hidden conditions are discovered, material prices change, or additional work is authorized.
          </footer>
        </div>
      </section>

      <style jsx>{`
        .label {
          display: block;
          margin-bottom: 0.45rem;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #3b3324;
        }
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #d8d2c4;
          background: #fbfaf6;
          padding: 0.65rem 0.75rem;
          font-size: 0.875rem;
          color: #111111;
          outline: none;
        }
        .input:focus {
          border-color: #c9a227;
          box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.18);
        }
        .currency-wrap {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #d8d2c4;
          background: #fbfaf6;
          color: #111111;
          overflow: hidden;
        }
        .currency-wrap:focus-within {
          border-color: #c9a227;
          box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.18);
        }
        .currency-prefix {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.875rem;
          font-weight: 800;
          color: #3b3324;
          user-select: none;
          pointer-events: none;
        }
        .currency-input {
          min-width: 0;
          width: 100%;
          border: 0;
          background: transparent;
          padding: 0.65rem 0.75rem 0.65rem 1.85rem;
          font-size: 0.875rem;
          color: #111111;
          outline: none;
        }
        .currency-input::placeholder {
          color: #8a8172;
        }
        .summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
      `}</style>
    </main>
  );
}
