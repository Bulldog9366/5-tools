"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

declare const process: {
  env: {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

async function loadPdfJs() {
  if (typeof window === "undefined") throw new Error("PDF import only runs in the browser.");
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pdfjs="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("PDF.js failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.dataset.pdfjs = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PDF.js failed to load."));
    document.head.appendChild(script);
  });

  if (!window.pdfjsLib) throw new Error("PDF.js is not available.");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str || "").join(" ");
    pageTexts.push(text);
  }

  return pageTexts.join("\n");
}


type LineType = "material" | "labor" | "mixed";

type JobCostLine = {
  id: string;
  item: string;
  qty: number;
  materialsBilled: number;
  materialCost: number;
  markupPercent: number;
  labor: number;
  tax: number;
  lineTotal: number;
  type: LineType;
};

type InvoiceRecord = {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  customer: string;
  project: string;
  propertyAddress: string;
  taxRate: number;
  notes: string;
  sourceFileName: string;
  lines: JobCostLine[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "admin-job-cost-tracker-v1";
const CLOUD_TABLE = "admin_job_cost_invoices";

type CloudInvoiceRow = {
  id?: string | null;
  unique_key?: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  customer: string | null;
  project: string | null;
  property_address: string | null;
  tax_rate: number | null;
  notes: string | null;
  source_file_name: string | null;
  lines: JobCostLine[] | null;
  work_month: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function n(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function billFromCost(cost: number, markupPercent: number) {
  return roundMoney(cost * (1 + markupPercent / 100));
}

function costFromBill(billed: number, markupPercent: number) {
  const divisor = 1 + markupPercent / 100;
  if (!Number.isFinite(divisor) || divisor <= 0) return 0;
  return roundMoney(billed / divisor);
}

function CurrencyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(value === 0 ? "" : value.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraft(value === 0 ? "" : value.toFixed(2));
  }, [value, isFocused]);

  return (
    <input
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      inputMode="decimal"
      type="text"
      value={draft}
      placeholder="0.00"
      onFocus={() => setIsFocused(true)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[$,]/g, "").trim();
        if (/^\d*\.?\d{0,2}$/.test(raw)) {
          setDraft(raw);
          onChange(raw === "" || raw === "." ? 0 : Number(raw));
        }
      }}
      onBlur={() => {
        const parsed = n(draft);
        setIsFocused(false);
        setDraft(parsed ? parsed.toFixed(2) : "");
        onChange(parsed);
      }}
    />
  );
}

function classifyLine(item: string): LineType {
  const text = item.toLowerCase();
  const laborWords = ["labor", "install", "installation", "hook up", "hookup", "service", "repair", "fee", "trip", "diagnostic"];
  const materialWords = ["refrigerator", "range", "kit", "appliance", "part", "materials", "supply", "paint", "lvp", "carpet", "toilet", "detector"];
  if (laborWords.some((word) => text.includes(word))) return "labor";
  if (materialWords.some((word) => text.includes(word))) return "material";
  return "material";
}

function normalizeText(raw: string) {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function parseDateOnly(value: string): Date | null {
  const clean = (value || "").trim();
  if (!clean) return null;

  const slash = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3]);
    return new Date(year, month - 1, day);
  }

  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return new Date(year, month - 1, day);
  }

  return null;
}

function workMonthKeyFromDate(date: Date) {
  // Work months are named by the closing / due month.
  // Example: May 2026 work month = 04/15/2026 through 05/15/2026.
  // A due date of 05/08/2026 belongs to May 2026.
  const closingMonth = new Date(date.getFullYear(), date.getMonth() + (date.getDate() > 15 ? 1 : 0), 1);
  return `${closingMonth.getFullYear()}-${String(closingMonth.getMonth() + 1).padStart(2, "0")}`;
}

function workMonthKey(record: InvoiceRecord) {
  const parsed = parseDateOnly(record.dueDate) || parseDateOnly(record.invoiceDate) || parseDateOnly(record.createdAt.slice(0, 10)) || new Date();
  return workMonthKeyFromDate(parsed);
}

function cloudSafeKey(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "blank";
}

function invoiceDedupeKey(record: InvoiceRecord) {
  return [
    cloudSafeKey(record.invoiceNo),
    cloudSafeKey(record.dueDate || record.invoiceDate),
    workMonthKey(record),
  ].join("|");
}

function stableCloudId(record: InvoiceRecord) {
  return `job-cost-${invoiceDedupeKey(record).replace(/\|/g, "-")}`;
}

function dedupeInvoices(records: InvoiceRecord[]) {
  const map = new Map<string, InvoiceRecord>();
  for (const record of records) {
    const key = invoiceDedupeKey(record);
    const existing = map.get(key);
    if (!existing || new Date(record.updatedAt || record.createdAt).getTime() >= new Date(existing.updatedAt || existing.createdAt).getTime()) {
      map.set(key, record);
    }
  }
  return Array.from(map.values());
}

function workMonthRange(selectedMonth: string) {
  const [yearRaw, monthRaw] = selectedMonth.split("-").map(Number);
  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const monthIndex = Number.isFinite(monthRaw) ? monthRaw - 1 : new Date().getMonth();
  const start = new Date(year, monthIndex - 1, 15);
  const end = new Date(year, monthIndex, 15);
  return { start, end };
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables.");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

async function supabaseRest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Supabase request failed with status ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function toCloudRow(record: InvoiceRecord): CloudInvoiceRow {
  return {
    unique_key: invoiceDedupeKey(record),
    invoice_number: record.invoiceNo,
    invoice_date: record.invoiceDate,
    due_date: record.dueDate,
    customer: record.customer,
    project: record.project,
    property_address: record.propertyAddress,
    tax_rate: record.taxRate,
    notes: record.notes,
    source_file_name: record.sourceFileName,
    lines: record.lines,
    work_month: workMonthKey(record),
    created_at: record.createdAt,
    updated_at: new Date().toISOString(),
  };
}

function fromCloudRow(row: CloudInvoiceRow): InvoiceRecord {
  return {
    id: row.id || uid(),
    invoiceNo: row.invoice_number || "",
    invoiceDate: row.invoice_date || "",
    dueDate: row.due_date || "",
    customer: row.customer || "",
    project: row.project || "",
    propertyAddress: row.property_address || "",
    taxRate: Number(row.tax_rate ?? 0.1),
    notes: row.notes || "",
    sourceFileName: row.source_file_name || "",
    lines: Array.isArray(row.lines) && row.lines.length ? row.lines : [blankLine()],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function isMeaningfulInvoice(record: InvoiceRecord) {
  return Boolean(
    record.invoiceNo.trim() ||
      record.customer.trim() ||
      record.propertyAddress.trim() ||
      record.lines.some((line) =>
        line.item.trim() || line.materialsBilled || line.materialCost || line.labor || line.tax || line.lineTotal
      )
  );
}

function cleanItemName(item: string) {
  return item
    .replace(/\b(Item|Qty|Price\/Unit|Total)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingDuplicate(remaining: string, priorItem: string) {
  const item = cleanItemName(priorItem);
  if (!item) return remaining.trim();
  const normalized = remaining.trim();
  if (normalized.toLowerCase().startsWith(item.toLowerCase() + " ")) {
    return normalized.slice(item.length).trim();
  }
  return normalized;
}

function extractLineItems(text: string): Array<{ item: string; qty: number; total: number }> {
  const flat = text.replace(/\s+/g, " ").trim();
  const tableMatch = flat.match(/Item\s+Qty\s+Price\/Unit\s+Total\s+([\s\S]*?)\s+Subtotal\s+\$/i);
  const tableText = (tableMatch?.[1] || flat).trim();
  const parsed: Array<{ item: string; qty: number; total: number }> = [];

  let remaining = tableText;
  let guard = 0;

  while (remaining && guard < 100) {
    guard += 1;
    const match = remaining.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+\$([\d,]+\.\d{2})(?:\/[A-Za-z]+)?\s+\$([\d,]+\.\d{2})(?:\s+|$)/i);
    if (!match) break;

    const item = cleanItemName(match[1]);
    const qty = n(match[2]);
    const total = n(match[4]);

    if (item && !/^(subtotal|tax|total|balance due|pay online)$/i.test(item)) {
      parsed.push({ item, qty, total });
    }

    remaining = remaining.slice(match[0].length).trim();
    remaining = stripLeadingDuplicate(remaining, item);

    if (/^(Subtotal|Tax:|Total|Balance Due)\b/i.test(remaining)) break;
  }

  return parsed;
}

function parseInvoiceText(rawText: string, fileName = "") : InvoiceRecord {
  const text = normalizeText(rawText);
  const flat = text.replace(/\s+/g, " ").trim();

  const invoiceNo = firstMatch(flat, [
    /INVOICE\s*#\s*DATE\s*DUE\s*(\d+)/i,
    /Invoice\s*#?:?\s*(\d+)/i,
  ]);

  const dateDue = flat.match(/INVOICE\s*#\s*DATE\s*DUE\s*\d+\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i);
  const invoiceDate = dateDue?.[1] || firstMatch(flat, [/Date:?\s*(\d{2}\/\d{2}\/\d{4})/i]);
  const dueDate = dateDue?.[2] || firstMatch(flat, [/Due:?\s*(\d{2}\/\d{2}\/\d{4})/i]);

  const customer = firstMatch(flat, [
    /CUSTOMER\s+(.+?)\s+PROJECT\b/i,
    /Bill\s+To\s+(.+?)\s+(?:PROJECT|Item\s+Qty)/i,
  ]);

  const projectBlock = firstMatch(flat, [
    /PROJECT\s+([\s\S]*?)\s+Item\s+Qty\s+Price\/Unit\s+Total/i,
    /PROJECT\s+([\s\S]*?)\s+Subtotal\s+\$/i,
  ]);

  const projectNumber = firstMatch(projectBlock, [/PROJECT\s*#:\s*([^\s]+(?:\s+[^\s]+)?)/i]);
  const project = projectBlock.match(/^(.*?)(?:\s+PROJECT\s*#:|\s+\d{3,}\s+)/i)?.[1]?.trim() || projectNumber || projectBlock;
  const propertyAddress = firstMatch(projectBlock, [
    /(\d{3,}[^,]*?\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Court|Ct|Place|Pl|Lane|Ln|Way|Boulevard|Blvd)[\s\S]*?\d{5})/i,
    /(\d{3,}[\s\S]*?WA\s+\d{5})/i,
  ]);

  const totalTax = n(firstMatch(flat, [/Tax:[^$]*\$([\d,]+\.\d{2})/i]));
  const subtotal = n(firstMatch(flat, [/Subtotal\s+\$([\d,]+\.\d{2})/i]));
  const taxRate = subtotal > 0 && totalTax > 0 ? Number((totalTax / subtotal).toFixed(4)) : 0.1;

  const importedItems = extractLineItems(text);
  const parsedLines: JobCostLine[] = importedItems.map(({ item, qty, total }) => {
    const type = classifyLine(item);
    return {
      id: uid(),
      item,
      qty,
      materialsBilled: type === "labor" ? 0 : Number((total / Math.max(qty, 1)).toFixed(2)),
      materialCost: 0,
      markupPercent: 0,
      labor: type === "labor" ? Number((total / Math.max(qty, 1)).toFixed(2)) : 0,
      tax: 0,
      lineTotal: total,
      type,
    };
  });

  const taxableTotal = parsedLines.reduce((sum, line) => sum + (line.materialsBilled + line.labor) * Math.max(line.qty, 0), 0);
  let runningTax = 0;
  const withTax = parsedLines.map((line, index) => {
    const taxableLine = (line.materialsBilled + line.labor) * Math.max(line.qty, 0);
    let allocatedTax = taxableTotal > 0 ? Number(((taxableLine / taxableTotal) * totalTax).toFixed(2)) : Number((taxableLine * taxRate).toFixed(2));
    if (index === parsedLines.length - 1 && totalTax > 0) {
      allocatedTax = Number((totalTax - runningTax).toFixed(2));
    }
    runningTax += allocatedTax;
    return {
      ...line,
      tax: allocatedTax,
      lineTotal: Number((taxableLine + allocatedTax).toFixed(2)),
    };
  });

  return {
    id: uid(),
    invoiceNo,
    invoiceDate,
    dueDate,
    customer,
    project,
    propertyAddress,
    taxRate,
    notes: "",
    sourceFileName: fileName,
    lines: withTax.length ? withTax : [blankLine()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function blankLine(): JobCostLine {
  return {
    id: uid(),
    item: "",
    qty: 1,
    materialsBilled: 0,
    materialCost: 0,
    markupPercent: 0,
    labor: 0,
    tax: 0,
    lineTotal: 0,
    type: "material",
  };
}

function blankInvoice(): InvoiceRecord {
  return {
    id: uid(),
    invoiceNo: "",
    invoiceDate: "",
    dueDate: "",
    customer: "",
    project: "",
    propertyAddress: "",
    taxRate: 0.1,
    notes: "",
    sourceFileName: "",
    lines: [blankLine()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function lineMaterialTotal(line: JobCostLine) {
  return Number((line.materialsBilled * Math.max(line.qty, 0)).toFixed(2));
}

function lineMaterialCostTotal(line: JobCostLine) {
  return Number((line.materialCost * Math.max(line.qty, 0)).toFixed(2));
}

function lineLaborTotal(line: JobCostLine) {
  return Number((line.labor * Math.max(line.qty, 0)).toFixed(2));
}

function lineMargin(line: JobCostLine) {
  return Number((lineMaterialTotal(line) - lineMaterialCostTotal(line) + lineLaborTotal(line)).toFixed(2));
}

function recalcLine(line: JobCostLine, taxRate: number): JobCostLine {
  const materialTotal = lineMaterialTotal(line);
  const laborTotal = lineLaborTotal(line);
  const tax = Number(((materialTotal + laborTotal) * taxRate).toFixed(2));
  return {
    ...line,
    tax,
    lineTotal: Number((materialTotal + laborTotal + tax).toFixed(2)),
  };
}

export default function AdminJobCostTracker() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [invoice, setInvoice] = useState<InvoiceRecord>(() => blankInvoice());
  const [saved, setSaved] = useState<InvoiceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => workMonthKeyFromDate(new Date()));
  const [importText, setImportText] = useState("");
  const [autoFillBilled, setAutoFillBilled] = useState(true);
  const [materialMarkupPercent, setMaterialMarkupPercent] = useState(20);
  const [message, setMessage] = useState("Upload a PDF invoice. If the browser cannot read the PDF text, paste the invoice text into the import box.");
  const [cloudBusy, setCloudBusy] = useState(false);

  const invoiceTotals = useMemo(() => {
    const materialsBilled = invoice.lines.reduce((s, l) => s + lineMaterialTotal(l), 0);
    const materialCost = invoice.lines.reduce((s, l) => s + lineMaterialCostTotal(l), 0);
    const labor = invoice.lines.reduce((s, l) => s + lineLaborTotal(l), 0);
    const tax = invoice.lines.reduce((s, l) => s + l.tax, 0);
    const lineTotal = invoice.lines.reduce((s, l) => s + l.lineTotal, 0);
    const margin = materialsBilled - materialCost + labor;
    return { materialsBilled, materialCost, labor, tax, lineTotal, margin };
  }, [invoice.lines]);

  const workPeriod = useMemo(() => workMonthRange(selectedMonth), [selectedMonth]);

  const savedMonthRecords = useMemo(() => {
    return dedupeInvoices(saved).filter((record) => workMonthKey(record) === selectedMonth);
  }, [saved, selectedMonth]);

  const runningMonthRecords = useMemo(() => {
    const currentKey = invoiceDedupeKey(invoice);
    const savedWithoutCurrent = savedMonthRecords.filter((record) => record.id !== invoice.id && invoiceDedupeKey(record) !== currentKey);
    const currentBelongsToMonth = workMonthKey(invoice) === selectedMonth && isMeaningfulInvoice(invoice);
    return dedupeInvoices(currentBelongsToMonth ? [invoice, ...savedWithoutCurrent] : savedWithoutCurrent);
  }, [invoice, savedMonthRecords, selectedMonth]);

  const monthTotals = useMemo(() => {
    return runningMonthRecords.flatMap((r) => r.lines).reduce(
      (acc, line) => {
        acc.materialsBilled += lineMaterialTotal(line);
        acc.materialCost += lineMaterialCostTotal(line);
        acc.labor += lineLaborTotal(line);
        acc.tax += line.tax;
        acc.lineTotal += line.lineTotal;
        acc.margin += lineMargin(line);
        return acc;
      },
      { materialsBilled: 0, materialCost: 0, labor: 0, tax: 0, lineTotal: 0, margin: 0 }
    );
  }, [runningMonthRecords]);

  function updateInvoice(patch: Partial<InvoiceRecord>) {
    setInvoice((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
  }

  function updateMaterialCost(id: string, value: number) {
    setInvoice((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== id) return line;
        const next: JobCostLine = {
          ...line,
          materialCost: value,
          materialsBilled: autoFillBilled && line.type !== "labor" ? billFromCost(value, line.markupPercent || materialMarkupPercent) : line.materialsBilled,
        };
        return recalcLine(next, prev.taxRate);
      }),
      updatedAt: new Date().toISOString(),
    }));
  }

  function applyMarkupToAllMaterialLines() {
    setInvoice((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.type === "labor") return recalcLine(line, prev.taxRate);

        // Do not wipe imported Material Bill / Unit values.
        // If a billed amount already exists, keep it and back-calculate Your Cost / Unit.
        // If only Your Cost / Unit exists, calculate the billed amount from the markup.
        // If both are blank, only set the markup percentage.
        let next: JobCostLine = { ...line, markupPercent: materialMarkupPercent };

        if (line.materialsBilled > 0) {
          next = { ...next, materialCost: costFromBill(line.materialsBilled, materialMarkupPercent) };
        } else if (line.materialCost > 0) {
          next = { ...next, materialsBilled: billFromCost(line.materialCost, materialMarkupPercent) };
        }

        return recalcLine(next, prev.taxRate);
      }),
      updatedAt: new Date().toISOString(),
    }));
    setMessage(`Applied ${materialMarkupPercent}% markup to material lines without erasing imported billed amounts.`);
  }

  function updateLineMarkup(id: string, value: number) {
    setInvoice((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== id) return line;

        // Imported invoices already have Material Bill / Unit filled in.
        // In that case, typing a markup should back-calculate your original cost.
        // If there is no billed amount yet, keep the older workflow: cost + markup = billed.
        let next: JobCostLine = { ...line, markupPercent: value };
        if (line.type !== "labor") {
          if (line.materialsBilled > 0) {
            next = { ...next, materialCost: costFromBill(line.materialsBilled, value) };
          } else if (autoFillBilled && line.materialCost > 0) {
            next = { ...next, materialsBilled: billFromCost(line.materialCost, value) };
          }
        }

        return recalcLine(next, prev.taxRate);
      }),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateLine(id: string, patch: Partial<JobCostLine>) {
    setInvoice((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        return recalcLine(next, prev.taxRate);
      }),
      updatedAt: new Date().toISOString(),
    }));
  }

  function changeTaxRate(value: number) {
    setInvoice((prev) => ({
      ...prev,
      taxRate: value,
      lines: prev.lines.map((line) => recalcLine(line, value)),
      updatedAt: new Date().toISOString(),
    }));
  }

  async function handleUpload(file: File) {
    try {
      setMessage("Reading invoice file...");
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      const raw = isPdf ? await extractPdfText(file) : await file.text();
      const cleanRaw = normalizeText(raw);
      const parsed = parseInvoiceText(cleanRaw, file.name);
      setInvoice(parsed);
      setSelectedMonth(workMonthKey(parsed));
      setImportText(cleanRaw);
      setMessage(parsed.lines.length > 1 || parsed.lines[0].item ? "Invoice imported. Enter your original material cost per unit on each material line." : "Upload read, but line items were not detected. Paste copied invoice text below and click Parse Text.");
    } catch (error) {
      setImportText("");
      setMessage("PDF text extraction failed. This usually means PDF.js could not load or the PDF is scanned. Copy/paste the invoice text into the import box and click Parse Text.");
    }
  }

  function parseTextBox() {
    const parsed = parseInvoiceText(importText, invoice.sourceFileName || "manual import");
    setInvoice(parsed);
    setSelectedMonth(workMonthKey(parsed));
    setMessage("Invoice text parsed. Review the line classifications and enter your original material costs.");
  }

  function saveLocal() {
    if (!isMeaningfulInvoice(invoice)) {
      setMessage("Nothing to save yet. Import or enter an invoice first.");
      return;
    }
    const record: InvoiceRecord = { ...invoice, id: stableCloudId(invoice), updatedAt: new Date().toISOString() };
    const next = dedupeInvoices([record, ...saved.filter((r) => r.id !== record.id)]);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setInvoice(record);
    setMessage(`Saved invoice ${record.invoiceNo || "current invoice"} to the work-month ledger. Running totals now include saved invoices plus the open invoice.`);
  }

  function loadLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const records = dedupeInvoices(raw ? JSON.parse(raw) as InvoiceRecord[] : []);
    setSaved(records);
    setMessage(`Loaded ${records.length} saved invoice record${records.length === 1 ? "" : "s"}. Running work-month totals are active.`);
  }

  function newInvoice() {
    setInvoice(blankInvoice());
    setImportText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("Cleared the open invoice and import text. Ready for the next invoice.");
  }

  function clearImportText() {
    setImportText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage("PDF/text import box cleared. Upload or paste the next invoice.");
  }

  function deleteSavedInvoice(id: string) {
    const next = saved.filter((record) => record.id !== id);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMessage("Saved invoice removed from local month ledger.");
  }


  async function saveToCloud() {
    if (!isMeaningfulInvoice(invoice)) {
      setMessage("Nothing to save to cloud yet. Import or enter an invoice first.");
      return;
    }

    setCloudBusy(true);
    try {
      const record: InvoiceRecord = { ...invoice, updatedAt: new Date().toISOString() };
      const row = toCloudRow(record);

      const savedRows = await supabaseRest<CloudInvoiceRow[]>(`${CLOUD_TABLE}?on_conflict=unique_key`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify([row]),
      });

      const savedRecord = savedRows?.[0] ? fromCloudRow(savedRows[0]) : record;
      setInvoice(savedRecord);
      setSelectedMonth(workMonthKey(savedRecord));
      setSaved((prev) => dedupeInvoices([savedRecord, ...prev.filter((r) => r.id !== savedRecord.id)]));
      setMessage(`Saved invoice ${savedRecord.invoiceNo || "current invoice"} to cloud for work month ${workMonthKey(savedRecord)}.`);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? `Cloud save failed: ${error.message}` : "Cloud save failed.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function loadCloudMonth() {
    setCloudBusy(true);
    try {
      const rows = await supabaseRest<CloudInvoiceRow[]>(`${CLOUD_TABLE}?select=*&work_month=eq.${encodeURIComponent(selectedMonth)}&order=due_date.asc,invoice_number.asc`, {
        method: "GET",
      });
      const records = dedupeInvoices((rows || []).map(fromCloudRow));
      setSaved(records);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      setMessage(`Loaded ${records.length} cloud invoice${records.length === 1 ? "" : "s"} for work month ${selectedMonth}.`);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? `Cloud load failed: ${error.message}` : "Cloud load failed.");
    } finally {
      setCloudBusy(false);
    }
  }

  async function deleteCloudInvoice(id: string) {
    setCloudBusy(true);
    try {
      await supabaseRest<void>(`${CLOUD_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      const next = saved.filter((record) => record.id !== id);
      setSaved(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (invoice.id === id) setInvoice(blankInvoice());
      setMessage("Cloud invoice deleted and removed from the loaded ledger.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? `Cloud delete failed: ${error.message}` : "Cloud delete failed.");
    } finally {
      setCloudBusy(false);
    }
  }

  function exportMonthlyCsv() {
    const header = ["Invoice", "Date", "Customer", "Project", "Property", "Item", "Qty", "Material Cost", "Markup %", "Materials Billed", "Labor", "Tax", "Line Total", "Margin"];
    const rows = runningMonthRecords.flatMap((record) => record.lines.map((line) => [
      record.invoiceNo,
      record.invoiceDate,
      record.customer,
      record.project,
      record.propertyAddress,
      line.item,
      line.qty,
      lineMaterialCostTotal(line).toFixed(2),
      (line.markupPercent || 0).toFixed(2),
      lineMaterialTotal(line).toFixed(2),
      lineLaborTotal(line).toFixed(2),
      line.tax.toFixed(2),
      line.lineTotal.toFixed(2),
      lineMargin(line).toFixed(2),
    ]));
    rows.push(["WORK MONTH TOTAL", `${formatDate(workPeriod.start)} - ${formatDate(workPeriod.end)}`, "", "", "", "", "", monthTotals.materialCost.toFixed(2), "", monthTotals.materialsBilled.toFixed(2), monthTotals.labor.toFixed(2), monthTotals.tax.toFixed(2), monthTotals.lineTotal.toFixed(2), monthTotals.margin.toFixed(2)]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-job-cost-work-month-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 print:bg-white print:p-0">
      <div className="hidden print:block print:p-8 print:text-[11px] print:leading-tight print:text-slate-950">
        <div className="mb-5 flex items-start justify-between border-b-4 border-slate-900 pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-600">5 Tools Admin</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Admin Job Cost Report</h1>
            <p className="mt-1 text-[11px] text-slate-600">Internal billing, material cost, labor, tax, and margin control report.</p>
          </div>
          <div className="text-right text-[11px]">
            <div className="text-lg font-black">Invoice {invoice.invoiceNo || "—"}</div>
            <div>Invoice Date: <b>{invoice.invoiceDate || "—"}</b></div>
            <div>Due Date: <b>{invoice.dueDate || "—"}</b></div>
            <div>Printed: <b>{formatDate(new Date())}</b></div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer</div>
            <div className="font-bold">{invoice.customer || "—"}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Project / WO</div>
            <div className="font-bold">{invoice.project || "—"}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Work Month</div>
            <div className="font-bold">{selectedMonth}</div>
            <div className="text-[10px] text-slate-600">{formatDate(workPeriod.start)} – {formatDate(workPeriod.end)}</div>
          </div>
          <div className="col-span-3 rounded-lg border border-slate-400 p-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Property Address</div>
            <div className="font-bold">{invoice.propertyAddress || "—"}</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-5 gap-2">
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-[10px] uppercase text-slate-500">Materials Billed</div>
            <div className="text-base font-black">{money.format(invoiceTotals.materialsBilled)}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-[10px] uppercase text-slate-500">Material Cost</div>
            <div className="text-base font-black">{money.format(invoiceTotals.materialCost)}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-[10px] uppercase text-slate-500">Labor</div>
            <div className="text-base font-black">{money.format(invoiceTotals.labor)}</div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <div className="text-[10px] uppercase text-slate-500">Tax</div>
            <div className="text-base font-black">{money.format(invoiceTotals.tax)}</div>
          </div>
          <div className="rounded-lg border-2 border-slate-900 p-3">
            <div className="text-[10px] uppercase text-slate-500">Gross Margin</div>
            <div className="text-base font-black">{money.format(invoiceTotals.margin)}</div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between border-b border-slate-500 pb-1">
          <h2 className="text-sm font-black uppercase tracking-wider">Line-Level Cost Breakdown</h2>
          <div className="text-[10px] text-slate-600">All dollar columns are extended by Qty except Tax, Line Total, and Margin.</div>
        </div>

        <table className="mb-5 w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b-2 border-slate-900 bg-slate-100">
              <th className="p-1.5 text-left">Item</th>
              <th className="p-1.5 text-right">Qty</th>
              <th className="p-1.5 text-right">Cost / Unit</th>
              <th className="p-1.5 text-right">Markup %</th>
              <th className="p-1.5 text-right">Bill / Unit</th>
              <th className="p-1.5 text-right">Labor / Unit</th>
              <th className="p-1.5 text-right">Material Cost</th>
              <th className="p-1.5 text-right">Material Bill</th>
              <th className="p-1.5 text-right">Labor</th>
              <th className="p-1.5 text-right">Tax</th>
              <th className="p-1.5 text-right">Line Total</th>
              <th className="p-1.5 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={`print-${line.id}`} className="border-b border-slate-300">
                <td className="p-1.5 font-medium">{line.item || "—"}</td>
                <td className="p-1.5 text-right">{line.qty}</td>
                <td className="p-1.5 text-right">{money.format(line.materialCost)}</td>
                <td className="p-1.5 text-right">{(line.markupPercent || 0).toFixed(2)}%</td>
                <td className="p-1.5 text-right">{money.format(line.materialsBilled)}</td>
                <td className="p-1.5 text-right">{money.format(line.labor)}</td>
                <td className="p-1.5 text-right">{money.format(lineMaterialCostTotal(line))}</td>
                <td className="p-1.5 text-right">{money.format(lineMaterialTotal(line))}</td>
                <td className="p-1.5 text-right">{money.format(lineLaborTotal(line))}</td>
                <td className="p-1.5 text-right">{money.format(line.tax)}</td>
                <td className="p-1.5 text-right font-bold">{money.format(line.lineTotal)}</td>
                <td className="p-1.5 text-right font-bold">{money.format(lineMargin(line))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900 font-black">
              <td className="p-1.5" colSpan={6}>Invoice Totals</td>
              <td className="p-1.5 text-right">{money.format(invoiceTotals.materialCost)}</td>
              <td className="p-1.5 text-right">{money.format(invoiceTotals.materialsBilled)}</td>
              <td className="p-1.5 text-right">{money.format(invoiceTotals.labor)}</td>
              <td className="p-1.5 text-right">{money.format(invoiceTotals.tax)}</td>
              <td className="p-1.5 text-right">{money.format(invoiceTotals.lineTotal)}</td>
              <td className="p-1.5 text-right">{money.format(invoiceTotals.margin)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-400 p-3">
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider">Work-Month Running Rollup</h3>
            <div className="space-y-1">
              <div className="flex justify-between"><span>Invoices Counted</span><b>{runningMonthRecords.length}</b></div>
              <div className="flex justify-between"><span>Materials Billed</span><b>{money.format(monthTotals.materialsBilled)}</b></div>
              <div className="flex justify-between"><span>Material Costs to Pay/Reconcile</span><b>{money.format(monthTotals.materialCost)}</b></div>
              <div className="flex justify-between"><span>Labor Revenue</span><b>{money.format(monthTotals.labor)}</b></div>
              <div className="flex justify-between"><span>Tax Collected / Owed</span><b>{money.format(monthTotals.tax)}</b></div>
              <div className="mt-1 flex justify-between border-t border-slate-500 pt-1"><span>Total Billed</span><b>{money.format(monthTotals.lineTotal)}</b></div>
              <div className="flex justify-between font-black"><span>Gross Margin</span><b>{money.format(monthTotals.margin)}</b></div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-400 p-3">
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider">Accounting Buckets</h3>
            <div className="space-y-1">
              <div className="flex justify-between"><span>Move to Tax Holding</span><b>{money.format(invoiceTotals.tax)}</b></div>
              <div className="flex justify-between"><span>Material Cost Reimbursement</span><b>{money.format(invoiceTotals.materialCost)}</b></div>
              <div className="flex justify-between"><span>Labor Revenue</span><b>{money.format(invoiceTotals.labor)}</b></div>
              <div className="mt-1 flex justify-between border-t border-slate-500 pt-1"><span>Invoice Cash Total</span><b>{money.format(invoiceTotals.lineTotal)}</b></div>
              <div className="flex justify-between font-black"><span>Invoice Gross Margin</span><b>{money.format(invoiceTotals.margin)}</b></div>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-400 pt-2 text-[10px] text-slate-600">
          Internal admin report. Material cost and margin are not intended for owner-facing invoice presentation unless specifically approved.
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 print:hidden">
        <header className="rounded-2xl bg-slate-900 p-5 text-white shadow print:rounded-none print:bg-white print:text-slate-900 print:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300 print:text-slate-600">5 Tools Admin</p>
              <h1 className="text-2xl font-bold">Admin Job Cost Tracker</h1>
              <p className="mt-1 text-sm text-slate-300 print:text-slate-600">Upload invoices, separate materials, original cost, labor, tax, and margin. Money fields are per unit, Qty drives the line total, and material bill can auto-fill from your cost markup.</p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Upload Invoice</button>
              <button onClick={saveLocal} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save to Month</button>
              <button onClick={saveToCloud} disabled={cloudBusy} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60">{cloudBusy ? "Cloud Working..." : "Save to Cloud"}</button>
              <button onClick={loadCloudMonth} disabled={cloudBusy} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">Load Cloud Month</button>
              <button onClick={newInvoice} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600">New / Clear</button>
              <button onClick={loadLocal} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">Load Ledger</button>
              <button onClick={() => window.print()} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">Print Report</button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </header>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 print:hidden">{message}</div>

        <section className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm lg:col-span-3">
            <h2 className="mb-3 text-lg font-bold">Invoice Header</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">Invoice #<input className="mt-1 w-full rounded-lg border px-3 py-2" value={invoice.invoiceNo} onChange={(e) => updateInvoice({ invoiceNo: e.target.value })} /></label>
              <label className="text-sm font-medium">Invoice Date<input className="mt-1 w-full rounded-lg border px-3 py-2" value={invoice.invoiceDate} onChange={(e) => updateInvoice({ invoiceDate: e.target.value })} /></label>
              <label className="text-sm font-medium">Due Date<input className="mt-1 w-full rounded-lg border px-3 py-2" value={invoice.dueDate} onChange={(e) => updateInvoice({ dueDate: e.target.value })} /></label>
              <label className="text-sm font-medium">Customer<input className="mt-1 w-full rounded-lg border px-3 py-2" value={invoice.customer} onChange={(e) => updateInvoice({ customer: e.target.value })} /></label>
              <label className="text-sm font-medium">Project / WO<input className="mt-1 w-full rounded-lg border px-3 py-2" value={invoice.project} onChange={(e) => updateInvoice({ project: e.target.value })} /></label>
              <label className="text-sm font-medium">Tax Rate<input className="mt-1 w-full rounded-lg border px-3 py-2" inputMode="decimal" value={(invoice.taxRate * 100).toString()} onChange={(e) => changeTaxRate(n(e.target.value) / 100)} /></label>
              <label className="text-sm font-medium md:col-span-3">Property Address<input className="mt-1 w-full rounded-lg border px-3 py-2" value={invoice.propertyAddress} onChange={(e) => updateInvoice({ propertyAddress: e.target.value })} /></label>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">Invoice Totals</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Materials Billed</span><b>{money.format(invoiceTotals.materialsBilled)}</b></div>
              <div className="flex justify-between"><span>Material Cost</span><b>{money.format(invoiceTotals.materialCost)}</b></div>
              <div className="flex justify-between"><span>Labor</span><b>{money.format(invoiceTotals.labor)}</b></div>
              <div className="flex justify-between"><span>Tax</span><b>{money.format(invoiceTotals.tax)}</b></div>
              <div className="border-t pt-2 flex justify-between"><span>Line Total</span><b>{money.format(invoiceTotals.lineTotal)}</b></div>
              <div className="flex justify-between rounded-lg bg-emerald-50 p-2 text-emerald-900"><span>Gross Margin</span><b>{money.format(invoiceTotals.margin)}</b></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Line-Level Cost Breakdown</h2>
              <p className="text-xs text-slate-500 print:hidden">Entry order matches vendor invoices: cost first, markup second, billed price third. If an invoice import fills Material Bill / Unit, entering Markup % will back-calculate Your Cost / Unit. Money fields are per unit.</p>
            </div>
            <button onClick={() => updateInvoice({ lines: [...invoice.lines, blankLine()] })} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white print:hidden">Add Line</button>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm print:hidden">
            <label className="flex items-center gap-2 font-medium text-slate-800">
              <input type="checkbox" checked={autoFillBilled} onChange={(e) => setAutoFillBilled(e.target.checked)} />
              Auto-fill billed from your cost
            </label>
            <label className="font-medium text-slate-800">
              Standard Markup %
              <input
                className="ml-2 w-24 rounded-lg border border-slate-300 px-3 py-2 text-right"
                inputMode="decimal"
                value={materialMarkupPercent}
                onChange={(e) => setMaterialMarkupPercent(n(e.target.value))}
              />
            </label>
            <button onClick={applyMarkupToAllMaterialLines} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Apply Markup to Material Lines</button>
            <span className="text-xs text-slate-500">Imported bill $240.00 at 20% = cost $200.00. Or cost $200.00 at 20% = billed $240.00.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Your Cost / Unit</th>
                  <th className="p-2 text-right">Markup %</th>
                  <th className="p-2 text-right">Material Bill / Unit</th>
                  <th className="p-2 text-right">Labor / Unit</th>
                  <th className="p-2 text-right">Tax</th>
                  <th className="p-2 text-right">Line Total</th>
                  <th className="p-2 text-right">Margin</th>
                  <th className="p-2 print:hidden">Type</th>
                  <th className="p-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="border-b align-top">
                    <td className="p-2"><input className="w-full rounded-lg border px-3 py-2" value={line.item} onChange={(e) => updateLine(line.id, { item: e.target.value })} /></td>
                    <td className="p-2"><input className="w-20 rounded-lg border px-3 py-2 text-right" inputMode="decimal" value={line.qty} onChange={(e) => updateLine(line.id, { qty: n(e.target.value) })} /></td>
                    <td className="p-2"><CurrencyInput value={line.materialCost} onChange={(v) => updateMaterialCost(line.id, v)} /></td>
                    <td className="p-2"><input className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" inputMode="decimal" value={line.markupPercent || ""} placeholder="0" onChange={(e) => updateLineMarkup(line.id, n(e.target.value))} /></td>
                    <td className="p-2"><CurrencyInput value={line.materialsBilled} onChange={(v) => updateLine(line.id, { materialsBilled: v })} /></td>
                    <td className="p-2"><CurrencyInput value={line.labor} onChange={(v) => updateLine(line.id, { labor: v })} /></td>
                    <td className="p-2 text-right font-medium">{money.format(line.tax)}</td>
                    <td className="p-2 text-right font-bold">{money.format(line.lineTotal)}</td>
                    <td className="p-2 text-right font-bold text-emerald-700">{money.format(lineMargin(line))}</td>
                    <td className="p-2 print:hidden">
                      <select className="rounded-lg border px-2 py-2" value={line.type} onChange={(e) => updateLine(line.id, { type: e.target.value as LineType })}>
                        <option value="material">Material</option>
                        <option value="labor">Labor</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </td>
                    <td className="p-2 print:hidden"><button className="rounded-lg bg-red-50 px-3 py-2 text-red-700" onClick={() => updateInvoice({ lines: invoice.lines.filter((l) => l.id !== line.id) })}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 print:hidden">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-bold">PDF/Text Import Backup</h2>
            <textarea className="h-40 w-full rounded-xl border p-3 text-sm" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste copied invoice text here if PDF upload does not detect line items." />
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={parseTextBox} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Parse Text</button>
              <button onClick={clearImportText} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900">Clear Import Text</button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Work-Month Rollup</h2>
                <p className="text-xs text-slate-500">Live running total: saved ledger + current open invoice.</p>
                <p className="text-xs font-semibold text-slate-700">Period: {formatDate(workPeriod.start)} – {formatDate(workPeriod.end)}</p>
                <p className="text-xs text-slate-500">Work month is based on Due Date and is named by the closing month.</p>
              </div>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Work Month
                <input type="month" className="rounded-lg border px-3 py-2 text-sm font-normal text-slate-900" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </label>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span>Invoices in Work-Month Total</span><b>{runningMonthRecords.length}</b></div>
              <div className="flex justify-between"><span>Materials Billed</span><b>{money.format(monthTotals.materialsBilled)}</b></div>
              <div className="flex justify-between"><span>Material Costs to Pay/Reconcile</span><b>{money.format(monthTotals.materialCost)}</b></div>
              <div className="flex justify-between"><span>Labor Revenue</span><b>{money.format(monthTotals.labor)}</b></div>
              <div className="flex justify-between"><span>Tax Collected / Owed</span><b>{money.format(monthTotals.tax)}</b></div>
              <div className="flex justify-between border-t pt-2"><span>Total Billed</span><b>{money.format(monthTotals.lineTotal)}</b></div>
              <div className="flex justify-between rounded-lg bg-emerald-50 p-2 text-emerald-900"><span>Gross Margin</span><b>{money.format(monthTotals.margin)}</b></div>
            </div>
            <button onClick={exportMonthlyCsv} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Export Work-Month CSV</button>

            <div className="mt-4 border-t pt-3">
              <h3 className="mb-2 text-sm font-bold">Saved Ledger Invoices for This Work Month</h3>
              {savedMonthRecords.length === 0 ? (
                <p className="text-sm text-slate-500">No saved invoices yet. The current open invoice still counts if its due date falls inside this due-date work month.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-auto pr-1">
                  {savedMonthRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold">Invoice {record.invoiceNo || "No #"} · Due {record.dueDate || "No due date"}</div>
                        <div className="truncate text-xs text-slate-500">{record.customer || "No customer"} · {money.format(record.lines.reduce((s, l) => s + l.lineTotal, 0))}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => setInvoice(record)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Open</button>
                        <button onClick={() => deleteSavedInvoice(record.id)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Local Delete</button>
                        <button onClick={() => deleteCloudInvoice(record.id)} disabled={cloudBusy} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 disabled:opacity-60">Cloud Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
