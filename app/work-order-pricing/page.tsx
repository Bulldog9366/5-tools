"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Category =
  | "Appliance"
  | "Plumbing"
  | "Electrical"
  | "HVAC"
  | "Drywall / Paint"
  | "Flooring"
  | "Doors / Locks"
  | "General Handyman"
  | "Cleaning / Trash-Out"
  | "Exterior / Yard"
  | "Safety / Habitability";

type PriceType =
  | "Labor"
  | "Material"
  | "Package"
  | "Service Call"
  | "Disposal"
  | "Trip Fee"
  | "Other";

type NotebookGroup = {
  id: string;
  category: Category;
  name: string;
  notes: string;
};

type NotebookLine = {
  id: string;
  groupId: string;
  category: Category;
  description: string;
  type: PriceType;
  price: string;
  taxable: boolean;
  notes: string;
};

type BuilderLine = {
  id: string;
  sourceLineId?: string;
  description: string;
  type: PriceType;
  qty: string;
  unitPrice: string;
  taxable: boolean;
};

type WorkOrderInfo = {
  sourceId?: string;
  workOrderNumber: string;
  status: string;
  createdOn: string;
  maintenanceLimit: string;
  propertyAddress: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  issueCategory: string;
  problemDescription: string;
  accessNotes: string;
};

type PushedWorkOrder = Partial<WorkOrderInfo> & {
  id?: string;
  sourceId?: string;
  workOrderNumber?: string;
  propertyAddress?: string;
  address?: string;
  fullAddress?: string;
  property?: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
  status?: string;
  category?: string;
  issueCategory?: string;
  description?: string;
  problemDescription?: string;
  issueDescription?: string;
  accessNotes?: string;
  maintenanceLimit?: string | number;
  createdAt?: string;
  createdOn?: string;
};

type SavedPricingRecord = {
  id: string;
  savedAt: string;
  workOrder: WorkOrderInfo;
  builderLines: BuilderLine[];
  taxRate: string;
  taxName?: string;
};

type SharedNotebookRecord = {
  id: string;
  groups_json: NotebookGroup[];
  lines_json: NotebookLine[];
  updated_at?: string;
};

const CATEGORIES: Category[] = [
  "Appliance",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Drywall / Paint",
  "Flooring",
  "Doors / Locks",
  "General Handyman",
  "Cleaning / Trash-Out",
  "Exterior / Yard",
  "Safety / Habitability",
];

const PRICE_TYPES: PriceType[] = [
  "Labor",
  "Material",
  "Package",
  "Service Call",
  "Disposal",
  "Trip Fee",
  "Other",
];

const TAX_RATE_OPTIONS = [
  { name: "Auburn", rate: "10.20" },
  { name: "Bremerton", rate: "9.20" },
  { name: "Des Moines", rate: "10.10" },
  { name: "Federal Way", rate: "10.30" },
  { name: "Fife", rate: "10.00" },
  { name: "Gig Harbor", rate: "8.10" },
  { name: "Graham", rate: "9.40" },
  { name: "Issaquah", rate: "10.50" },
  { name: "Kent", rate: "10.10" },
  { name: "Lakebay", rate: "8.10" },
  { name: "Lakewood", rate: "10.00" },
  { name: "Lynwood", rate: "10.60" },
  { name: "Marysville", rate: "9.40" },
  { name: "Parkland", rate: "9.40" },
  { name: "Port Orchard", rate: "9.30" },
  { name: "Puyallup", rate: "10.10" },
  { name: "Renton", rate: "10.10" },
  { name: "Seattle", rate: "10.25" },
  { name: "Silverdale", rate: "9.20" },
  { name: "Spanaway", rate: "10.00" },
  { name: "Steilacoom", rate: "10.10" },
  { name: "Tacoma", rate: "10.30" },
  { name: "Tukwila", rate: "10.10" },
  { name: "University Place", rate: "10.00" },
  { name: "Vashon Island", rate: "8.70" },
].sort((a, b) => a.name.localeCompare(b.name));


const NOTEBOOK_GROUPS_KEY = "five_tools_pricing_notebook_groups_v2";
const NOTEBOOK_LINES_KEY = "five_tools_pricing_notebook_lines_v2";
const BUILDER_STORAGE_KEY = "five_tools_work_order_pricing_builder_v2";
const SAVED_RECORDS_KEY = "five_tools_work_order_pricing_saved_records_v1";
const WORK_ORDER_PRICING_QUEUE_KEY = "five_tools_work_order_pricing_queue_v1";
const WORK_ORDER_PRICING_RETURN_QUEUE_KEY = "five_tools_work_order_pricing_return_queue_v1";
const SERVICE_TICKET_PRICING_RETURN_QUEUE_KEY = "five_tools_service_ticket_pricing_return_queue_v1";
const SERVICE_TICKET_PRICING_DRAFT_KEY = "five_tools_service_ticket_pricing_return_draft_v1";
const SHARED_NOTEBOOK_ID = "shared";
const SHARED_NOTEBOOK_TABLE = "work_order_pricing_notebook";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const DEFAULT_WORK_ORDER: WorkOrderInfo = {
  workOrderNumber: "",
  status: "New",
  createdOn: new Date().toISOString().slice(0, 10),
  maintenanceLimit: "",
  propertyAddress: "",
  unit: "",
  city: "",
  state: "WA",
  zip: "",
  issueCategory: "",
  problemDescription: "",
  accessNotes: "",
};

const STARTER_GROUPS: NotebookGroup[] = [
  {
    id: "grp-appliance-dishwasher",
    category: "Appliance",
    name: "Dishwasher",
    notes: "Dishwasher repair, replacement, install kit, and disposal charges.",
  },
  {
    id: "grp-appliance-stove",
    category: "Appliance",
    name: "Stove / Range",
    notes:
      "Stove, range, burner, oven, and gas/electric cooking appliance charges.",
  },
  {
    id: "grp-appliance-range-hood",
    category: "Appliance",
    name: "Range Hood",
    notes: "Range hood repair/replacement and vent connection charges.",
  },
  {
    id: "grp-electrical-outlet",
    category: "Electrical",
    name: "Outlet / Switch",
    notes: "Standard outlet, GFCI, switch, plate, and replacement labor.",
  },
  {
    id: "grp-electrical-light",
    category: "Electrical",
    name: "Light Fixture",
    notes: "Fixture replacement and basic troubleshooting.",
  },
  {
    id: "grp-plumbing-toilet",
    category: "Plumbing",
    name: "Toilet",
    notes:
      "Toilet repair, reset, replacement, supply line, wax ring, and shutoff work.",
  },
  {
    id: "grp-plumbing-faucet",
    category: "Plumbing",
    name: "Faucet / Sink",
    notes: "Faucet replacement, leak repair, supply lines, and drain work.",
  },
];

const STARTER_LINES: NotebookLine[] = [
  {
    id: "line-dw-disposal",
    groupId: "grp-appliance-dishwasher",
    category: "Appliance",
    description: "Disposal of old unit",
    type: "Disposal",
    price: "0.00",
    taxable: true,
    notes: "Haul away / disposal charge.",
  },
  {
    id: "line-dw-install",
    groupId: "grp-appliance-dishwasher",
    category: "Appliance",
    description: "Dishwasher installation labor",
    type: "Labor",
    price: "0.00",
    taxable: true,
    notes: "Remove and install new dishwasher.",
  },
  {
    id: "line-dw-kit",
    groupId: "grp-appliance-dishwasher",
    category: "Appliance",
    description: "Dishwasher install kit",
    type: "Material",
    price: "0.00",
    taxable: true,
    notes: "Hose, clamps, fittings, etc.",
  },
  {
    id: "line-dw-unit",
    groupId: "grp-appliance-dishwasher",
    category: "Appliance",
    description: "Dishwasher unit",
    type: "Material",
    price: "0.00",
    taxable: true,
    notes: "Standard white or approved equivalent.",
  },
  {
    id: "line-range-diagnostic",
    groupId: "grp-appliance-stove",
    category: "Appliance",
    description: "Range / stove diagnostic",
    type: "Service Call",
    price: "0.00",
    taxable: true,
    notes: "Initial diagnostic charge.",
  },
  {
    id: "line-range-install",
    groupId: "grp-appliance-stove",
    category: "Appliance",
    description: "Stove / range installation labor",
    type: "Labor",
    price: "0.00",
    taxable: true,
    notes: "Install replacement unit.",
  },
  {
    id: "line-hood-install",
    groupId: "grp-appliance-range-hood",
    category: "Appliance",
    description: "Range hood installation labor",
    type: "Labor",
    price: "0.00",
    taxable: true,
    notes: "Install replacement range hood.",
  },
  {
    id: "line-outlet-material",
    groupId: "grp-electrical-outlet",
    category: "Electrical",
    description: "Standard outlet",
    type: "Material",
    price: "0.00",
    taxable: true,
    notes: "Outlet device only.",
  },
  {
    id: "line-outlet-replace",
    groupId: "grp-electrical-outlet",
    category: "Electrical",
    description: "Replace standard outlet",
    type: "Labor",
    price: "0.00",
    taxable: true,
    notes: "Labor to replace existing outlet.",
  },
  {
    id: "line-gfci-material",
    groupId: "grp-electrical-outlet",
    category: "Electrical",
    description: "GFCI outlet",
    type: "Material",
    price: "0.00",
    taxable: true,
    notes: "GFCI device only.",
  },
  {
    id: "line-light-replace",
    groupId: "grp-electrical-light",
    category: "Electrical",
    description: "Replace light fixture",
    type: "Labor",
    price: "0.00",
    taxable: true,
    notes: "Standard fixture swap.",
  },
  {
    id: "line-toilet-trip-fee",
    groupId: "grp-plumbing-toilet",
    category: "Plumbing",
    description: "Trip Fee",
    type: "Trip Fee",
    price: "45.00",
    taxable: true,
    notes: "Trip Charge",
  },
  {
    id: "line-toilet-supply-line",
    groupId: "grp-plumbing-toilet",
    category: "Plumbing",
    description: "Water Supply Line",
    type: "Material",
    price: "14.50",
    taxable: true,
    notes: "",
  },
  {
    id: "line-toilet-standard-toilet",
    groupId: "grp-plumbing-toilet",
    category: "Plumbing",
    description: "Standard Toilet",
    type: "Material",
    price: "200.00",
    taxable: true,
    notes: "Standard toilet.",
  },
  {
    id: "line-toilet-disposal",
    groupId: "grp-plumbing-toilet",
    category: "Plumbing",
    description: "Disposal",
    type: "Disposal",
    price: "90.00",
    taxable: true,
    notes: "Remove and dispose of old toilet.",
  },
  {
    id: "line-toilet-replace",
    groupId: "grp-plumbing-toilet",
    category: "Plumbing",
    description: "Toilet replacement labor",
    type: "Labor",
    price: "310.00",
    taxable: true,
    notes: "Remove and replace toilet.",
  },
  {
    id: "line-toilet-wax-ring",
    groupId: "grp-plumbing-toilet",
    category: "Plumbing",
    description: "Waxless ring",
    type: "Material",
    price: "28.00",
    taxable: true,
    notes: "Common toilet replacement materials.",
  },
  {
    id: "line-faucet-replace",
    groupId: "grp-plumbing-faucet",
    category: "Plumbing",
    description: "Faucet replacement labor",
    type: "Labor",
    price: "0.00",
    taxable: true,
    notes: "Standard faucet replacement.",
  },
];

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function asNumber(value: string | number | undefined | null) {
  const raw = String(value ?? "").replace(/[^0-9.-]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function money(value: string | number | undefined | null) {
  return asNumber(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}


function normalizeTaxName(value: string) {
  return value
    .toLowerCase()
    .replace(/tax/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findTaxRateByCity(city: string) {
  const normalizedCity = normalizeTaxName(city);
  if (!normalizedCity) return null;

  return (
    TAX_RATE_OPTIONS.find(
      (item) => normalizeTaxName(item.name) === normalizedCity,
    ) || null
  );
}

function lineTotal(line: BuilderLine) {
  return asNumber(line.qty || "1") * asNumber(line.unitPrice);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#334155]">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2.5 text-sm text-[#111111] outline-none transition focus:border-[#c9a227] focus:bg-white focus:ring-2 focus:ring-[#c9a227]/20"
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder = "",
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-[#d8d2c4] bg-[#f7f4ed] px-3 py-2.5 text-sm text-[#111111] outline-none transition focus:border-[#c9a227] focus:bg-white focus:ring-2 focus:ring-[#c9a227]/20"
    />
  );
}

export default function WorkOrderPricingPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("Appliance");
  const [groups, setGroups] = useState<NotebookGroup[]>(STARTER_GROUPS);
  const [lines, setLines] = useState<NotebookLine[]>(STARTER_LINES);
  const [activeGroupId, setActiveGroupId] = useState(
    "grp-appliance-dishwasher",
  );
  const [workOrder, setWorkOrder] = useState<WorkOrderInfo>(DEFAULT_WORK_ORDER);
  const [builderLines, setBuilderLines] = useState<BuilderLine[]>([]);
  const [taxRate, setTaxRate] = useState("10.50");
  const [taxName, setTaxName] = useState("Issaquah");
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const [savedRecords, setSavedRecords] = useState<SavedPricingRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [sharedNotebookLoaded, setSharedNotebookLoaded] = useState(false);
  const [sharedNotebookStatus, setSharedNotebookStatus] = useState("Cloud pricing not loaded yet.");

  useEffect(() => {
    let cancelled = false;

    async function loadSavedData() {
      try {
        const savedGroups = localStorage.getItem(NOTEBOOK_GROUPS_KEY);
        if (savedGroups) {
          const parsed = JSON.parse(savedGroups);
          if (Array.isArray(parsed)) setGroups(parsed);
        }

        const savedLines = localStorage.getItem(NOTEBOOK_LINES_KEY);
        if (savedLines) {
          const parsed = JSON.parse(savedLines);
          if (Array.isArray(parsed)) setLines(parsed);
        }

        const savedBuilder = localStorage.getItem(BUILDER_STORAGE_KEY);
        if (savedBuilder) {
          const parsed = JSON.parse(savedBuilder);
          if (parsed?.workOrder)
            setWorkOrder({ ...DEFAULT_WORK_ORDER, ...parsed.workOrder });
          if (Array.isArray(parsed?.builderLines))
            setBuilderLines(parsed.builderLines);
          if (parsed?.taxRate) setTaxRate(parsed.taxRate);
          if (parsed?.taxName) setTaxName(parsed.taxName);
        }

        const saved = localStorage.getItem(SAVED_RECORDS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setSavedRecords(parsed);
        }
      } catch {
        setStatusMessage("Saved local pricing data could not be loaded.");
      }

      try {
        const cloudRecord = await loadSharedNotebookFromCloud();
        if (cancelled) return;

        if (cloudRecord) {
          if (Array.isArray(cloudRecord.groups_json)) {
            setGroups(cloudRecord.groups_json);
            localStorage.setItem(
              NOTEBOOK_GROUPS_KEY,
              JSON.stringify(cloudRecord.groups_json),
            );
          }
          if (Array.isArray(cloudRecord.lines_json)) {
            setLines(cloudRecord.lines_json);
            localStorage.setItem(
              NOTEBOOK_LINES_KEY,
              JSON.stringify(cloudRecord.lines_json),
            );
          }
          setSharedNotebookStatus("Cloud pricing loaded and shared across devices.");
          setStatusMessage("Cloud pricing loaded.");
        } else {
          await saveSharedNotebookToCloud(STARTER_GROUPS, STARTER_LINES);
          if (cancelled) return;
          setSharedNotebookStatus("Cloud pricing table initialized with starter pricing.");
          setStatusMessage("Cloud pricing initialized.");
        }
      } catch {
        if (cancelled) return;
        setSharedNotebookStatus(
          "Cloud pricing not connected. Using this device only until Supabase table/env vars are fixed.",
        );
      } finally {
        if (!cancelled) setSharedNotebookLoaded(true);
      }
    }

    loadSavedData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(NOTEBOOK_GROUPS_KEY, JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem(NOTEBOOK_LINES_KEY, JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    if (!sharedNotebookLoaded) return;
    const timer = window.setTimeout(async () => {
      try {
        await saveSharedNotebookToCloud(groups, lines);
        setSharedNotebookStatus("Cloud pricing saved. Changes are shared across devices.");
      } catch {
        setSharedNotebookStatus(
          "Cloud pricing save failed. This change is only saved on this device.",
        );
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [groups, lines, sharedNotebookLoaded]);

  useEffect(() => {
    localStorage.setItem(
      BUILDER_STORAGE_KEY,
      JSON.stringify({ workOrder, builderLines, taxRate, taxName }),
    );
  }, [workOrder, builderLines, taxRate, taxName]);


  useEffect(() => {
    const matchedTax = findTaxRateByCity(workOrder.city);
    if (!matchedTax) return;

    setTaxName((currentName) =>
      currentName === matchedTax.name ? currentName : matchedTax.name,
    );
    setTaxRate((currentRate) =>
      asNumber(currentRate).toFixed(2) === asNumber(matchedTax.rate).toFixed(2)
        ? currentRate
        : matchedTax.rate,
    );
  }, [workOrder.city]);

  useEffect(() => {
    const firstGroup = groups.find(
      (group) => group.category === activeCategory,
    );
    if (
      firstGroup &&
      !groups.some(
        (group) =>
          group.id === activeGroupId && group.category === activeCategory,
      )
    ) {
      setActiveGroupId(firstGroup.id);
    }
  }, [activeCategory, activeGroupId, groups]);

  const categoryGroups = useMemo(
    () => groups.filter((group) => group.category === activeCategory),
    [groups, activeCategory],
  );

  const activeGroup = useMemo(
    () =>
      groups.find((group) => group.id === activeGroupId) ||
      categoryGroups[0] ||
      null,
    [groups, activeGroupId, categoryGroups],
  );

  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines
      .filter((line) => line.groupId === activeGroup?.id)
      .filter((line) => {
        if (!q) return true;
        return [line.description, line.type, line.notes]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [lines, activeGroup, search]);

  const selectedIds = useMemo(
    () =>
      new Set(builderLines.map((line) => line.sourceLineId).filter(Boolean)),
    [builderLines],
  );

  const totals = useMemo(() => {
    const labor = builderLines
      .filter(
        (line) =>
          line.type === "Labor" ||
          line.type === "Package" ||
          line.type === "Service Call",
      )
      .reduce((sum, line) => sum + lineTotal(line), 0);
    const materials = builderLines
      .filter((line) => line.type === "Material")
      .reduce((sum, line) => sum + lineTotal(line), 0);
    const disposal = builderLines
      .filter((line) => line.type === "Disposal")
      .reduce((sum, line) => sum + lineTotal(line), 0);
    const trip = builderLines
      .filter((line) => line.type === "Trip Fee")
      .reduce((sum, line) => sum + lineTotal(line), 0);
    const other = builderLines
      .filter((line) => line.type === "Other")
      .reduce((sum, line) => sum + lineTotal(line), 0);
    const taxable = builderLines
      .filter((line) => line.taxable)
      .reduce((sum, line) => sum + lineTotal(line), 0);
    const tax = taxable * (asNumber(taxRate) / 100);
    const subtotal = labor + materials + disposal + trip + other;
    return {
      labor,
      materials,
      disposal,
      trip,
      other,
      taxable,
      tax,
      subtotal,
      grand: subtotal + tax,
    };
  }, [builderLines, taxRate]);

  function updateWorkOrder<K extends keyof WorkOrderInfo>(
    key: K,
    value: WorkOrderInfo[K],
  ) {
    setWorkOrder((prev) => ({ ...prev, [key]: value }));
  }

  function updateGroup<K extends keyof NotebookGroup>(
    id: string,
    key: K,
    value: NotebookGroup[K],
  ) {
    setGroups((prev) =>
      prev.map((group) =>
        group.id === id ? { ...group, [key]: value } : group,
      ),
    );
  }

  function addGroup() {
    const group: NotebookGroup = {
      id: uid("group"),
      category: activeCategory,
      name: "New subcategory",
      notes: "",
    };
    setGroups((prev) => [group, ...prev]);
    setActiveGroupId(group.id);
    setStatusMessage(`Added ${activeCategory} subcategory.`);
  }

  function deleteGroup(id: string) {
    if (!window.confirm("Delete this subcategory and all rows under it?"))
      return;
    const deletingLineIds = lines
      .filter((line) => line.groupId === id)
      .map((line) => line.id);
    setGroups((prev) => prev.filter((group) => group.id !== id));
    setLines((prev) => prev.filter((line) => line.groupId !== id));
    setBuilderLines((prev) =>
      prev.filter((line) => !deletingLineIds.includes(line.sourceLineId || "")),
    );
    setStatusMessage("Subcategory deleted.");
  }

  function updateLine<K extends keyof NotebookLine>(
    id: string,
    key: K,
    value: NotebookLine[K],
  ) {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [key]: value } : line)),
    );
  }

  function addNotebookLine() {
    if (!activeGroup) {
      addGroup();
      return;
    }
    const line: NotebookLine = {
      id: uid("price"),
      groupId: activeGroup.id,
      category: activeCategory,
      description: "New pricing item",
      type: "Labor",
      price: "0.00",
      taxable: true,
      notes: "",
    };
    setLines((prev) => [line, ...prev]);
    setStatusMessage(`Added pricing row under ${activeGroup.name}.`);
  }

  function deleteNotebookLine(id: string) {
    setLines((prev) => prev.filter((line) => line.id !== id));
    setBuilderLines((prev) => prev.filter((line) => line.sourceLineId !== id));
    setStatusMessage("Pricing row deleted.");
  }

  function toggleBuilderLine(item: NotebookLine) {
    if (selectedIds.has(item.id)) {
      setBuilderLines((prev) =>
        prev.filter((line) => line.sourceLineId !== item.id),
      );
      setStatusMessage("Removed from pricing builder.");
      return;
    }
    setBuilderLines((prev) => [
      ...prev,
      {
        id: uid("line"),
        sourceLineId: item.id,
        description: item.description,
        type: item.type,
        qty: "1",
        unitPrice: asNumber(item.price).toFixed(2),
        taxable: item.taxable,
      },
    ]);
    setStatusMessage("Added to pricing builder.");
  }

  function addBlankBuilderLine() {
    setBuilderLines((prev) => [
      ...prev,
      {
        id: uid("line"),
        description: "Custom line item",
        type: "Labor",
        qty: "1",
        unitPrice: "0.00",
        taxable: true,
      },
    ]);
    setStatusMessage("Custom pricing line added.");
  }

  function updateBuilderLine<K extends keyof BuilderLine>(
    id: string,
    key: K,
    value: BuilderLine[K],
  ) {
    setBuilderLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [key]: value } : line)),
    );
  }

  function removeBuilderLine(id: string) {
    setBuilderLines((prev) => prev.filter((line) => line.id !== id));
  }


  function firstText(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
  }

  function normalizePushedWorkOrder(incoming: PushedWorkOrder): WorkOrderInfo {
    return {
      sourceId: firstText(incoming.sourceId, incoming.id, incoming.workOrderNumber, workOrder.sourceId),
      workOrderNumber: firstText(incoming.workOrderNumber, incoming.sourceId, incoming.id, workOrder.workOrderNumber),
      status: firstText(incoming.status, workOrder.status, "New"),
      createdOn: firstText(
        incoming.createdOn,
        incoming.createdAt ? incoming.createdAt.slice(0, 10) : "",
        workOrder.createdOn,
        today(),
      ),
      maintenanceLimit: firstText(incoming.maintenanceLimit, workOrder.maintenanceLimit),
      propertyAddress: firstText(
        incoming.propertyAddress,
        incoming.address,
        incoming.fullAddress,
        incoming.property,
        workOrder.propertyAddress,
      ),
      unit: firstText(incoming.unit, workOrder.unit),
      city: firstText(incoming.city, workOrder.city),
      state: firstText(incoming.state, workOrder.state, "WA"),
      zip: firstText(incoming.zip, workOrder.zip),
      issueCategory: firstText(incoming.category, incoming.issueCategory, workOrder.issueCategory),
      problemDescription: firstText(
        incoming.description,
        incoming.problemDescription,
        incoming.issueDescription,
        workOrder.problemDescription,
      ),
      accessNotes: firstText(incoming.accessNotes, workOrder.accessNotes),
    };
  }

  function importPushedWorkOrder() {
    try {
      const raw = localStorage.getItem(WORK_ORDER_PRICING_QUEUE_KEY) || localStorage.getItem("five_tools_work_order_pricing_seed_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      const queue: PushedWorkOrder[] = Array.isArray(parsed) ? parsed : [parsed];
      const incoming = Array.isArray(queue) ? queue[0] : null;
      if (!incoming) {
        setStatusMessage("No pushed work order found.");
        return;
      }
      setWorkOrder(normalizePushedWorkOrder(incoming));
      localStorage.removeItem(WORK_ORDER_PRICING_QUEUE_KEY);
      localStorage.removeItem("five_tools_work_order_pricing_seed_v1");
      setStatusMessage("Pushed work order imported.");
    } catch {
      setStatusMessage("Could not import pushed work order.");
    }
  }

  function sendPricingBackToServiceTicket(record: SavedPricingRecord) {
    try {
      const raw = localStorage.getItem(WORK_ORDER_PRICING_RETURN_QUEUE_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const queue = Array.isArray(existing) ? existing : [];
      const sourceId =
        record.workOrder.sourceId || record.workOrder.workOrderNumber || record.id;
      const payload = {
        sourceId,
        workOrderNumber: record.workOrder.workOrderNumber,
        propertyAddress: record.workOrder.propertyAddress,
        address: record.workOrder.propertyAddress,
        unit: record.workOrder.unit,
        city: record.workOrder.city,
        state: record.workOrder.state,
        zip: record.workOrder.zip,
        status: record.workOrder.status,
        issueCategory: record.workOrder.issueCategory,
        problemDescription: record.workOrder.problemDescription,
        accessNotes: record.workOrder.accessNotes,
        maintenanceLimit: record.workOrder.maintenanceLimit,
        workOrder: record.workOrder,
        pricingRecordId: record.id,
        estimateStatus: "Completed",
        estimateTotal: totals.grand,
        subtotal: totals.subtotal,
        taxRate: asNumber(record.taxRate),
        taxAmount: totals.tax,
        materialsTotal: totals.materials,
        laborTotal: totals.labor,
        disposalTotal: totals.disposal,
        tripFee: totals.trip,
        otherTotal: totals.other,
        lineItems: record.builderLines.map((line) => ({
          id: line.id,
          description: line.description,
          type: line.type,
          qty: asNumber(line.qty || "1"),
          unitPrice: asNumber(line.unitPrice),
          taxable: line.taxable,
          total: lineTotal(line),
        })),
        savedAt: record.savedAt,
      };
      const filtered = queue.filter(
        (item: { sourceId?: string; workOrderNumber?: string }) =>
          (item.sourceId || item.workOrderNumber) !== sourceId,
      );
      const returnPayload = {
        ...payload,
        source: "Work Order Pricing",
        target: "Service Ticket",
        route: "/service-ticket",
      };

      localStorage.setItem(
        SERVICE_TICKET_PRICING_RETURN_QUEUE_KEY,
        JSON.stringify([returnPayload, ...filtered]),
      );
      localStorage.setItem(SERVICE_TICKET_PRICING_DRAFT_KEY, JSON.stringify(returnPayload));

      // Legacy compatibility: keep the old Work Order return queue populated too,
      // but the active pricing loop is Service Ticket -> Work Order Pricing -> Service Ticket.
      localStorage.setItem(
        WORK_ORDER_PRICING_RETURN_QUEUE_KEY,
        JSON.stringify([returnPayload, ...filtered]),
      );
      return true;
    } catch {
      return false;
    }
  }

  function savePricingRecord() {
    const record: SavedPricingRecord = {
      id: uid("pricing-record"),
      savedAt: new Date().toISOString(),
      workOrder,
      builderLines,
      taxRate,
      taxName,
    };
    const next = [record, ...savedRecords].slice(0, 100);
    setSavedRecords(next);
    localStorage.setItem(SAVED_RECORDS_KEY, JSON.stringify(next));
    setSelectedRecordId(record.id);
    const sentBack = sendPricingBackToServiceTicket(record);
    setStatusMessage(
      sentBack
        ? "Pricing record saved and sent back to Service Ticket."
        : "Pricing record saved. Could not send back to Service Ticket.",
    );
  }

  function loadSavedRecord() {
    const record = savedRecords.find((item) => item.id === selectedRecordId);
    if (!record) {
      setStatusMessage("Select a saved record to load.");
      return;
    }
    setWorkOrder({ ...DEFAULT_WORK_ORDER, ...record.workOrder });
    setBuilderLines(record.builderLines || []);
    setTaxRate(record.taxRate || "10.50");
    setTaxName(record.taxName || "");
    setStatusMessage("Saved pricing record loaded.");
  }

  function deleteSavedRecord() {
    if (!selectedRecordId) {
      setStatusMessage("Select a saved record to delete.");
      return;
    }
    const next = savedRecords.filter(
      (record) => record.id !== selectedRecordId,
    );
    setSavedRecords(next);
    localStorage.setItem(SAVED_RECORDS_KEY, JSON.stringify(next));
    setSelectedRecordId(next[0]?.id || "");
    setStatusMessage("Saved pricing record deleted.");
  }

  function clearBuilder() {
    setBuilderLines([]);
    setStatusMessage("Pricing builder cleared.");
  }

  function clearWorkOrder() {
    setWorkOrder({ ...DEFAULT_WORK_ORDER, createdOn: today() });
    setBuilderLines([]);
    setStatusMessage("Pricing page reset.");
  }

  return (
    <main className="min-h-screen bg-[#ece3d4] text-[#1b1b1b] print:bg-white">
      <style jsx global>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          @page { margin: 0.45in; }
          body { background: white !important; color: #111111 !important; }
          main { background: white !important; }
          .no-print, .screen-section { display: none !important; }
          .print-only { display: block !important; }
          .estimate-print-report { color: #111111 !important; font-size: 11px; }
          .estimate-print-report table { width: 100%; border-collapse: collapse; }
          .estimate-print-report th,
          .estimate-print-report td { border-bottom: 1px solid #cfc2b2; padding: 7px 6px; vertical-align: top; }
          .estimate-print-report th { background: #3f2a1b; color: white; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
          .estimate-print-report .page-break { page-break-before: always; break-before: page; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>

      <header className="no-print border-b border-[#a98a67] bg-[#f7f1e7] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-[#2e1f12]">5Tools</h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.35em] text-[#9c6b2f]">
              Repair & Maintenance Workspace
            </p>
          </div>
          <div className="hidden gap-8 text-right text-xs font-bold text-[#5a4633] md:flex">
            <div>
              <p>253.584.8200</p>
              <p className="uppercase text-[#8a7a68]">Call Us</p>
            </div>
            <div>
              <p>Tacoma, Washington</p>
              <p className="uppercase text-[#8a7a68]">Service Area</p>
            </div>
          </div>
        </div>
        <nav className="border-t border-[#8b6b47] bg-[#4d3624] shadow-inner">
          <div className="mx-auto flex max-w-7xl flex-wrap px-8">
            {[
              { label: "Home", href: "/" },
              { label: "Work Orders", href: "/work-order-engine" },
              { label: "Pricing Notebook", href: "/work-order-pricing" },
              { label: "Service Ticket", href: "/service-ticket" },
              { label: "Reports", href: "/inspections" },
              { label: "Scheduler", href: "/project-scheduler" },
              { label: "Projects", href: "/project-tracker" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  link.href === "/work-order-pricing"
                    ? "border-b-4 border-[#d4a66a] bg-[#6b4a31] px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#f5ede2]"
                    : "border-b-4 border-transparent px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#f5ede2] transition hover:border-[#d4a66a] hover:bg-[#6b4a31]"
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <section className="screen-section border-b border-[#b89b79] bg-[linear-gradient(90deg,#8b5e3c_0%,#9b6b45_18%,#7c5235_36%,#a7794f_54%,#815638_72%,#6d482d_100%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-8 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="border border-[#d4b08a] bg-[rgba(35,20,10,0.78)] p-6 shadow-xl backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d4a66a]">Pricing Workstation</p>
            <h2 className="mt-2 text-3xl font-black text-[#fff8f0]">Work Order Pricing</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#f3e8d8]">
              Notebook tabs, preset charge groups, editable estimate builder, saved records, and return pricing back to the Service Ticket.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/work-order-engine" className="border border-[#d4b08a] bg-[#f8f1e7] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[#2f1f14] shadow-lg transition hover:bg-[#efe3d2]">
              Back to Work Orders
            </Link>
            <button type="button" onClick={importPushedWorkOrder} className="border border-[#d4b08a] bg-[#f8f1e7] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-[#2f1f14] shadow-lg transition hover:bg-[#efe3d2]">
              Load Pushed Work Order
            </button>
            <button type="button" onClick={() => window.print()} className="bg-[#c58a3b] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-[#ad742b]">
              Print / PDF
            </button>
            <button type="button" onClick={clearWorkOrder} className="border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-red-700 shadow-lg transition hover:bg-red-100">
              Reset
            </button>
          </div>
        </div>
      </section>

      <div className="estimate-print-report print-only hidden p-8">
        <div className="mb-6 border-b-4 border-[#3f2a1b] pb-4">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-3xl font-black tracking-tight">5 Tools</div>
              <div className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-[#8a6f22]">Work Estimate</div>
              <div className="mt-3 text-xs leading-5 text-[#5b564c]">
                <div>Phone: (253) 592-3161</div>
                <div>15 Oregon Ave #110, Tacoma, WA 98409</div>
                <div>License # 5TOOLTR833KZ</div>
              </div>
            </div>
            <div className="min-w-[260px] border border-[#c9ab86] bg-[#fffdf7] p-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#c9ab86] pb-2"><span className="font-bold">Estimate Date</span><span>{new Date().toLocaleDateString()}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="font-bold">Work Order</span><span>{workOrder.workOrderNumber || "--"}</span></div>
              <div className="mt-2 flex justify-between gap-4"><span className="font-bold">Total</span><span>{money(totals.grand)}</span></div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-5 text-sm">
          <div className="border border-[#c9ab86] p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#8a6f22]">Customer</div>
            <div className="font-bold">Customer / Owner</div>
            <div className="mt-1 text-[#5b564c]">{workOrder.city || ""}{workOrder.state ? `, ${workOrder.state}` : ""} {workOrder.zip || ""}</div>
          </div>
          <div className="border border-[#c9ab86] p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#8a6f22]">Project</div>
            <div className="font-bold">{workOrder.issueCategory || "Work Order Pricing"}</div>
            <div className="mt-1 text-[#5b564c]">Project #: {workOrder.workOrderNumber || "--"}</div>
            <div className="mt-1 text-[#5b564c]">{workOrder.propertyAddress || "--"}</div>
          </div>
          <div className="border border-[#c9ab86] p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#8a6f22]">Service Address</div>
            <div className="font-bold">{workOrder.propertyAddress || "--"}</div>
            {workOrder.unit ? <div className="mt-1 text-[#5b564c]">Unit {workOrder.unit}</div> : null}
            <div className="mt-1 text-[#5b564c]">{workOrder.city || ""}{workOrder.state ? `, ${workOrder.state}` : ""} {workOrder.zip || ""}</div>
          </div>
        </div>

        {(workOrder.problemDescription || workOrder.accessNotes) ? (
          <div className="mb-6 border border-[#c9ab86] p-4 text-sm">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#8a6f22]">Scope / Notes</div>
            {workOrder.problemDescription ? <div className="whitespace-pre-wrap"><span className="font-bold">Work Requested:</span> {workOrder.problemDescription}</div> : null}
            {workOrder.accessNotes ? <div className="mt-2 whitespace-pre-wrap"><span className="font-bold">Access Notes:</span> {workOrder.accessNotes}</div> : null}
          </div>
        ) : null}

        <div className="mb-6">
          <div className="mb-3 text-xl font-black">Estimate Line Items</div>
          <table className="text-sm">
            <thead>
              <tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Cost / Unit</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {builderLines.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-[#5b564c]">No pricing line items have been added.</td></tr>
              ) : (
                builderLines.map((line) => (
                  <tr key={line.id}>
                    <td><div className="font-semibold">{line.description || "Line Item"}</div><div className="mt-1 text-xs text-[#5b564c]">{line.type}{line.taxable ? " • Taxable" : ""}</div></td>
                    <td className="text-right">{line.qty || "1"}</td>
                    <td className="text-right">{money(asNumber(line.unitPrice))}</td>
                    <td className="text-right font-bold">{money(lineTotal(line))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-[320px] border border-[#c9ab86] p-4 text-sm">
          <div className="flex justify-between py-1"><span>Labor / Packages</span><span>{money(totals.labor)}</span></div>
          <div className="flex justify-between py-1"><span>Materials</span><span>{money(totals.materials)}</span></div>
          <div className="flex justify-between py-1"><span>Disposal / Trip / Other</span><span>{money(totals.disposal + totals.trip + totals.other)}</span></div>
          <div className="flex justify-between border-t border-[#c9ab86] py-2"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
          <div className="flex justify-between py-1"><span>Tax ({asNumber(taxRate).toFixed(2)}%)</span><span>{money(totals.tax)}</span></div>
          <div className="mt-2 flex justify-between border-t-4 border-[#3f2a1b] pt-3 text-lg font-black"><span>Total</span><span>{money(totals.grand)}</span></div>
        </div>

        <div className="page-break pt-8">
          <div className="mb-6 border-b-4 border-[#3f2a1b] pb-4">
            <div className="text-2xl font-black">Approval</div>
            <div className="mt-1 text-sm text-[#5b564c]">Acceptance of Work Estimate</div>
          </div>
          <div className="mt-8 space-y-8 text-sm">
            <div>This Work Estimate has been accepted on ______________________________ by ____________________________________________.</div>
            <div>Signature: _______________________________________________________________________________________________</div>
            <div>Printed Name: ____________________________________________________________________________________________</div>
            <div>Date: ____________________________________________________________________________________________________</div>
          </div>
        </div>
      </div>

      <div className="screen-section mx-auto max-w-7xl px-8 py-6">
        <section className="mb-5 border border-[#c9ab86] bg-[#fffaf3] p-4 shadow-md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-[#2f1f14]">Status: {statusMessage}</p>
              <p className="mt-1 text-xs font-bold text-[#5f4a39]">Shared Pricing: {sharedNotebookStatus}</p>
              <p className="mt-1 text-xs text-[#5f4a39]">Preset pricing saves to Supabase cloud so desktop, phone, and deployed app use the same static price list. Estimate records still save locally and can return completed pricing back to Service Ticket.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="border border-[#c9ab86] bg-white p-3"><div className="text-xs font-black uppercase text-[#8a7a68]">Work Order</div><div className="mt-1 font-black">{workOrder.workOrderNumber || "--"}</div></div>
              <div className="border border-[#c9ab86] bg-white p-3"><div className="text-xs font-black uppercase text-[#8a7a68]">Property</div><div className="mt-1 truncate font-black">{workOrder.propertyAddress || "--"}</div></div>
              <div className="border border-[#c9ab86] bg-white p-3"><div className="text-xs font-black uppercase text-[#8a7a68]">Lines</div><div className="mt-1 font-black">{builderLines.length}</div></div>
              <div className="border border-[#4d3624] bg-[#4d3624] p-3 text-white"><div className="text-xs font-black uppercase text-white/70">Total</div><div className="mt-1 font-black">{money(totals.grand)}</div></div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-md">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#2f1f14]">Work Order Info</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Only the information needed for pricing and estimate output.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Work Order #"><TextInput value={workOrder.workOrderNumber} onChange={(v) => updateWorkOrder("workOrderNumber", v)} /></Field>
                <Field label="Status"><TextInput value={workOrder.status} onChange={(v) => updateWorkOrder("status", v)} /></Field>
                <Field label="Created On"><TextInput type="date" value={workOrder.createdOn} onChange={(v) => updateWorkOrder("createdOn", v)} /></Field>
                <Field label="Maintenance Limit"><TextInput value={workOrder.maintenanceLimit} onChange={(v) => updateWorkOrder("maintenanceLimit", v)} placeholder="0.00" /></Field>
                <div className="xl:col-span-2"><Field label="Property Address"><TextInput value={workOrder.propertyAddress} onChange={(v) => updateWorkOrder("propertyAddress", v)} /></Field></div>
                <Field label="Unit"><TextInput value={workOrder.unit} onChange={(v) => updateWorkOrder("unit", v)} /></Field>
                <Field label="City"><TextInput value={workOrder.city} onChange={(v) => updateWorkOrder("city", v)} /></Field>
                <Field label="State"><TextInput value={workOrder.state} onChange={(v) => updateWorkOrder("state", v)} /></Field>
                <Field label="Zip"><TextInput value={workOrder.zip} onChange={(v) => updateWorkOrder("zip", v)} /></Field>
                <div className="xl:col-span-2"><Field label="Issue Category"><TextInput value={workOrder.issueCategory} onChange={(v) => updateWorkOrder("issueCategory", v)} /></Field></div>
                <div className="md:col-span-2"><Field label="Problem Description"><TextArea value={workOrder.problemDescription} onChange={(v) => updateWorkOrder("problemDescription", v)} rows={3} /></Field></div>
                <div className="md:col-span-2"><Field label="Access Notes"><TextArea value={workOrder.accessNotes} onChange={(v) => updateWorkOrder("accessNotes", v)} rows={3} /></Field></div>
              </div>
            </section>

            <section className="border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-md">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#2f1f14]">Pricing Notebook</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Pick a top tab, then choose a subcategory and add preset charges to the builder.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search selected subcategory..." className="border border-[#c9ab86] bg-white px-3 py-2 text-sm outline-none focus:border-[#9c6b2f]" />
                  <button type="button" onClick={addGroup} className="border border-[#b57a32] bg-white px-3 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ef]">Add Subcategory</button>
                  {activeGroup ? <button type="button" onClick={() => deleteGroup(activeGroup.id)} className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100">Delete Subcategory</button> : null}
                </div>
              </div>

              <div className="mb-4 border border-[#c9ab86] bg-[#f8f1e7] p-3">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-[#9c6b2f]">Notebook Tabs</div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((category) => {
                    const count = groups.filter((group) => group.category === category).length;
                    const active = activeCategory === category;
                    return (
                      <button key={category} type="button" onClick={() => setActiveCategory(category)} className={active ? "border border-[#4d3624] bg-[#4d3624] px-4 py-2 text-sm font-black text-white shadow-sm" : "border border-[#c9ab86] bg-white px-4 py-2 text-sm font-black text-[#2f1f14] shadow-sm hover:bg-[#fff8ef]"}>
                        {category} <span className={active ? "text-white/70" : "text-[#8a7a68]"}>({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categoryGroups.length === 0 ? (
                  <div className="border border-dashed border-[#c9ab86] bg-white p-4 text-sm text-[#5f4a39]">No subcategories yet.</div>
                ) : (
                  categoryGroups.map((group) => {
                    const count = lines.filter((line) => line.groupId === group.id).length;
                    const active = activeGroup?.id === group.id;
                    return (
                      <button key={group.id} type="button" onClick={() => setActiveGroupId(group.id)} className={active ? "border border-[#b57a32] bg-[#b57a32] p-4 text-left text-white shadow-sm" : "border border-[#c9ab86] bg-white p-4 text-left text-[#2f1f14] shadow-sm hover:bg-[#fff8ef]"}>
                        <div className="text-base font-black">{group.name}</div>
                        <div className={active ? "mt-1 text-xs text-white/80" : "mt-1 text-xs text-[#8a7a68]"}>{count} preset charge{count === 1 ? "" : "s"}</div>
                      </button>
                    );
                  })
                )}
              </div>

              {activeGroup ? (
                <div className="mb-4 border border-[#c9ab86] bg-[#fff8ef] p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
                    <Field label="Selected Subcategory"><TextInput value={activeGroup.name} onChange={(v) => updateGroup(activeGroup.id, "name", v)} /></Field>
                    <Field label="Subcategory Notes"><TextInput value={activeGroup.notes} onChange={(v) => updateGroup(activeGroup.id, "notes", v)} /></Field>
                    <button type="button" onClick={addNotebookLine} className="bg-[#4d3624] px-4 py-2.5 text-sm font-black text-white hover:bg-[#6b4a31]">Add Price Row</button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto border border-[#c9ab86] bg-white">
                <table className="min-w-[980px] divide-y divide-[#c9ab86] text-sm">
                  <thead className="bg-[#4d3624] text-left text-xs uppercase tracking-wide text-white">
                    <tr>
                      <th className="w-[70px] px-3 py-3 text-center">Use</th>
                      <th className="px-3 py-3">Description</th>
                      <th className="w-[170px] px-3 py-3">Type</th>
                      <th className="w-[140px] px-3 py-3">Price</th>
                      <th className="w-[80px] px-3 py-3 text-center">Tax</th>
                      <th className="w-[120px] px-3 py-3 text-right">Add</th>
                      <th className="w-[90px] px-3 py-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c9ab86] bg-white">
                    {visibleLines.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-[#5f4a39]">No preset charges in this subcategory yet.</td></tr>
                    ) : (
                      visibleLines.map((line) => {
                        const selected = selectedIds.has(line.id);
                        return (
                          <tr key={line.id} className={selected ? "bg-[#fff0d7]" : "bg-white"}>
                            <td className="px-3 py-3 text-center"><input type="checkbox" checked={selected} onChange={() => toggleBuilderLine(line)} className="h-5 w-5 accent-[#b57a32]" /></td>
                            <td className="min-w-[320px] px-3 py-3">
                              <TextInput value={line.description} onChange={(v) => updateLine(line.id, "description", v)} />
                              <input value={line.notes} onChange={(e) => updateLine(line.id, "notes", e.target.value)} placeholder="Notes" className="mt-2 w-full border border-[#c9ab86] bg-[#fff8ef] px-3 py-2 text-xs text-[#5f4a39] outline-none focus:border-[#9c6b2f]" />
                            </td>
                            <td className="px-3 py-3"><select value={line.type} onChange={(e) => updateLine(line.id, "type", e.target.value as PriceType)} className="w-full border border-[#c9ab86] bg-[#fff8ef] px-3 py-2.5 text-sm outline-none">{PRICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></td>
                            <td className="px-3 py-3"><input inputMode="decimal" value={line.price} onChange={(e) => updateLine(line.id, "price", e.target.value)} onBlur={() => updateLine(line.id, "price", asNumber(line.price).toFixed(2))} className="w-full border border-[#c9ab86] bg-[#fff8ef] px-3 py-2.5 text-sm outline-none" /></td>
                            <td className="px-3 py-3 text-center"><input type="checkbox" checked={line.taxable} onChange={(e) => updateLine(line.id, "taxable", e.target.checked)} className="h-5 w-5 accent-[#b57a32]" /></td>
                            <td className="px-3 py-3 text-right"><button type="button" onClick={() => toggleBuilderLine(line)} className={selected ? "border border-red-300 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100" : "bg-[#b57a32] px-3 py-2 text-xs font-black text-white hover:bg-[#9b6427]"}>{selected ? "Remove" : "Add"}</button></td>
                            <td className="px-3 py-3 text-right"><button type="button" onClick={() => deleteNotebookLine(line.id)} className="border border-[#c9ab86] bg-white px-3 py-2 text-xs font-black text-[#5f4a39] hover:bg-[#fff8ef]">Delete</button></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <section className="border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-md">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#2f1f14]">Estimate Builder</h2>
                  <p className="mt-1 text-sm text-[#5f4a39]">Selected items for this work order.</p>
                </div>
                <button type="button" onClick={addBlankBuilderLine} className="bg-[#4d3624] px-3 py-2 text-xs font-black text-white hover:bg-[#6b4a31]">Custom</button>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {builderLines.length === 0 ? (
                  <div className="border border-dashed border-[#c9ab86] bg-white p-4 text-center text-sm text-[#5f4a39]">No line items yet. Use Add from the notebook.</div>
                ) : (
                  builderLines.map((line) => (
                    <div key={line.id} className="border border-[#c9ab86] bg-white p-3 shadow-sm">
                      <TextInput value={line.description} onChange={(v) => updateBuilderLine(line.id, "description", v)} />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select value={line.type} onChange={(e) => updateBuilderLine(line.id, "type", e.target.value as PriceType)} className="w-full border border-[#c9ab86] bg-[#fff8ef] px-2 py-2 text-xs outline-none">{PRICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select>
                        <label className="flex items-center justify-center gap-2 border border-[#c9ab86] bg-[#fff8ef] px-2 py-2 text-xs font-bold"><input type="checkbox" checked={line.taxable} onChange={(e) => updateBuilderLine(line.id, "taxable", e.target.checked)} className="accent-[#b57a32]" />Tax</label>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <input value={line.qty} onChange={(e) => updateBuilderLine(line.id, "qty", e.target.value)} className="border border-[#c9ab86] bg-[#fff8ef] px-2 py-2 text-xs outline-none" placeholder="Qty" />
                        <input value={line.unitPrice} onChange={(e) => updateBuilderLine(line.id, "unitPrice", e.target.value)} className="border border-[#c9ab86] bg-[#fff8ef] px-2 py-2 text-xs outline-none" placeholder="Unit" />
                        <div className="border border-[#4d3624] bg-[#4d3624] px-2 py-2 text-right text-xs font-black text-white">{money(lineTotal(line))}</div>
                      </div>
                      <button type="button" onClick={() => removeBuilderLine(line.id)} className="mt-2 w-full border border-red-300 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">Remove</button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-md">
              <h2 className="text-xl font-black text-[#2f1f14]">Totals</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Labor / Packages</span><strong>{money(totals.labor)}</strong></div>
                <div className="flex justify-between"><span>Materials</span><strong>{money(totals.materials)}</strong></div>
                <div className="flex justify-between"><span>Disposal</span><strong>{money(totals.disposal)}</strong></div>
                <div className="flex justify-between"><span>Trip Fee</span><strong>{money(totals.trip)}</strong></div>
                <div className="flex justify-between"><span>Other</span><strong>{money(totals.other)}</strong></div>
                <div className="flex justify-between border-t border-[#c9ab86] pt-2"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                <div className="rounded-xl border border-[#c9ab86] bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-[#5f4a39]">
                    <span>Tax Area</span>
                    {findTaxRateByCity(workOrder.city) ? (
                      <span className="rounded bg-[#efe3d2] px-2 py-1 text-[10px] text-[#4d3624]">
                        Auto matched from city
                      </span>
                    ) : null}
                  </div>
                  <select
                    value={taxName}
                    onChange={(e) => {
                      const selected = TAX_RATE_OPTIONS.find((item) => item.name === e.target.value);
                      setTaxName(e.target.value);
                      if (selected) setTaxRate(selected.rate);
                    }}
                    className="w-full rounded-lg border border-[#c9ab86] bg-[#fff8ef] px-3 py-2 text-sm font-bold text-[#2f1f14] outline-none focus:border-[#b57a32]"
                  >
                    <option value="">Select tax area</option>
                    {TAX_RATE_OPTIONS.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name} — {asNumber(item.rate).toFixed(2)}%
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 grid grid-cols-[1fr_120px] items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#5f4a39]">Editable Rate %</span>
                    <input
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      onBlur={() => setTaxRate(asNumber(taxRate).toFixed(2))}
                      className="rounded-lg border border-[#c9ab86] bg-[#fff8ef] px-2 py-2 text-right font-bold outline-none focus:border-[#b57a32]"
                    />
                  </div>
                </div>
                <div className="flex justify-between"><span>Tax{taxName ? ` - ${taxName}` : ""}</span><strong>{money(totals.tax)}</strong></div>
                <div className="mt-3 flex justify-between border-t-4 border-[#4d3624] pt-3 text-lg"><span className="font-black">Grand Total</span><strong>{money(totals.grand)}</strong></div>
              </div>
            </section>

            <section className="border border-[#c9ab86] bg-[#fffaf3] p-5 shadow-md">
              <h2 className="text-xl font-black text-[#2f1f14]">Saved Records</h2>
              <div className="mt-3 space-y-3">
                <Field label="Saved Pricing Records">
                  <select value={selectedRecordId} onChange={(e) => setSelectedRecordId(e.target.value)} className="w-full border border-[#c9ab86] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#9c6b2f]">
                    <option value="">Select saved record</option>
                    {savedRecords.map((record) => (
                      <option key={record.id} value={record.id}>{record.workOrder.propertyAddress || "No address"}{record.workOrder.unit ? ` #${record.workOrder.unit}` : ""} — {record.workOrder.workOrderNumber || "No WO #"} — {new Date(record.savedAt).toLocaleString()}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={savePricingRecord} className="bg-[#b57a32] px-3 py-2 text-sm font-black text-white hover:bg-[#9b6427]">Save</button>
                  <button type="button" onClick={loadSavedRecord} className="border border-[#b57a32] bg-white px-3 py-2 text-sm font-black text-[#2f1f14] hover:bg-[#fff8ef]">Load</button>
                  <button type="button" onClick={deleteSavedRecord} className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100">Delete</button>
                  <button type="button" onClick={() => window.print()} className="border border-[#4d3624] bg-[#4d3624] px-3 py-2 text-sm font-black text-white hover:bg-[#6b4a31]">Print</button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <footer className="no-print mt-8 border-t border-[#8b6b47] bg-[#3f2a1b] px-8 py-6 text-center text-xs leading-6 text-[#f1e6d8]">
        5 Tools supports maintenance workflow, work order pricing, scheduling, repair documentation, inventory tracking, and field operations.
      </footer>
    </main>
  );
}async function supabaseRequest<T>(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing Supabase environment variables.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

async function loadSharedNotebookFromCloud() {
  const data = await supabaseRequest<SharedNotebookRecord[]>(
    `${SHARED_NOTEBOOK_TABLE}?id=eq.${SHARED_NOTEBOOK_ID}&select=*`,
  );
  return data?.[0] || null;
}

async function saveSharedNotebookToCloud(
  groups: NotebookGroup[],
  lines: NotebookLine[],
) {
  return supabaseRequest<SharedNotebookRecord[]>(
    `${SHARED_NOTEBOOK_TABLE}?on_conflict=id`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: SHARED_NOTEBOOK_ID,
        groups_json: groups,
        lines_json: lines,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}


