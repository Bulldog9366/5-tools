"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Status =
  | "New"
  | "Triaged"
  | "Needs Approval"
  | "Approved"
  | "Scheduled"
  | "In Progress"
  | "Completed"
  | "Closed"
  | "Canceled";

type Priority = "Emergency" | "High" | "Routine" | "Low";
type Source =
  | "Tenant"
  | "Owner"
  | "Internal"
  | "Visual Report"
  | "Move-Out"
  | "Project";
type Approval = "Not Required" | "Pending" | "Approved" | "Denied";
type BillTo = "Owner" | "Tenant" | "Company/Internal" | "Split / Review";
type InvoiceStatus = "Not Created" | "Draft" | "Sent" | "Paid" | "Void";
type TripFeeLabel = "Trip Fee" | "Diagnostic Fee";

type PhotoItem = {
  id: string;
  name: string;
  dataUrl: string;
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

type WorkOrder = {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  workOrderNumber: string;
  status: Status;
  priority: Priority;
  source: Source;
  propertyAddress: string;
  city: string;
  state: string;
  zip: string;
  unit: string;
  requestorName: string;
  requestorPhone: string;
  requestorEmail: string;
  category: string;
  issueDescription: string;
  scopeOfWork: string;
  accessNotes: string;
  approvalRequired: boolean;
  approvalStatus: Approval;
  approvalNotes: string;
  maintenanceLimit: string;
  vendorName: string;
  vendorPhone: string;
  vendorEmail: string;
  scheduledDate: string;
  scheduledTime: string;
  assignedTo: string;
  materials: string;
  labor: string;
  tripFee: string;
  tripFeeLabel: TripFeeLabel;
  taxRate: string;
  billTo: BillTo;
  tenantCharge: boolean;
  tenantChargeNotes: string;
  completionNotes: string;
  beforePhotos: string;
  afterPhotos: string;
  beforePhotoData: PhotoItem[];
  afterPhotoData: PhotoItem[];
  internalNotes: string;
  pushedToOperations: boolean;
  pushedToServiceTicket: boolean;
  pushedToScheduler: boolean;
  pushedToTracker: boolean;
  pushedToEstimator: boolean;
  estimateStatus?: string;
  estimateTotal?: string;
  pricingRecordId?: string;
  pricingUpdatedAt?: string;
  pricingLineItemsJson?: string;
  invoiceNumber?: string;
  invoiceStatus?: InvoiceStatus;
  invoiceDate?: string;
  invoiceDueDate?: string;
  invoiceRecipientName?: string;
  invoiceRecipientEmail?: string;
  invoiceNotes?: string;
  invoicePaidDate?: string;
  invoicePaymentMethod?: string;
};

type ReportWorkRequestHandoff = {
  id: string;
  source?: string;
  sourceReportId?: string;
  createdAt?: string;
  title?: string;
  propertyName?: string;
  propertyAddress?: string;
  reportDate?: string;
  preparedBy?: string;
  areaId?: string;
  areaName?: string;
  areaType?: string;
  component?: string;
  rating?: string;
  recommendedAction?: string;
  priority?: string;
  skillCategory?: string;
  description?: string;
  notes?: string;
  status?: string;
  photoRefs?: Array<{
    id?: string;
    name?: string;
    caption?: string;
    type?: string;
    path?: string;
    url?: string;
  }>;
};

type CloudRow = {
  id: string;
  created_at?: string;
  updated_at?: string;
  work_order_number?: string;
  status?: string;
  priority?: string;
  property_address?: string;
  category?: string;
  grand_total?: number;
  raw_json?: WorkOrder;
};

type PricingReturnItem = {
  sourceId?: string;
  workOrderNumber?: string;
  pricingRecordId?: string;
  estimateStatus?: string;
  estimateTotal?: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  materialsTotal?: number;
  laborTotal?: number;
  disposalTotal?: number;
  tripFee?: number;
  otherTotal?: number;
  lineItems?: unknown[];
  savedAt?: string;
};

const TABLE_NAME = "work_orders";
const LOCAL_KEY = "five_tools_work_order_engine_current_v2";
const ARCHIVE_KEY = "five_tools_work_order_engine_archive_v2";
const OPS_QUEUE_KEY = "five_tools_operations_hub_queue_v1";
const SERVICE_TICKET_QUEUE_KEY = "five_tools_service_ticket_queue_v1";
const SERVICE_TICKET_DRAFT_KEY = "five_tools_service_ticket_draft_v1";
const LOCAL_SERVICE_TICKETS_KEY = "five_tools_service_tickets_local_v1";
const SHARED_PHOTO_PACKAGE_KEY = "five_tools_work_order_service_ticket_photos_v1";
const PHOTO_BUCKET_NAME = "work-order-photos";
const OCR_IMPORT_KEYS = [
  "five_tools_document_reader_last_result_v1",
  "five_tools_ocr_last_result_v1",
  "five_tools_pdf_scan_intake_v1",
  "five_tools_service_ticket_pdf_intake_v1",
];
const SCHEDULER_QUEUE_KEY = "five_tools_project_scheduler_queue_v1";
const TRACKER_QUEUE_KEY = "five_tools_project_tracker_queue_v1";
const ESTIMATOR_QUEUE_KEY = "five_tools_work_order_pricing_queue_v1";
const PRICING_RETURN_QUEUE_KEY =
  "five_tools_work_order_pricing_return_queue_v1";
const REPORT_WORK_REQUEST_HANDOFF_KEY = "fiveToolsPendingWorkRequests";

const statusOptions: Status[] = [
  "New",
  "Triaged",
  "Needs Approval",
  "Approved",
  "Scheduled",
  "In Progress",
  "Completed",
  "Closed",
  "Canceled",
];
const priorityOptions: Priority[] = ["Emergency", "High", "Routine", "Low"];
const sourceOptions: Source[] = [
  "Tenant",
  "Owner",
  "Internal",
  "Visual Report",
  "Move-Out",
  "Project",
];
const approvalOptions: Approval[] = [
  "Not Required",
  "Pending",
  "Approved",
  "Denied",
];
const billToOptions: BillTo[] = [
  "Owner",
  "Tenant",
  "Company/Internal",
  "Split / Review",
];
const categoryOptions = [
  "Plumbing",
  "Electrical",
  "Appliance",
  "HVAC",
  "Roof / Exterior",
  "Doors / Windows",
  "Flooring",
  "Painting / Drywall",
  "Cleaning / Trash-Out",
  "Yard / Landscaping",
  "Safety / Habitability",
  "Pest / Odor",
  "General Maintenance",
  "Move-Out Repair",
  "Other",
];

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Work Orders", href: "/work-order-engine" },
  { label: "Pricing Notebook", href: "/work-order-pricing" },
  { label: "Cost Estimator", href: "/cost-estimator" },
  { label: "Scheduler", href: "/project-scheduler" },
  { label: "Projects", href: "/project-tracker" },
  { label: "Truck Inventory", href: "/truck-inventory" },
];

const emptyWorkOrder: WorkOrder = {
  workOrderNumber: "",
  status: "New",
  priority: "Routine",
  source: "Tenant",
  propertyAddress: "",
  city: "",
  state: "WA",
  zip: "",
  unit: "",
  requestorName: "",
  requestorPhone: "",
  requestorEmail: "",
  category: "General Maintenance",
  issueDescription: "",
  scopeOfWork: "",
  accessNotes: "",
  approvalRequired: false,
  approvalStatus: "Not Required",
  approvalNotes: "",
  maintenanceLimit: "",
  vendorName: "",
  vendorPhone: "",
  vendorEmail: "",
  scheduledDate: "",
  scheduledTime: "",
  assignedTo: "",
  materials: "0.00",
  labor: "0.00",
  tripFee: "0.00",
  tripFeeLabel: "Trip Fee",
  taxRate: "10.30",
  billTo: "Owner",
  tenantCharge: false,
  tenantChargeNotes: "",
  completionNotes: "",
  beforePhotos: "",
  afterPhotos: "",
  beforePhotoData: [],
  afterPhotoData: [],
  internalNotes: "",
  pushedToOperations: false,
  pushedToServiceTicket: false,
  pushedToScheduler: false,
  pushedToTracker: false,
  pushedToEstimator: false,
  estimateStatus: "Not Started",
  estimateTotal: "0.00",
  pricingRecordId: "",
  pricingUpdatedAt: "",
  pricingLineItemsJson: "[]",
  invoiceNumber: "",
  invoiceStatus: "Not Created",
  invoiceDate: "",
  invoiceDueDate: "",
  invoiceRecipientName: "",
  invoiceRecipientEmail: "",
  invoiceNotes: "",
  invoicePaidDate: "",
  invoicePaymentMethod: "",
};

function asNumber(value: string | number | undefined | null) {
  const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}


function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const anyError = error as { message?: unknown; error_description?: unknown; details?: unknown; hint?: unknown; code?: unknown; status?: unknown; name?: unknown };
    const parts = [
      anyError.message,
      anyError.error_description,
      anyError.details,
      anyError.hint,
      anyError.code ? `Code: ${String(anyError.code)}` : "",
      anyError.status ? `Status: ${String(anyError.status)}` : "",
      anyError.name,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (parts.length) return Array.from(new Set(parts)).join(" — ");
    try {
      const json = JSON.stringify(error);
      if (json && json !== "{}") return json;
    } catch {}
  }
  return "Unknown Supabase/client error.";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysInput(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildInvoiceNumber(workOrderNumber: string) {
  const base = workOrderNumber || `5T-WO-${new Date().getFullYear()}`;
  return base.startsWith("INV-") ? base : `INV-${base}`;
}



function buildWorkOrderNumber(
  address: string,
  city: string,
  zip: string,
) {
  const safeCity =
    city
      ?.replace(/[^a-zA-Z]/g, "")
      ?.trim()
      ?.slice(0, 12) || "Property";

  const safeZip =
    zip?.replace(/[^0-9]/g, "")?.slice(0, 5) || "00000";

  const addressSeed =
    address
      ?.replace(/[^a-zA-Z0-9]/g, "")
      ?.toUpperCase()
      ?.slice(0, 10) || "UNKNOWN";

  const storageKey = `five_tools_wo_counter_${safeZip}_${safeCity}_${addressSeed}`;

  let currentNumber = 1;

  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      currentNumber = Number(stored) + 1;
    }

    localStorage.setItem(storageKey, String(currentNumber));
  }

  const seriesNumber = Math.ceil(currentNumber / 26);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const letter =
    alphabet[(currentNumber - 1) % 26] || "A";

  return `5T-WO-${safeZip}-${safeCity}-${seriesNumber}${letter}`;
}


function mapSecretaryPriority(value: unknown): Priority {
  const raw = String(value || "").toLowerCase();
  if (["emergency", "urgent", "critical"].includes(raw)) return "Emergency";
  if (["high", "important"].includes(raw)) return "High";
  if (["low"].includes(raw)) return "Low";
  return "Routine";
}

function cleanSecretaryText(value: string) {
  return value
    .replace(/\b(create|start|add)\s+(a\s+)?work\s*order\b/gi, "")
    .replace(/\bwork\s*order\s*draft\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s.:-]+/, "")
    .trim();
}

function splitSecretaryAddressAndIssue(text: string) {
  const cleaned = cleanSecretaryText(text);

  const withoutCommand = cleaned
    .replace(/^(create|make|add|start|new)?\s*(a\s+)?work\s*order(?:\s+draft)?\s*/i, "")
    .replace(/^[\s.:;-]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  const suffixPattern =
    "(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|place|pl|way|loop|terrace|trail|circle|cir|boulevard|blvd|parkway|pkwy|highway|hwy)";

  const fullAddressMatch = withoutCommand.match(
    new RegExp(
      `^(\\d{1,6}\\s+.+?\\b${suffixPattern}\\b(?:\\s+(?:N|S|E|W|NE|NW|SE|SW))?)\\s+([A-Za-z][A-Za-z .'-]*?)\\s+(WA|Washington)\\s+(\\d{5}(?:-\\d{4})?)\\b[\\s.,:;-]*(.*)$`,
      "i",
    ),
  );

  if (fullAddressMatch) {
    return {
      propertyAddress: fullAddressMatch[1].replace(/\s+/g, " ").trim(),
      city: fullAddressMatch[2].replace(/\s+/g, " ").trim(),
      state: "WA",
      zip: fullAddressMatch[4].trim(),
      issueDescription:
        fullAddressMatch[5].replace(/^[\s.,:;-]+/, "").replace(/\s+/g, " ").trim() ||
        "Secretary work order draft",
    };
  }

  const looseAddressMatch = withoutCommand.match(
    /(\d{1,6}\s+.*?\b(?:WA|Washington)\s+\d{5}(?:-\d{4})?)/i,
  );

  if (!looseAddressMatch) {
    return {
      propertyAddress: "",
      city: "",
      state: "WA",
      zip: "",
      issueDescription: withoutCommand || cleaned,
    };
  }

  const propertyAddress = looseAddressMatch[1]
    .replace(/[.,;:-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const issueDescription = withoutCommand
    .replace(looseAddressMatch[0], "")
    .replace(/^[\s.:-]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    propertyAddress,
    city: "",
    state: "WA",
    zip: "",
    issueDescription: issueDescription || "Secretary work order draft",
  };
}


function pickFirstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function cleanPdfValue(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,-]+/, "")
    .replace(/[\s:;,-]+$/, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSection(text: string, startLabel: string, endLabels: string[]) {
  const labelPattern = escapeRegExp(startLabel).replace(/\\\s\+/g, "\\s+");
  const endPattern = endLabels.map((label) => escapeRegExp(label)).join("|");
  const match = text.match(new RegExp(`${labelPattern}\\s*([\\s\\S]*?)(?=${endPattern}|$)`, "i"));
  return cleanPdfValue(match?.[1] || "");
}

function extractAddressPartsFromJobSite(jobSite: string) {
  const cleaned = cleanPdfValue(jobSite);

  const fullAddressMatch = cleaned.match(
    /(\d{3,6}\s+.+?\b(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Loop|Circle|Cir|Boulevard|Blvd|Highway|Hwy)\b(?:\s+[A-Z])?)\s+([A-Za-z][A-Za-z .'-]+),?\s+(WA|Washington)\s+(\d{5}(?:-\d{4})?)/i,
  );

  if (fullAddressMatch) {
    return {
      propertyAddress: cleanPdfValue(fullAddressMatch[1]),
      city: cleanPdfValue(fullAddressMatch[2]),
      state: "WA",
      zip: cleanPdfValue(fullAddressMatch[4]),
    };
  }

  const repeatedAddressMatch = cleaned.match(
    /(\d{3,6}\s+.+?\b(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Loop|Circle|Cir|Boulevard|Blvd|Highway|Hwy)\b(?:\s+[A-Z])?)(?:\s+\1)?/i,
  );

  const cityZipMatch = cleaned.match(/([A-Za-z][A-Za-z .'-]+),?\s+(WA|Washington)\s+(\d{5}(?:-\d{4})?)/i);

  return {
    propertyAddress: cleanPdfValue(repeatedAddressMatch?.[1] || cleaned),
    city: cleanPdfValue(cityZipMatch?.[1] || ""),
    state: "WA",
    zip: cleanPdfValue(cityZipMatch?.[3] || ""),
  };
}

function extractTenantContactParts(tenantSection: string) {
  const cleaned = cleanPdfValue(tenantSection);
  const emails = Array.from(
    new Set((cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((email) => email.trim())),
  );
  const phones = Array.from(
    new Set((cleaned.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []).map((phone) => phone.trim())),
  );

  let namesSource = cleaned;
  emails.forEach((email) => {
    namesSource = namesSource.replace(new RegExp(escapeRegExp(email), "gi"), " ");
  });
  phones.forEach((phone) => {
    namesSource = namesSource.replace(new RegExp(escapeRegExp(phone), "g"), " ");
  });

  namesSource = namesSource
    .replace(/\b(?:Mobile|Phone|Home|Cell|Work|Email)\b\s*-?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const names = namesSource
    .split(/\s{2,}|\s+(?=[A-Z][a-z]+\s+[A-Z]\.?\s*[A-Z]?[a-z]+|[A-Z][a-z]+\s+[A-Z][a-z]+)/)
    .map((name) => cleanPdfValue(name))
    .filter((name) => name && !/tenant|availability|description/i.test(name));

  return {
    requestorName: Array.from(new Set(names)).join(" / "),
    requestorPhone: phones.join(" / "),
    requestorEmail: emails.join(" / "),
  };
}

function formatMoneyText(value: string) {
  const parsed = asNumber(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
}

function parseWorkOrderIntakeText(text: string, sourceLabel: string): Partial<WorkOrder> {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const compact = normalized.replace(/\s+/g, " ").trim();

  const workOrderNumber =
    pickFirstMatch(normalized, /Work\s*Order\s*#\s*([A-Z0-9-]+)/i) ||
    pickFirstMatch(compact, /Work\s*Order\s*#\s*([A-Z0-9-]+)/i);

  const jobSiteSection =
    findSection(normalized, "Job Site", ["Pet(s)", "Maintenance Limit", "Tenant(s)", "Tenant Availability", "Description"]) ||
    findSection(compact, "Job Site", ["Pet(s)", "Maintenance Limit", "Tenant(s)", "Tenant Availability", "Description"]);

  const addressParts = extractAddressPartsFromJobSite(jobSiteSection);

  const tenantSection =
    findSection(normalized, "Tenant(s)", ["Tenant Availability", "Description", "Vendor Instructions"]) ||
    findSection(compact, "Tenant(s)", ["Tenant Availability", "Description", "Vendor Instructions"]);
  const tenantContact = extractTenantContactParts(tenantSection);

  const descriptionSection =
    findSection(normalized, "Description", ["Vendor Instructions", "Created By", "Technician", "Completion", "Labor"]) ||
    findSection(compact, "Description", ["Vendor Instructions", "Created By", "Technician", "Completion", "Labor"]);

  const cleanDescription = cleanPdfValue(descriptionSection);

  const maintenanceLimit =
    pickFirstMatch(normalized, /Maintenance\s*Limit\s*\$?\s*([\d,.]+)/i) ||
    pickFirstMatch(compact, /Maintenance\s*Limit\s*\$?\s*([\d,.]+)/i);

  const estimateAmount =
    pickFirstMatch(normalized, /Estimate\s*Amount\s*\$?\s*([\d,.]+)/i) ||
    pickFirstMatch(compact, /Estimate\s*Amount\s*\$?\s*([\d,.]+)/i);

  const fallbackAddressLine =
    pickFirstMatch(
      normalized,
      /(?:property|tenant\s+address|job\s+site|service\s+address|address)\s*:?\s*([^\n]+)/i,
    ) ||
    pickFirstMatch(
      normalized,
      /(\d{1,6}\s+[^\n,]+?\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|pl|place|way|loop|blvd|boulevard|pkwy|parkway|hwy|highway)\b[^\n]*)/i,
    );

  const parsedAddress = splitSecretaryAddressAndIssue(fallbackAddressLine || compact);

  const fallbackTenantName =
    pickFirstMatch(normalized, /(?:tenant|resident|requestor|requester|contact)\s*:?\s*([^\n]+)/i) ||
    pickFirstMatch(normalized, /(?:name)\s*:?\s*([^\n]+)/i);

  const fallbackPhone = pickFirstMatch(
    normalized,
    /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/,
  );

  const fallbackEmail = pickFirstMatch(
    normalized,
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  );

  const fallbackDescription =
    pickFirstMatch(normalized, /(?:description|issue|problem|request|maintenance\s+request)\s*:?\s*([\s\S]{1,900})/i) ||
    normalized.slice(0, 900);

  const finalDescription = cleanDescription || cleanPdfValue(fallbackDescription);

  const lower = compact.toLowerCase();
  let category = "General Maintenance";
  if (/(dryer\s*vent|vent\s*line|exhaust\s*fan|bath\s*fan|hvac|heat|furnace|air conditioner|ac\b|thermostat)/i.test(compact)) category = "HVAC";
  else if (/(dishwasher|refrigerator|stove|range|oven|washer|dryer|appliance)/i.test(compact)) category = "Appliance";
  else if (/(toilet|sink|faucet|leak|plumb|drain|water heater)/i.test(compact)) category = "Plumbing";
  else if (/(breaker|outlet|gfci|electrical|light|switch|power)/i.test(compact)) category = "Electrical";
  else if (/(paint|drywall|sheetrock|wall repair|hole)/i.test(compact)) category = "Painting / Drywall";
  else if (/(floor|carpet|lvp|vinyl|hardwood)/i.test(compact)) category = "Flooring";
  else if (/(trash|clean|debris|junk|haul)/i.test(compact)) category = "Cleaning / Trash-Out";

  const priority: Priority =
    /(emergency|urgent|flood|no heat|no power|active leak|habitability)/i.test(compact)
      ? "Emergency"
      : /(asap|high priority|important)/i.test(compact)
        ? "High"
        : lower.includes("low priority")
          ? "Low"
          : "Routine";

  return {
    workOrderNumber: workOrderNumber || "",
    priority,
    source: "Tenant",
    propertyAddress: addressParts.propertyAddress || parsedAddress.propertyAddress,
    city: addressParts.city || parsedAddress.city,
    state: addressParts.state || parsedAddress.state || "WA",
    zip: addressParts.zip || parsedAddress.zip,
    requestorName: tenantContact.requestorName || fallbackTenantName,
    requestorPhone: tenantContact.requestorPhone || fallbackPhone,
    requestorEmail: tenantContact.requestorEmail || fallbackEmail,
    category,
    issueDescription: finalDescription,
    scopeOfWork: buildScope(category, finalDescription),
    maintenanceLimit: maintenanceLimit ? `$${formatMoneyText(maintenanceLimit)}` : "",
    approvalRequired: false,
    approvalStatus: "Not Required",
    estimateTotal: estimateAmount ? asNumber(estimateAmount).toFixed(2) : "0.00",
    estimateStatus: estimateAmount ? "Completed" : "Not Started",
    internalNotes: `Imported from ${sourceLabel} on ${new Date().toLocaleString()}.\n\nRaw intake text:\n${normalized.slice(0, 4000)}`,
  };
}
function buildWorkOrderFromSecretaryDraft(parsed: Record<string, unknown>): WorkOrder {
  const title = String(parsed.title || "").trim();
  const details = String(parsed.details || "").trim();
  const combinedText = [title, details].filter(Boolean).join(" ").trim();
  const parsedText = splitSecretaryAddressAndIssue(combinedText);

  const explicitAddress = String(
    parsed.property_address || parsed.propertyAddress || parsed.address || "",
  ).trim();
  const explicitAddressParts = explicitAddress
    ? splitSecretaryAddressAndIssue(explicitAddress)
    : null;

  const propertyAddress = String(
    explicitAddressParts?.propertyAddress || explicitAddress || parsedText.propertyAddress || "",
  ).trim();

  const city = String(
    parsed.city || explicitAddressParts?.city || parsedText.city || "",
  ).trim();

  const state = String(
    parsed.state || explicitAddressParts?.state || parsedText.state || "WA",
  ).trim();

  const zip = String(
    parsed.zip || explicitAddressParts?.zip || parsedText.zip || "",
  ).trim();

  const issueDescription = String(
    parsedText.issueDescription ||
      parsed.issueDescription ||
      parsed.description ||
      "Secretary work order draft",
  ).trim();

  const contactName = String(
    parsed.contact_name || parsed.contactName || parsed.requestorName || "",
  ).trim();
  const dueDate = String(parsed.due_date || parsed.dueDate || "").trim();
  const dueTime = String(parsed.due_time || parsed.dueTime || "").trim();
  const priority = mapSecretaryPriority(parsed.priority);

  return {
    ...emptyWorkOrder,
    workOrderNumber: buildWorkOrderNumber("", "", ""),
    status: "New",
    priority,
    source: "Internal",
    propertyAddress,
    city,
    state,
    zip,
    requestorName: contactName,
    category: "General Maintenance",
    issueDescription,
    scopeOfWork: buildScope("General Maintenance", issueDescription),
    scheduledDate: dueDate || todayInput(),
    scheduledTime: dueTime,
    internalNotes: `Imported from Virtual Secretary${
      parsed.id ? ` item ${String(parsed.id)}` : ""
    }. Original command: ${combinedText || "Not provided"}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function readQueue<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readReportWorkRequestHandoffs() {
  return readQueue<ReportWorkRequestHandoff>(REPORT_WORK_REQUEST_HANDOFF_KEY);
}

function writeReportWorkRequestHandoffs(items: ReportWorkRequestHandoff[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REPORT_WORK_REQUEST_HANDOFF_KEY, JSON.stringify(items));
}

function mapReportPriorityToWorkOrderPriority(priority?: string): Priority {
  const normalized = String(priority || "").toLowerCase();
  if (normalized.includes("immediate") || normalized.includes("emergency")) return "Emergency";
  if (normalized.includes("high")) return "High";
  if (normalized.includes("low")) return "Low";
  return "Routine";
}

function mapReportSkillToWorkOrderCategory(skill?: string, component?: string) {
  const text = `${skill || ""} ${component || ""}`.toLowerCase();

  if (text.includes("plumbing") || text.includes("toilet") || text.includes("sink") || text.includes("faucet") || text.includes("drain")) return "Plumbing";
  if (text.includes("electrical") || text.includes("gfci") || text.includes("outlet") || text.includes("light") || text.includes("breaker")) return "Electrical";
  if (text.includes("appliance") || text.includes("dishwasher") || text.includes("range") || text.includes("stove") || text.includes("refrigerator")) return "Appliance";
  if (text.includes("hvac") || text.includes("heat") || text.includes("vent") || text.includes("exhaust")) return "HVAC";
  if (text.includes("roof") || text.includes("exterior") || text.includes("siding") || text.includes("gutter")) return "Roof / Exterior";
  if (text.includes("door") || text.includes("lock") || text.includes("window")) return "Doors / Windows";
  if (text.includes("floor") || text.includes("carpet") || text.includes("lvp")) return "Flooring";
  if (text.includes("drywall") || text.includes("paint") || text.includes("wall") || text.includes("ceiling")) return "Painting / Drywall";
  if (text.includes("clean") || text.includes("trash") || text.includes("haul")) return "Cleaning / Trash-Out";
  if (text.includes("safety") || text.includes("life")) return "Safety / Habitability";
  if (text.includes("pest") || text.includes("odor") || text.includes("mold") || text.includes("moisture")) return "Pest / Odor";

  return "General Maintenance";
}

function buildWorkOrderFromReportHandoff(handoff: ReportWorkRequestHandoff): WorkOrder {
  const category = mapReportSkillToWorkOrderCategory(handoff.skillCategory, handoff.component);
  const issueDescription =
    handoff.description ||
    [handoff.areaName, handoff.component, handoff.rating, handoff.recommendedAction, handoff.notes]
      .filter(Boolean)
      .join(" — ") ||
    "Report item flagged for repair.";

  const photoLines = (handoff.photoRefs || [])
    .map((photo, index) => {
      const label = photo.caption || photo.name || `Photo ${index + 1}`;
      const ref = photo.url || photo.path || "No cloud photo link saved";
      return `${label}: ${ref}`;
    })
    .join("\n");

  return {
    ...emptyWorkOrder,
    workOrderNumber: buildWorkOrderNumber(handoff.propertyAddress || handoff.propertyName || "", "", ""),
    status: "New",
    priority: mapReportPriorityToWorkOrderPriority(handoff.priority),
    source: "Visual Report",
    propertyAddress: handoff.propertyAddress || handoff.propertyName || "",
    city: "",
    state: "WA",
    zip: "",
    category,
    issueDescription,
    scopeOfWork: buildScope(category, issueDescription),
    scheduledDate: todayInput(),
    internalNotes: [
      "Created from Reports / Property Condition Report handoff.",
      handoff.sourceReportId ? `Source Report ID: ${handoff.sourceReportId}` : "",
      handoff.reportDate ? `Report Date: ${handoff.reportDate}` : "",
      handoff.preparedBy ? `Prepared By: ${handoff.preparedBy}` : "",
      handoff.areaName ? `Area: ${handoff.areaName}` : "",
      handoff.component ? `Component: ${handoff.component}` : "",
      handoff.rating ? `Condition Rating: ${handoff.rating}` : "",
      handoff.recommendedAction ? `Recommended Action: ${handoff.recommendedAction}` : "",
      handoff.skillCategory ? `Skill Category: ${handoff.skillCategory}` : "",
      handoff.notes ? `Item Notes: ${handoff.notes}` : "",
      photoLines ? `Issue Photos:\n${photoLines}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    beforePhotos: photoLines,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getPhotoPackageKey(workOrderNumber: string, sourceId?: string) {
  return sourceId || workOrderNumber || "unsaved-work-order";
}

function readSharedPhotoPackages() {
  if (typeof window === "undefined") return {};
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
      LOCAL_KEY,
      ARCHIVE_KEY,
      SERVICE_TICKET_DRAFT_KEY,
      SERVICE_TICKET_QUEUE_KEY,
      LOCAL_SERVICE_TICKETS_KEY,
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

function photoTimeValue(value: unknown) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : 0;
}

function photoUpdatedTime(photo: PhotoItem) {
  return Math.max(
    photoTimeValue(photo.cloudUploadedAt),
    photoTimeValue(photo.uploadedAt),
  );
}

function photoIsCloud(photo: PhotoItem) {
  return photo.uploadStatus === "cloud" || Boolean(photo.publicUrl || photo.storagePath);
}

function photoMergeKey(photo: PhotoItem) {
  const section = photo.section || "photo";
  const name = String(photo.name || "photo").trim().toLowerCase();
  const size = String(photo.sizeBytes || "").trim();

  if (name && size) return `${section}|${name}|${size}`;
  if (photo.storagePath) return `${section}|path|${photo.storagePath}`;
  if (photo.publicUrl) return `${section}|url|${photo.publicUrl}`;
  return `${section}|id|${photo.id || `${name}|${photo.uploadedAt}`}`;
}

function chooseBetterPhoto(current: PhotoItem, incoming: PhotoItem) {
  const currentCloud = photoIsCloud(current);
  const incomingCloud = photoIsCloud(incoming);

  if (incomingCloud && !currentCloud) return incoming;
  if (!incomingCloud && currentCloud) return current;

  return photoUpdatedTime(incoming) >= photoUpdatedTime(current) ? incoming : current;
}

function mergePhotoLists(...lists: (PhotoItem[] | undefined)[]) {
  const byKey = new Map<string, PhotoItem>();

  lists.flatMap((list) => list || []).forEach((photo) => {
    if (!photo) return;
    const key = photoMergeKey(photo);
    const existing = byKey.get(key);
    byKey.set(key, existing ? chooseBetterPhoto(existing, photo) : photo);
  });

  return Array.from(byKey.values()).sort((a, b) => photoUpdatedTime(a) - photoUpdatedTime(b));
}

function photoPackageTime(pack?: { updatedAt?: string }) {
  return photoTimeValue(pack?.updatedAt);
}

function saveSharedPhotoPackage(wo: WorkOrder) {
  if (typeof window === "undefined") return;
  const key = getPhotoPackageKey(wo.workOrderNumber, wo.id);
  if (!key || key === "unsaved-work-order") return;

  const packages = readSharedPhotoPackages();
  const existingPackages = [packages[key], wo.workOrderNumber ? packages[wo.workOrderNumber] : undefined, wo.id ? packages[wo.id] : undefined]
    .filter(Boolean)
    .sort((a, b) => photoPackageTime(b) - photoPackageTime(a));

  const before = (wo.beforePhotoData || []).map(sanitizePhotoForStorage);
  const after = (wo.afterPhotoData || []).map(sanitizePhotoForStorage);

  const packageValue = {
    beforePhotoData: mergePhotoLists(before, ...existingPackages.map((pack) => pack?.beforePhotoData)),
    afterPhotoData: mergePhotoLists(after, ...existingPackages.map((pack) => pack?.afterPhotoData)),
    updatedAt: new Date().toISOString(),
  };

  packages[key] = packageValue;

  if (wo.workOrderNumber) packages[wo.workOrderNumber] = packageValue;
  if (wo.id) packages[wo.id] = packageValue;

  localStorage.setItem(SHARED_PHOTO_PACKAGE_KEY, JSON.stringify(packages));
}

function readLocalServiceTickets() {
  if (typeof window === "undefined") return [] as any[];
  try {
    const tickets: any[] = [];
    const primary = localStorage.getItem(LOCAL_SERVICE_TICKETS_KEY);
    const legacy = localStorage.getItem("serviceTickets");
    const draft = localStorage.getItem(SERVICE_TICKET_DRAFT_KEY);
    const queue = localStorage.getItem(SERVICE_TICKET_QUEUE_KEY);

    [primary, legacy, queue].forEach((raw) => {
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) tickets.push(...parsed);
      else if (parsed && typeof parsed === "object") tickets.push(parsed);
    });

    if (draft) {
      const parsedDraft = JSON.parse(draft);
      if (parsedDraft && typeof parsedDraft === "object") tickets.push(parsedDraft);
    }

    return tickets;
  } catch {
    return [];
  }
}

function findServiceTicketPhotoPackagesForWorkOrder(wo: WorkOrder) {
  const keys = new Set([wo.id, wo.workOrderNumber].map((value) => String(value || "").trim()).filter(Boolean));
  if (!keys.size) return [] as { beforePhotoData?: PhotoItem[]; afterPhotoData?: PhotoItem[]; updatedAt?: string }[];

  const matchesKey = (ticket: any) => {
    const ticketKeys = [
      ticket?.id,
      ticket?.ticketNumber,
      ticket?.workOrderNumber,
      ticket?.sourceId,
      ticket?.rawWorkOrder?.id,
      ticket?.rawWorkOrder?.workOrderNumber,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    return ticketKeys.some((ticketKey) => keys.has(ticketKey));
  };

  return readLocalServiceTickets()
    .filter(matchesKey)
    .map((ticket) => ({
      beforePhotoData: ticket.beforePhotoData || ticket.rawWorkOrder?.beforePhotoData || [],
      afterPhotoData: ticket.afterPhotoData || ticket.rawWorkOrder?.afterPhotoData || [],
      updatedAt: ticket.updatedAt || ticket.updated_at || ticket.createdAt || ticket.created_at || new Date().toISOString(),
    }))
    .sort((a, b) => photoPackageTime(b) - photoPackageTime(a));
}

function loadSharedPhotoPackage(wo: WorkOrder) {
  const packages = readSharedPhotoPackages();
  const keys = [wo.id, wo.workOrderNumber].map((value) => String(value || "").trim()).filter(Boolean);
  const matchingSharedPackages = keys
    .map((key) => packages[key])
    .filter(Boolean)
    .sort((a, b) => photoPackageTime(b) - photoPackageTime(a));

  const serviceTicketPacks = findServiceTicketPhotoPackagesForWorkOrder(wo);
  const allPackages = [...serviceTicketPacks, ...matchingSharedPackages];

  return {
    beforePhotoData: mergePhotoLists(...allPackages.map((pack) => pack.beforePhotoData), wo.beforePhotoData || []),
    afterPhotoData: mergePhotoLists(...allPackages.map((pack) => pack.afterPhotoData), wo.afterPhotoData || []),
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Photo could not be read."));
    reader.readAsDataURL(file);
  });
}

function safeStorageSegment(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}

function getPhotoDisplaySrc(photo: PhotoItem) {
  return photo.dataUrl || photo.publicUrl || "";
}

function sanitizePhotoForStorage(photo: PhotoItem): PhotoItem {
  return {
    id: photo.id,
    name: photo.name || "Photo",
    dataUrl: "",
    caption: photo.caption || "",
    uploadedAt: photo.uploadedAt || new Date().toISOString(),
    section: photo.section,
    storagePath: photo.storagePath || "",
    publicUrl: photo.publicUrl || "",
    mimeType: photo.mimeType || "",
    sizeBytes: photo.sizeBytes || 0,
    cloudUploadedAt: photo.cloudUploadedAt || "",
    uploadStatus: photo.storagePath || photo.publicUrl ? "cloud" : photo.uploadStatus || "local",
    uploadError: photo.storagePath || photo.publicUrl ? "" : photo.uploadError || "",
  };
}

function sanitizeWorkOrderForStorage(wo: WorkOrder): WorkOrder {
  return {
    ...wo,
    beforePhotoData: (wo.beforePhotoData || []).map(sanitizePhotoForStorage),
    afterPhotoData: (wo.afterPhotoData || []).map(sanitizePhotoForStorage),
  };
}

function getPhotoStorageWorkOrderNumber(wo: WorkOrder) {
  return (
    wo.workOrderNumber ||
    buildWorkOrderNumber(wo.propertyAddress, wo.city, wo.zip)
  );
}

function buildPhotoStoragePath(
  wo: WorkOrder,
  section: "before" | "after",
  photoId: string,
  fileName: string,
) {
  const extension =
    fileName.includes(".")
      ? fileName.split(".").pop()?.toLowerCase()?.replace(/[^a-z0-9]/g, "") || "jpg"
      : "jpg";

  return `work-orders/${safeStorageSegment(getPhotoStorageWorkOrderNumber(wo))}/${section}/${safeStorageSegment(photoId)}.${extension}`;
}

async function uploadPhotoFileToSupabase(
  wo: WorkOrder,
  section: "before" | "after",
  photoId: string,
  file: File,
) {
  const supabase = await getSupabaseClient();
  const storagePath = buildPhotoStoragePath(wo, section, photoId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) throw new Error(getErrorMessage(uploadError));

  const { data } = supabase.storage
    .from(PHOTO_BUCKET_NAME)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data?.publicUrl || "",
    cloudUploadedAt: new Date().toISOString(),
  };
}

async function deletePhotoFileFromSupabase(photo: PhotoItem) {
  if (!photo.storagePath) return;
  const supabase = await getSupabaseClient();
  await supabase.storage.from(PHOTO_BUCKET_NAME).remove([photo.storagePath]);
}

function writeQueue<T extends { sourceId?: string; workOrderNumber?: string }>(
  key: string,
  item: T,
) {
  const queue = readQueue<T>(key);
  const sourceId = item.sourceId || item.workOrderNumber;
  const filtered = queue.filter(
    (existing) => (existing.sourceId || existing.workOrderNumber) !== sourceId,
  );
  localStorage.setItem(key, JSON.stringify([item, ...filtered]));
}

function buildScope(category: string, description: string) {
  const issue = description.trim() || "reported maintenance issue";
  const map: Record<string, string> = {
    Plumbing: `Inspect reported plumbing issue, diagnose source of failure, repair or replace approved components, test for proper operation, clean up work area, and report any additional findings. Reported issue: ${issue}`,
    Electrical: `Inspect reported electrical issue, verify safety, diagnose failure, complete approved repair or replacement, test operation, and document unresolved safety concerns. Reported issue: ${issue}`,
    Appliance: `Inspect appliance concern, confirm condition/model where available, diagnose issue, complete approved repair or replacement steps, test operation, and document findings. Reported issue: ${issue}`,
    "Cleaning / Trash-Out": `Complete approved cleaning/trash-out work, remove approved debris, photograph before and after conditions, and report any damage or hazardous conditions found. Reported issue: ${issue}`,
    "Painting / Drywall": `Inspect affected surfaces, complete approved preparation, patching, priming/Kilz where required, painting, and cleanup. Document areas completed and any excluded items. Reported issue: ${issue}`,
    Flooring: `Inspect affected flooring, identify damaged material/area, complete approved repair or replacement, document square footage/area affected, and photograph before and after. Reported issue: ${issue}`,
    "Safety / Habitability": `Prioritize safety/habitability concern, inspect condition, complete approved corrective action, verify completion where applicable, and immediately report unresolved safety concerns. Reported issue: ${issue}`,
  };
  return (
    map[category] ||
    `Review reported issue, diagnose cause, complete approved repair or service work, document labor/materials used, photograph as needed, and provide close-out notes. Reported issue: ${issue}`
  );
}

async function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon)
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  const mod = await import("@supabase/supabase-js");
  return mod.createClient(url, anon);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-[#e6d2aa]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#7c5725] bg-[#120a05]/70 px-3 py-2.5 text-[#fff5df] outline-none focus:border-[#d4a640] focus:bg-[#241509]/90 focus:ring-2 focus:ring-[#b57a32]/20"
      />
    </Field>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex overflow-hidden rounded-2xl border border-[#7c5725] bg-[#120a05]/70 focus-within:border-[#d4a640] focus-within:bg-[#241509]/90 focus-within:ring-2 focus-within:ring-[#c9a227]/20">
        <span className="flex items-center border-r border-[#7c5725] bg-[#120a05] px-3 text-[#e6d2aa]">
          $
        </span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(asNumber(value).toFixed(2))}
          className="w-full bg-transparent px-3 py-2.5 text-[#fff5df] outline-none"
        />
      </div>
    </Field>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-2xl border border-[#7c5725] bg-[#120a05]/70 px-3 py-2.5 text-[#fff5df] outline-none focus:border-[#d4a640] focus:bg-[#241509]/90 focus:ring-2 focus:ring-[#b57a32]/20"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#7c5725] bg-[#120a05]/70 px-3 py-2.5 text-[#fff5df] outline-none focus:border-[#d4a640] focus:bg-[#241509]/90 focus:ring-2 focus:ring-[#b57a32]/20"
      />
    </Field>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#b88a35]/60 bg-[#241509]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur print:break-inside-avoid print:shadow-none">
      <div className="mb-4 border-b border-[#7c5725] pb-3">
        <h2 className="text-lg font-bold text-[#fff5df]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[#e6d2aa]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PhotoManager({
  title,
  description,
  photos,
  notes,
  onNotesChange,
  onAddPhotos,
  onCaptionChange,
  onRemovePhoto,
  onSaveCloud,
}: {
  title: string;
  description: string;
  photos: PhotoItem[];
  notes: string;
  onNotesChange: (value: string) => void;
  onAddPhotos: (files: FileList | null) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onRemovePhoto: (id: string) => void;
  onSaveCloud: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-md border border-[#7c5725] bg-[#120a05]/70 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-[#fff5df]">
            {title}
          </h3>
          <p className="mt-1 text-xs font-semibold text-[#e6d2aa]">
            {description}
          </p>
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
            className="rounded-md bg-[#8a5a18] px-4 py-2 text-sm font-black text-white hover:bg-[#b98525]"
          >
            Upload Photos
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSaveCloud();
            }}
            className="mt-2 rounded-md border border-[#d4a640] bg-[#241509]/90 px-4 py-2 text-sm font-black text-[#fff5df] hover:bg-[#120a05]/70"
          >
            Save Photos to Cloud
          </button>
        </div>
      </div>

      <TextArea
        label="Photo Links / Notes"
        value={notes}
        onChange={onNotesChange}
        rows={3}
        placeholder="Optional links, storage references, or photo notes. Uploaded photos below are shared with Service Ticket."
      />

      {photos.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-xl border border-[#7c5725] bg-[#241509]/90 shadow-sm">
              <img
                src={getPhotoDisplaySrc(photo)}
                alt={photo.caption || photo.name}
                className="h-40 w-full object-cover"
              />
              <div className="space-y-2 p-3">
                <div>
                  <p className="truncate text-xs font-black text-[#fff5df]">{photo.name}</p>
                  <p className={`mt-1 text-[11px] font-bold ${photo.uploadStatus === "cloud" ? "text-green-700" : photo.uploadStatus === "failed" ? "text-red-700" : "text-[#d4a640]"}`}>
                    {photo.uploadStatus === "cloud"
                      ? "Saved to Supabase"
                      : photo.uploadStatus === "failed"
                        ? `Local only — ${photo.uploadError || "cloud upload failed"}`
                        : "Local preview"}
                  </p>
                </div>
                <input
                  value={photo.caption}
                  onChange={(e) => onCaptionChange(photo.id, e.target.value)}
                  placeholder="Caption / location"
                  className="w-full rounded-lg border border-[#7c5725] bg-[#120a05]/70 px-2 py-2 text-sm text-[#fff5df] outline-none focus:border-[#d4a640] focus:bg-[#241509]/90"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#e6d2aa]">
                    {new Date(photo.uploadedAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(photo.id)}
                    className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-black text-red-800 hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-[#7c5725] bg-[#241509]/90 px-3 py-4 text-sm font-semibold text-[#e6d2aa]">
          No uploaded photos yet.
        </p>
      )}
    </div>
  );
}

export default function WorkOrderEnginePage() {
  const [workOrder, setWorkOrder] = useState<WorkOrder>({ ...emptyWorkOrder });
  const [reportGeneratedAt, setReportGeneratedAt] = useState("");
  const [printMode, setPrintMode] = useState<"workOrder" | "invoice">("workOrder");
  const [message, setMessage] = useState("Ready.");
  const [busy, setBusy] = useState(false);
  const [cloudRows, setCloudRows] = useState<CloudRow[]>([]);
  const [selectedCloudId, setSelectedCloudId] = useState("");
  const [pendingReportHandoffs, setPendingReportHandoffs] = useState<ReportWorkRequestHandoff[]>([]);
  const pdfImportRef = useRef<HTMLInputElement | null>(null);
  const pendingPhotoFilesRef = useRef<Record<string, File>>({});

  const totals = useMemo(() => {
    const materials = asNumber(workOrder.materials);
    const labor = asNumber(workOrder.labor);
    const tripFee = asNumber(workOrder.tripFee);
    const subtotal = materials + labor + tripFee;
    const tax = subtotal * (asNumber(workOrder.taxRate) / 100);
    return { materials, labor, tripFee, subtotal, tax, grand: subtotal + tax };
  }, [
    workOrder.materials,
    workOrder.labor,
    workOrder.tripFee,
    workOrder.taxRate,
  ]);

  function update<K extends keyof WorkOrder>(key: K, value: WorkOrder[K]) {
    setWorkOrder((current) => {
      const next = {
        ...current,
        [key]: value,
        updatedAt: new Date().toISOString(),
      };
      if (key === "beforePhotoData" || key === "afterPhotoData") saveSharedPhotoPackage(next);
      return next;
    });
  }

  async function addPhotos(section: "before" | "after", files: FileList | null) {
    if (!files?.length) return;
    setMessage(`Adding ${section} photos locally...`);

    try {
      const baseWorkOrder: WorkOrder = {
        ...workOrder,
        workOrderNumber: getPhotoStorageWorkOrderNumber(workOrder),
        updatedAt: new Date().toISOString(),
        createdAt: workOrder.createdAt || new Date().toISOString(),
      };

      const added: PhotoItem[] = Array.from(files).map((file) => {
        const id = `${section}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        pendingPhotoFilesRef.current[id] = file;

        return {
          id,
          name: file.name,
          dataUrl: previewUrl,
          caption: "",
          uploadedAt: new Date().toISOString(),
          section,
          mimeType: file.type || "image/jpeg",
          sizeBytes: file.size,
          uploadStatus: "local" as const,
        };
      });

      setWorkOrder((current) => {
        const next = {
          ...current,
          workOrderNumber: baseWorkOrder.workOrderNumber,
          beforePhotoData:
            section === "before" ? [...(current.beforePhotoData || []), ...added] : current.beforePhotoData || [],
          afterPhotoData:
            section === "after" ? [...(current.afterPhotoData || []), ...added] : current.afterPhotoData || [],
          updatedAt: new Date().toISOString(),
          createdAt: current.createdAt || new Date().toISOString(),
        };
        saveSharedPhotoPackage(next);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(next)));
        return next;
      });

      setMessage(`${added.length} ${section} photo(s) added locally. Use Save ${section === "before" ? "Before" : "After"} Photos to Cloud when ready.`);
    } catch (e) {
      setMessage(`Photo add failed: ${e instanceof Error ? e.message : "Could not read photos"}`);
    }
  }

  async function savePhotosToCloud(section: "before" | "after") {
    const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
    const photos = workOrder[key] || [];
    const pending = photos.filter((photo) => photo.uploadStatus !== "cloud" && photo.dataUrl);

    if (!pending.length) {
      setMessage(`No unsaved ${section} photos to upload.`);
      return;
    }

    setBusy(true);
    setMessage(`Saving ${pending.length} ${section} photo(s) to Supabase...`);

    const baseWorkOrder: WorkOrder = {
      ...workOrder,
      workOrderNumber: getPhotoStorageWorkOrderNumber(workOrder),
      updatedAt: new Date().toISOString(),
      createdAt: workOrder.createdAt || new Date().toISOString(),
    };

    try {
      const uploaded = await Promise.all(
        photos.map(async (photo) => {
          if (photo.uploadStatus === "cloud" || !photo.dataUrl) return photo;

          try {
            let file = pendingPhotoFilesRef.current[photo.id];
            if (!file && photo.dataUrl && (photo.dataUrl.startsWith("data:") || photo.dataUrl.startsWith("blob:"))) {
              const response = await fetch(photo.dataUrl);
              const blob = await response.blob();
              file = new File([blob], photo.name || `${photo.id}.jpg`, { type: photo.mimeType || blob.type || "image/jpeg" });
            }
            if (!file) throw new Error("Original local photo file is no longer available. Remove and re-add this photo.");
            const cloud = await uploadPhotoFileToSupabase(baseWorkOrder, section, photo.id, file);
            if (photo.dataUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.dataUrl);
            delete pendingPhotoFilesRef.current[photo.id];
            return {
              ...photo,
              ...cloud,
              dataUrl: "",
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
        ...workOrder,
        workOrderNumber: baseWorkOrder.workOrderNumber,
        [key]: uploaded,
        updatedAt: new Date().toISOString(),
        createdAt: workOrder.createdAt || new Date().toISOString(),
      } as WorkOrder;

      setWorkOrder(next);
      saveSharedPhotoPackage(next);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(next)));

      const cloudCount = uploaded.filter((photo) => photo.uploadStatus === "cloud").length;
      const failedCount = uploaded.filter((photo) => photo.uploadStatus === "failed").length;
      setMessage(
        failedCount
          ? `${cloudCount} ${section} photo(s) saved to Supabase. ${failedCount} failed and stayed local.`
          : `${cloudCount} ${section} photo(s) saved to Supabase and shared for Service Ticket.`,
      );
    } finally {
      setBusy(false);
    }
  }

  function updatePhotoCaption(section: "before" | "after", id: string, caption: string) {
    setWorkOrder((current) => {
      const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
      const next = {
        ...current,
        [key]: (current[key] || []).map((photo) =>
          photo.id === id ? { ...photo, caption } : photo,
        ),
        updatedAt: new Date().toISOString(),
      } as WorkOrder;
      saveSharedPhotoPackage(next);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function removePhoto(section: "before" | "after", id: string) {
    const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
    const photo = (workOrder[key] || []).find((item) => item.id === id);

    if (photo) {
      purgeDeletedPhotoReferences(photo);
      delete pendingPhotoFilesRef.current[photo.id];
    }

    const nextWorkOrder = {
      ...workOrder,
      [key]: (workOrder[key] || []).filter((item) => item.id !== id),
      updatedAt: new Date().toISOString(),
    } as WorkOrder;

    setWorkOrder(nextWorkOrder);
    saveSharedPhotoPackage(nextWorkOrder);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(nextWorkOrder)));

    if (photo?.storagePath) {
      try {
        await deletePhotoFileFromSupabase(photo);
        purgeDeletedPhotoReferences(photo);
        setMessage(`${section === "before" ? "Before" : "After"} photo removed from this work order, shared package, and Supabase.`);
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

    setMessage(`${section === "before" ? "Before" : "After"} photo removed from this work order and shared package.`);
  }

  function startNew() {
    setSelectedCloudId("");
    setWorkOrder({
      ...emptyWorkOrder,
      workOrderNumber: buildWorkOrderNumber(
        workOrder.propertyAddress,
        workOrder.city,
        workOrder.zip,
      ),
      scheduledDate: todayInput(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setMessage("New work order started.");
  }

  function localSave() {
    const current = { ...workOrder, updatedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(current)));
    saveSharedPhotoPackage(current);
    const archive = readQueue<WorkOrder>(ARCHIVE_KEY);
    const filtered = archive.filter(
      (x) => x.workOrderNumber !== current.workOrderNumber,
    );
    localStorage.setItem(
      ARCHIVE_KEY,
      JSON.stringify([sanitizeWorkOrderForStorage(current), ...filtered].slice(0, 100)),
    );
    setMessage("Saved locally.");
  }

  function localLoad() {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return setMessage("No local work order found.");
    try {
      const loaded = { ...emptyWorkOrder, ...JSON.parse(raw) } as WorkOrder;
      const withPhotos = { ...loaded, ...loadSharedPhotoPackage(loaded) } as WorkOrder;
      setWorkOrder(withPhotos);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(withPhotos)));
      saveSharedPhotoPackage(withPhotos);
      setMessage("Loaded local work order with shared Service Ticket photos.");
    } catch {
      setMessage("Local work order could not be loaded.");
    }
  }

  function toDbPayload(wo: WorkOrder) {
    const now = new Date().toISOString();
    const stableWorkOrder: WorkOrder = {
      ...wo,
      workOrderNumber:
        wo.workOrderNumber ||
        buildWorkOrderNumber(wo.propertyAddress, wo.city, wo.zip),
      updatedAt: now,
      createdAt: wo.createdAt || now,
    };

    return {
      work_order_number: stableWorkOrder.workOrderNumber,
      status: stableWorkOrder.status,
      priority: stableWorkOrder.priority,
      property_address: stableWorkOrder.propertyAddress,
      category: stableWorkOrder.category,
      grand_total: totals.grand,
      raw_json: sanitizeWorkOrderForStorage(stableWorkOrder),
      updated_at: now,
    };
  }

  function fromRow(row: CloudRow): WorkOrder {
    const base: WorkOrder = {
      ...emptyWorkOrder,
      ...(row.raw_json || {}),
      id: row.id,
      workOrderNumber:
        row.raw_json?.workOrderNumber || row.work_order_number || "",
      status: (row.raw_json?.status || row.status || "New") as Status,
      priority: (row.raw_json?.priority ||
        row.priority ||
        "Routine") as Priority,
      propertyAddress:
        row.raw_json?.propertyAddress || row.property_address || "",
      category: row.raw_json?.category || row.category || "General Maintenance",
    };
    const sharedPhotos = loadSharedPhotoPackage(base);
    return { ...base, ...sharedPhotos };
  }

  async function cloudSave() {
    setBusy(true);
    setMessage("Saving work order photos and work order to Supabase...");
    try {
      const supabase = await getSupabaseClient();

      let workingWorkOrder: WorkOrder = {
        ...workOrder,
        workOrderNumber: getPhotoStorageWorkOrderNumber(workOrder),
        updatedAt: new Date().toISOString(),
        createdAt: workOrder.createdAt || new Date().toISOString(),
      };

      const uploadPendingPhotosForSection = async (section: "before" | "after") => {
        const key = section === "before" ? "beforePhotoData" : "afterPhotoData";
        const photos = workingWorkOrder[key] || [];

        if (!photos.some((photo) => photo.uploadStatus !== "cloud" && photo.dataUrl)) return;

        const uploaded = await Promise.all(
          photos.map(async (photo) => {
            if (photo.uploadStatus === "cloud" || !photo.dataUrl) return photo;

            try {
              let file = pendingPhotoFilesRef.current[photo.id];
              if (!file && photo.dataUrl && (photo.dataUrl.startsWith("data:") || photo.dataUrl.startsWith("blob:"))) {
                const response = await fetch(photo.dataUrl);
                const blob = await response.blob();
                file = new File([blob], photo.name || `${photo.id}.jpg`, {
                  type: photo.mimeType || blob.type || "image/jpeg",
                });
              }
              if (!file) throw new Error("Original local photo file is no longer available. Remove and re-add this photo.");
              const cloud = await uploadPhotoFileToSupabase(workingWorkOrder, section, photo.id, file);
              if (photo.dataUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.dataUrl);
              delete pendingPhotoFilesRef.current[photo.id];
              return {
                ...photo,
                ...cloud,
                dataUrl: "",
                uploadStatus: "cloud" as const,
                uploadError: "",
              };
            } catch (error) {
              return {
                ...photo,
                uploadStatus: "failed" as const,
                uploadError: getErrorMessage(error),
              };
            }
          }),
        );

        workingWorkOrder = {
          ...workingWorkOrder,
          [key]: uploaded,
          updatedAt: new Date().toISOString(),
        } as WorkOrder;
      };

      await uploadPendingPhotosForSection("before");
      await uploadPendingPhotosForSection("after");

      setWorkOrder(workingWorkOrder);
      saveSharedPhotoPackage(workingWorkOrder);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(workingWorkOrder)));

      const payload = toDbPayload(sanitizeWorkOrderForStorage(workingWorkOrder));
      const currentCloudId = workOrder.id || selectedCloudId;
      let savedRow: CloudRow | null = null;

      async function insertOrUpdateByWorkOrderNumber() {
        const { data: existing, error: findError } = await supabase
          .from(TABLE_NAME)
          .select("id")
          .eq("work_order_number", payload.work_order_number)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (findError) throw new Error(getErrorMessage(findError));

        const existingId = Array.isArray(existing) && existing[0]?.id ? existing[0].id : "";

        if (existingId) {
          const { data: updatedExisting, error: updateExistingError } = await supabase
            .from(TABLE_NAME)
            .update(payload)
            .eq("id", existingId)
            .select("*")
            .maybeSingle();

          if (updateExistingError) throw new Error(getErrorMessage(updateExistingError));
          if (updatedExisting) return updatedExisting as CloudRow;
        }

        const { data: inserted, error: insertError } = await supabase
          .from(TABLE_NAME)
          .insert(payload)
          .select("*")
          .maybeSingle();

        if (insertError) throw new Error(getErrorMessage(insertError));
        if (!inserted) throw new Error("Supabase save returned no row after insert.");
        return inserted as CloudRow;
      }

      if (currentCloudId) {
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .update(payload)
          .eq("id", currentCloudId)
          .select("*")
          .maybeSingle();

        if (error) throw new Error(getErrorMessage(error));

        savedRow = data ? (data as CloudRow) : await insertOrUpdateByWorkOrderNumber();
      } else {
        savedRow = await insertOrUpdateByWorkOrderNumber();
      }

      if (!savedRow) throw new Error("Supabase save returned no work order row.");
      setWorkOrder(fromRow(savedRow));
      setSelectedCloudId(savedRow.id);

      const beforeCloud = (workingWorkOrder.beforePhotoData || []).filter((photo) => photo.uploadStatus === "cloud").length;
      const afterCloud = (workingWorkOrder.afterPhotoData || []).filter((photo) => photo.uploadStatus === "cloud").length;
      const failed = [...(workingWorkOrder.beforePhotoData || []), ...(workingWorkOrder.afterPhotoData || [])].filter((photo) => photo.uploadStatus === "failed").length;

      setMessage(
        failed
          ? `Cloud save complete. ${beforeCloud + afterCloud} photo(s) uploaded; ${failed} photo(s) failed and remain local.`
          : `Cloud save complete with ${beforeCloud + afterCloud} shared photo(s).`,
      );
      await cloudList(false);
    } catch (e) {
      setMessage(
        `Cloud save failed: ${getErrorMessage(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function cloudList(show = true) {
    setBusy(true);
    if (show) setMessage("Loading cloud work orders...");
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(
          "id, created_at, updated_at, work_order_number, status, priority, property_address, category, grand_total, raw_json",
        )
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setCloudRows((data || []) as CloudRow[]);
      if (show) setMessage("Cloud list loaded.");
    } catch (e) {
      setMessage(
        `Cloud load failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function cloudLoad(id: string) {
    if (!id) return;
    setBusy(true);
    setMessage("Loading selected cloud work order...");
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      setWorkOrder(fromRow(data as CloudRow));
      setSelectedCloudId(id);
      setMessage("Cloud work order loaded.");
    } catch (e) {
      setMessage(
        `Cloud load failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function cloudDelete() {
    const id = workOrder.id || selectedCloudId;
    if (!id) return setMessage("No cloud work order selected to delete.");
    if (!window.confirm("Delete this work order from cloud?")) return;
    setBusy(true);
    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
      if (error) throw error;
      startNew();
      await cloudList(false);
      setMessage("Cloud work order deleted.");
    } catch (e) {
      setMessage(
        `Cloud delete failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteCurrentWorkOrder() {
    const label = workOrder.workOrderNumber || workOrder.propertyAddress || "this work order";
    if (!window.confirm(`Delete ${label}? This will remove the local saved copy and delete the cloud record if one is selected.`)) return;

    setBusy(true);
    try {
      const cloudId = workOrder.id || selectedCloudId;

      if (cloudId) {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.from(TABLE_NAME).delete().eq("id", cloudId);
        if (error) throw error;
      }

      localStorage.removeItem(LOCAL_KEY);

      const archive = readQueue<WorkOrder>(ARCHIVE_KEY);
      const currentNumber = workOrder.workOrderNumber;
      const filtered = archive.filter(
        (item) => item.workOrderNumber !== currentNumber && item.id !== cloudId,
      );
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(filtered));

      setSelectedCloudId("");
      setWorkOrder({
        ...emptyWorkOrder,
        workOrderNumber: buildWorkOrderNumber(
        workOrder.propertyAddress,
        workOrder.city,
        workOrder.zip,
      ),
        scheduledDate: todayInput(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (cloudId) await cloudList(false);
      setMessage("Work order deleted and a new blank work order was started.");
    } catch (e) {
      setMessage(
        `Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function importPricingUpdate(showNoMatch = true) {
    try {
      const queue = readQueue<PricingReturnItem>(PRICING_RETURN_QUEUE_KEY);
      if (!queue.length) {
        if (showNoMatch) setMessage("No returned pricing found.");
        return;
      }
      const currentId = workOrder.id || workOrder.workOrderNumber;
      const match =
        queue.find(
          (item) =>
            (item.sourceId && item.sourceId === currentId) ||
            (item.workOrderNumber &&
              item.workOrderNumber === workOrder.workOrderNumber),
        ) || queue[0];

      if (!match) {
        if (showNoMatch) setMessage("No matching returned pricing found.");
        return;
      }

      setWorkOrder((current) => ({
        ...current,
        materials: asNumber(match.materialsTotal).toFixed(2),
        labor: asNumber(match.laborTotal).toFixed(2),
        tripFee: asNumber(match.tripFee).toFixed(2),
        taxRate: asNumber(match.taxRate || current.taxRate).toFixed(2),
        estimateStatus: match.estimateStatus || "Completed",
        estimateTotal: asNumber(match.estimateTotal).toFixed(2),
        pricingRecordId: match.pricingRecordId || "",
        pricingUpdatedAt: match.savedAt || new Date().toISOString(),
        pricingLineItemsJson: JSON.stringify(match.lineItems || []),
        updatedAt: new Date().toISOString(),
      }));

      const matchKey = match.sourceId || match.workOrderNumber;
      const filtered = queue.filter(
        (item) => (item.sourceId || item.workOrderNumber) !== matchKey,
      );
      localStorage.setItem(PRICING_RETURN_QUEUE_KEY, JSON.stringify(filtered));
      setMessage("Returned pricing imported into this work order.");
    } catch {
      setMessage("Could not import returned pricing.");
    }
  }


  function applyImportedIntake(text: string, sourceLabel: string) {
    const parsed = parseWorkOrderIntakeText(text, sourceLabel);
    const next: WorkOrder = {
      ...workOrder,
      ...parsed,
      workOrderNumber:
        workOrder.workOrderNumber ||
        buildWorkOrderNumber(
          parsed.propertyAddress || workOrder.propertyAddress,
          parsed.city || workOrder.city,
          parsed.zip || workOrder.zip,
        ),
      status: "New",
      createdAt: workOrder.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkOrder(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    saveSharedPhotoPackage(next);
    setMessage(`Imported ${sourceLabel} intake into this work order.`);
  }

  function importPdfOrOcr() {
    let imported = "";
    let importedKey = "";

    for (const key of OCR_IMPORT_KEYS) {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key) || "";
      if (raw) {
        imported = raw;
        importedKey = key;
        break;
      }
    }

    if (imported) {
      try {
        const parsed = JSON.parse(imported);
        const text =
          parsed.text ||
          parsed.rawText ||
          parsed.ocrText ||
          parsed.extractedText ||
          parsed.description ||
          JSON.stringify(parsed, null, 2);
        applyImportedIntake(String(text), `OCR/PDF reader key ${importedKey}`);
        return;
      } catch {
        applyImportedIntake(imported, `OCR/PDF reader key ${importedKey}`);
        return;
      }
    }

    pdfImportRef.current?.click();
  }

  function looksLikeRawPdfBinary(text: string) {
    const sample = text.slice(0, 2500);
    return (
      sample.includes("%PDF-") ||
      /\b(?:FlateDecode|ObjStm|endobj|xref|trailer|startxref)\b/i.test(sample) ||
      /\d+\s+\d+\s+obj/i.test(sample)
    );
  }

  async function loadPdfJsFromCdn(): Promise<any> {
    const existing = (window as any).pdfjsLib;
    if (existing?.getDocument) return existing;

    await new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-five-tools-pdfjs="true"]',
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("PDF reader script failed to load.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.dataset.fiveToolsPdfjs = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("PDF reader script failed to load."));
      document.head.appendChild(script);
    });

    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs?.getDocument) {
      throw new Error("PDF reader was not available after loading.");
    }

    pdfjs.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    return pdfjs;
  }

  async function extractTextFromPdfFile(file: File): Promise<string> {
    const pdfjs = await loadPdfJsFromCdn();
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const rawItems = (textContent.items || [])
        .map((item: any) => ({
          text: String(item?.str || "").trim(),
          x: Number(item?.transform?.[4] || 0),
          y: Number(item?.transform?.[5] || 0),
        }))
        .filter((item: { text: string; x: number; y: number }) => item.text);

      const rows: { y: number; items: { text: string; x: number; y: number }[] }[] = [];

      rawItems
        .sort((a: { y: number; x: number }, b: { y: number; x: number }) => b.y - a.y || a.x - b.x)
        .forEach((item: { text: string; x: number; y: number }) => {
          const row = rows.find((existing) => Math.abs(existing.y - item.y) <= 3);
          if (row) {
            row.items.push(item);
          } else {
            rows.push({ y: item.y, items: [item] });
          }
        });

      const lines = rows
        .sort((a, b) => b.y - a.y)
        .map((row) =>
          row.items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter(Boolean);

      pageTexts.push(lines.join("\n"));
    }

    return pageTexts
      .join("\n\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }


  async function handlePdfOrTextFile(file: File | null) {
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".pdf")) {
        setMessage(`Reading PDF text from ${file.name}...`);
        const extractedText = await extractTextFromPdfFile(file);

        if (!extractedText || extractedText.length < 20 || looksLikeRawPdfBinary(extractedText)) {
          setWorkOrder((current) => ({
            ...current,
            internalNotes: `${current.internalNotes ? `${current.internalNotes}

` : ""}PDF selected for intake: ${file.name}. The built-in PDF reader could not extract usable text. This PDF may be scanned/image-only and will need OCR.`,
            updatedAt: new Date().toISOString(),
          }));
          setMessage(
            `PDF text was not readable from ${file.name}. If this is a scanned PDF, run OCR first.`,
          );
          return;
        }

        applyImportedIntake(extractedText, `PDF file ${file.name}`);
        return;
      }

      const text = await file.text();
      applyImportedIntake(text, `file ${file.name}`);
    } catch (e) {
      setMessage(
        `Import failed: ${e instanceof Error ? e.message : "Could not read file"}`,
      );
    } finally {
      if (pdfImportRef.current) pdfImportRef.current.value = "";
    }
  }


  function pushServiceTicket() {
    const serviceTicket = {
      sourceId: workOrder.id || workOrder.workOrderNumber,
      source: "Work Order Engine",
      workOrderNumber: workOrder.workOrderNumber,
      status: workOrder.status,
      priority: workOrder.priority,
      propertyAddress: workOrder.propertyAddress,
      city: workOrder.city,
      state: workOrder.state,
      zip: workOrder.zip,
      unit: workOrder.unit,
      tenantName: workOrder.requestorName,
      requestorName: workOrder.requestorName,
      requestorPhone: workOrder.requestorPhone,
      requestorEmail: workOrder.requestorEmail,
      tenantPhone: workOrder.requestorPhone,
      tenantEmail: workOrder.requestorEmail,
      category: workOrder.category,
      issueDescription: workOrder.issueDescription,
      scopeOfWork: workOrder.scopeOfWork,
      accessNotes: workOrder.accessNotes,
      vendorName: workOrder.vendorName,
      vendorPhone: workOrder.vendorPhone,
      vendorEmail: workOrder.vendorEmail,
      scheduledDate: workOrder.scheduledDate,
      scheduledTime: workOrder.scheduledTime,
      assignedTo: workOrder.assignedTo,
      billTo: workOrder.billTo,
      tenantCharge: workOrder.tenantCharge,
      tenantChargeNotes: workOrder.tenantChargeNotes,
      materials: totals.materials,
      labor: totals.labor,
      tripFee: totals.tripFee,
      tripFeeLabel: workOrder.tripFeeLabel || "Trip Fee",
      taxRate: asNumber(workOrder.taxRate),
      taxAmount: totals.tax,
      total: totals.grand,
      beforePhotos: workOrder.beforePhotos,
      afterPhotos: workOrder.afterPhotos,
      beforePhotoData: workOrder.beforePhotoData || [],
      afterPhotoData: workOrder.afterPhotoData || [],
      sharedPhotoPackageKey: getPhotoPackageKey(workOrder.workOrderNumber, workOrder.id),
      sharedPhotoStorageKey: SHARED_PHOTO_PACKAGE_KEY,
      supabasePhotoBucket: PHOTO_BUCKET_NAME,
      rawWorkOrder: workOrder,
      createdAt: new Date().toISOString(),
      route: "/service-ticket",
    };

    writeQueue(SERVICE_TICKET_QUEUE_KEY, serviceTicket);
    localStorage.setItem(SERVICE_TICKET_DRAFT_KEY, JSON.stringify(serviceTicket));
    saveSharedPhotoPackage(workOrder);

    setWorkOrder((current) => ({
      ...current,
      pushedToServiceTicket: true,
      updatedAt: new Date().toISOString(),
    }));

    setMessage("Pushed to Service Ticket queue.");
  }

  function pushOperations() {
    writeQueue(OPS_QUEUE_KEY, {
      sourceId: workOrder.id || workOrder.workOrderNumber,
      source: "Work Order Engine",
      workOrderNumber: workOrder.workOrderNumber,
      title: `${workOrder.priority} Work Order - ${workOrder.category}`,
      status: workOrder.status,
      priority: workOrder.priority,
      propertyAddress: workOrder.propertyAddress,
      description: workOrder.issueDescription,
      assignedTo: workOrder.assignedTo || workOrder.vendorName,
      dueDate: workOrder.scheduledDate,
      route: "/work-order-engine",
      createdAt: new Date().toISOString(),
    });
    update("pushedToOperations", true);
    setMessage("Pushed to Operations Hub queue.");
  }

  function pushScheduler() {
    writeQueue(SCHEDULER_QUEUE_KEY, {
      sourceId: workOrder.id || workOrder.workOrderNumber,
      source: "Work Order Engine",
      workOrderNumber: workOrder.workOrderNumber,
      propertyAddress: workOrder.propertyAddress,
      vendorName: workOrder.vendorName,
      assignedTo: workOrder.assignedTo,
      scheduledDate: workOrder.scheduledDate || todayInput(),
      scheduledTime: workOrder.scheduledTime,
      description: workOrder.scopeOfWork || workOrder.issueDescription,
      status: "Scheduled",
      createdAt: new Date().toISOString(),
    });
    setWorkOrder((current) => ({
      ...current,
      status: "Scheduled",
      pushedToScheduler: true,
      updatedAt: new Date().toISOString(),
    }));
    setMessage("Pushed to Project Scheduler queue.");
  }

  function pushTracker() {
    writeQueue(TRACKER_QUEUE_KEY, {
      sourceId: workOrder.id || workOrder.workOrderNumber,
      source: "Work Order Engine",
      workOrderNumber: workOrder.workOrderNumber,
      title: `${workOrder.propertyAddress} - ${workOrder.category}`,
      propertyAddress: workOrder.propertyAddress,
      status: workOrder.status === "New" ? "In Progress" : workOrder.status,
      priority: workOrder.priority,
      scopeOfWork: workOrder.scopeOfWork,
      vendorName: workOrder.vendorName,
      assignedTo: workOrder.assignedTo,
      cost: totals.grand,
      createdAt: new Date().toISOString(),
    });
    setWorkOrder((current) => ({
      ...current,
      pushedToTracker: true,
      updatedAt: new Date().toISOString(),
    }));
    setMessage("Pushed to Project Tracker queue.");
  }

  function pushEstimator() {
    writeQueue(ESTIMATOR_QUEUE_KEY, {
      sourceId: workOrder.id || workOrder.workOrderNumber,
      source: "Work Order Engine",
      workOrderNumber: workOrder.workOrderNumber,
      status: workOrder.status,
      propertyAddress: workOrder.propertyAddress,
      city: workOrder.city,
      state: workOrder.state,
      zip: workOrder.zip,
      unit: workOrder.unit,
      requestorName: workOrder.requestorName,
      requestorPhone: workOrder.requestorPhone,
      requestorEmail: workOrder.requestorEmail,
      category: workOrder.category,
      issueCategory: workOrder.category,
      issueDescription: workOrder.issueDescription,
      problemDescription: workOrder.issueDescription,
      scopeOfWork: workOrder.scopeOfWork,
      description: workOrder.scopeOfWork || workOrder.issueDescription,
      accessNotes: workOrder.accessNotes,
      maintenanceLimit: workOrder.maintenanceLimit,
      vendorName: workOrder.vendorName,
      vendorAssigned: workOrder.vendorName,
      scheduledDate: workOrder.scheduledDate,
      scheduledTime: workOrder.scheduledTime,
      assignedTo: workOrder.assignedTo,
      billTo: workOrder.billTo,
      tenantCharge: workOrder.tenantCharge,
      tenantChargeNotes: workOrder.tenantChargeNotes,
      approvalRequired: workOrder.approvalRequired,
      approvalStatus: workOrder.approvalStatus,
      approvalNotes: workOrder.approvalNotes,
      materials: totals.materials,
      labor: totals.labor,
      tripFee: totals.tripFee,
      tripFeeLabel: workOrder.tripFeeLabel || "Trip Fee",
      taxRate: asNumber(workOrder.taxRate),
      taxAmount: totals.tax,
      total: totals.grand,
      beforePhotos: workOrder.beforePhotos,
      afterPhotos: workOrder.afterPhotos,
      beforePhotoData: workOrder.beforePhotoData || [],
      afterPhotoData: workOrder.afterPhotoData || [],
      sharedPhotoPackageKey: getPhotoPackageKey(workOrder.workOrderNumber, workOrder.id),
      sharedPhotoStorageKey: SHARED_PHOTO_PACKAGE_KEY,
      supabasePhotoBucket: PHOTO_BUCKET_NAME,
      rawWorkOrder: workOrder,
      createdAt: new Date().toISOString(),
    });
    update("pushedToEstimator", true);
    setMessage("Pushed to Work Order Pricing queue.");
  }

  function runWorkflow() {
    pushOperations();
    pushServiceTicket();
    if (workOrder.approvalRequired && workOrder.approvalStatus !== "Approved") {
      setWorkOrder((current) => ({
        ...current,
        status: "Needs Approval",
        pushedToOperations: true,
        updatedAt: new Date().toISOString(),
      }));
      setMessage(
        "Workflow started: sent to Operations Hub, Service Ticket, and marked Needs Approval.",
      );
      return;
    }
    if (workOrder.scheduledDate || workOrder.vendorName || workOrder.assignedTo)
      pushScheduler();
    pushTracker();
    if (totals.subtotal > 0 || workOrder.scopeOfWork) pushEstimator();
    setMessage(
      "Full workflow pushed to Service Ticket, Operations, Scheduler, Tracker, and Work Order Pricing queues.",
    );
  }

  function printReport() {
    setPrintMode("workOrder");
    setReportGeneratedAt(new Date().toLocaleString());
    setTimeout(() => window.print(), 50);
  }

  function generateInvoice() {
    const invoiceNumber = workOrder.invoiceNumber || buildInvoiceNumber(workOrder.workOrderNumber);
    setWorkOrder((current) => ({
      ...current,
      invoiceNumber,
      invoiceStatus: current.invoiceStatus && current.invoiceStatus !== "Not Created" ? current.invoiceStatus : "Draft",
      invoiceDate: current.invoiceDate || todayInput(),
      invoiceDueDate: current.invoiceDueDate || addDaysInput(15),
      invoiceRecipientName: current.invoiceRecipientName || (current.billTo === "Tenant" ? current.requestorName : "Owner / Client"),
      invoiceRecipientEmail: current.invoiceRecipientEmail || (current.billTo === "Tenant" ? current.requestorEmail : ""),
      invoiceNotes:
        current.invoiceNotes ||
        "Thank you for your business. Payment is due by the invoice due date unless other arrangements have been approved.",
      updatedAt: new Date().toISOString(),
    }));
    setMessage(`Invoice ${invoiceNumber} prepared.`);
  }

  function markInvoicePaid() {
    setWorkOrder((current) => ({
      ...current,
      invoiceStatus: "Paid",
      invoicePaidDate: current.invoicePaidDate || todayInput(),
      updatedAt: new Date().toISOString(),
    }));
    setMessage("Invoice marked paid.");
  }

  function printInvoice() {
    if (!workOrder.invoiceNumber) generateInvoice();
    setPrintMode("invoice");
    setReportGeneratedAt(new Date().toLocaleString());
    setTimeout(() => window.print(), 80);
  }

  function exportInvoiceJson() {
    const invoicePayload = {
      invoiceNumber: workOrder.invoiceNumber || buildInvoiceNumber(workOrder.workOrderNumber),
      invoiceStatus: workOrder.invoiceStatus || "Draft",
      invoiceDate: workOrder.invoiceDate || todayInput(),
      invoiceDueDate: workOrder.invoiceDueDate || addDaysInput(15),
      workOrderNumber: workOrder.workOrderNumber,
      billTo: workOrder.billTo,
      recipientName: workOrder.invoiceRecipientName,
      recipientEmail: workOrder.invoiceRecipientEmail,
      propertyAddress: workOrder.propertyAddress,
      unit: workOrder.unit,
      city: workOrder.city,
      state: workOrder.state,
      zip: workOrder.zip,
      category: workOrder.category,
      issueDescription: workOrder.issueDescription,
      lineItems: [
        { description: "Materials", amount: totals.materials },
        { description: "Labor", amount: totals.labor },
        { description: workOrder.tripFeeLabel || "Trip Fee", amount: totals.tripFee },
        { description: `Sales Tax (${asNumber(workOrder.taxRate).toFixed(2)}%)`, amount: totals.tax },
      ].filter((line) => line.amount > 0),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.grand,
      notes: workOrder.invoiceNotes,
    };
    const blob = new Blob([JSON.stringify(invoicePayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoicePayload.invoiceNumber || "invoice"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...workOrder, totals }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workOrder.workOrderNumber || "work-order"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  function refreshReportHandoffs() {
    const handoffs = readReportWorkRequestHandoffs();
    setPendingReportHandoffs(handoffs);
    setMessage(
      handoffs.length
        ? `Loaded ${handoffs.length} pending report handoff${handoffs.length === 1 ? "" : "s"}.`
        : "No pending report handoffs found."
    );
  }

  function rejectReportHandoff(handoffId: string) {
    const next = readReportWorkRequestHandoffs().filter((item) => item.id !== handoffId);
    writeReportWorkRequestHandoffs(next);
    setPendingReportHandoffs(next);
    setMessage("Report handoff rejected and removed from the Work Order queue.");
  }

  function acceptReportHandoff(handoff: ReportWorkRequestHandoff) {
    const nextWorkOrder = buildWorkOrderFromReportHandoff(handoff);
    const nextQueue = readReportWorkRequestHandoffs().filter((item) => item.id !== handoff.id);

    setSelectedCloudId("");
    setWorkOrder(nextWorkOrder);
    writeReportWorkRequestHandoffs(nextQueue);
    setPendingReportHandoffs(nextQueue);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(nextWorkOrder)));
    saveSharedPhotoPackage(nextWorkOrder);

    setMessage(
      `Report handoff accepted. Work order ${nextWorkOrder.workOrderNumber} is ready to review and save.`
    );
  }

  useEffect(() => {
    setReportGeneratedAt(new Date().toLocaleString());
    setPendingReportHandoffs(readReportWorkRequestHandoffs());

    const handoffKeys = [
      "five-tools-work-order-draft",
      "workOrderDraft",
      "work_order_draft",
    ];

    let secretaryDraft = "";
    let secretaryDraftKey = "";

    for (const key of handoffKeys) {
      secretaryDraft =
        window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || "";

      if (secretaryDraft) {
        secretaryDraftKey = key;
        break;
      }
    }

    if (!secretaryDraft) {
      const params = new URLSearchParams(window.location.search);
      const hasSecretaryParams =
        params.get("source") === "secretary" || params.get("draftKey");

      if (hasSecretaryParams) {
        const paramsDraft = {
          source: "secretary",
          secretaryId: params.get("secretaryId") || "",
          title: params.get("title") || "",
          details: params.get("details") || params.get("title") || "",
          priority: params.get("priority") || "Routine",
          propertyAddress: params.get("address") || "",
          contactName: params.get("contact") || "",
        };
        secretaryDraft = JSON.stringify(paramsDraft);
        secretaryDraftKey = "url-params";
      }
    }

    if (secretaryDraft) {
      try {
        const parsed = JSON.parse(secretaryDraft) as Record<string, unknown>;
        const imported = buildWorkOrderFromSecretaryDraft(parsed);

        setSelectedCloudId("");
        setWorkOrder(imported);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(imported));

        for (const key of handoffKeys) {
          window.localStorage.removeItem(key);
          window.sessionStorage.removeItem(key);
        }

        setMessage(
          `Virtual Secretary draft imported into Work Order Engine${
            secretaryDraftKey ? ` from ${secretaryDraftKey}.` : "."
          }`,
        );
        return;
      } catch (error) {
        console.error("Failed to import Virtual Secretary draft", error);
        setMessage("Virtual Secretary draft could not be imported.");
        for (const key of handoffKeys) {
          window.localStorage.removeItem(key);
          window.sessionStorage.removeItem(key);
        }
      }
    }

    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const loaded = {
          ...emptyWorkOrder,
          ...parsed,
          workOrderNumber: parsed.workOrderNumber || buildWorkOrderNumber("", "", ""),
          scheduledDate: parsed.scheduledDate || todayInput(),
        } as WorkOrder;
        const withPhotos = { ...loaded, ...loadSharedPhotoPackage(loaded) } as WorkOrder;
        setWorkOrder(withPhotos);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(sanitizeWorkOrderForStorage(withPhotos)));
        saveSharedPhotoPackage(withPhotos);
        return;
      } catch {}
    }
    setWorkOrder({
      ...emptyWorkOrder,
      workOrderNumber: buildWorkOrderNumber(
        workOrder.propertyAddress,
        workOrder.city,
        workOrder.zip,
      ),
      scheduledDate: todayInput(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#120a05] text-[#fff5df] print:bg-[#241509]/90">
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.45in;
          }
          html,
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          main {
            background: white !important;
          }
          .print-report {
            color: #1f1f1f !important;
            font-size: 11px;
            line-height: 1.45;
          }
          .print-card,
          .print-section,
          .print-summary {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
          }
          .print-section-title {
            background: #3f2a1b !important;
            color: #fff8f0 !important;
          }
          .print-muted {
            color: #5f4a39 !important;
          }
          .print-sheet {
            max-width: 7.6in;
            margin: 0 auto;
          }
          .print-logo {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print-box-title {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: #9c6b2f !important;
          }
          .print-fact {
            border-right: 1px solid #2f1f14;
            padding: 8px 12px;
            background: #fffaf3 !important;
          }
          .print-fact:last-child {
            border-right: none;
          }
          .print-fact span {
            display: block;
            color: #5f4a39 !important;
            font-weight: 700;
          }
          .print-fact strong {
            display: block;
            margin-top: 2px;
            color: #2f1f14 !important;
            font-weight: 900;
          }
          .print-page-break-after {
            break-after: page;
            page-break-after: always;
          }
          .signature-line {
            min-height: 48px;
            border-bottom: 1px solid #2f1f14;
            position: relative;
          }
          .signature-line span {
            position: absolute;
            left: 0;
            bottom: -18px;
            font-weight: 700;
            color: #5f4a39 !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(90deg,#3b2412_0%,#6b4420_12%,#2c190b_24%,#805427_36%,#3d2613_48%,#70481f_60%,#2b180b_72%,#8a5a28_84%,#2f1b0d_100%)] no-print" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,224,142,0.26),transparent_42%),radial-gradient(circle_at_center,rgba(0,0,0,0.15),rgba(0,0,0,0.82)_70%)] no-print" />

      <header className="border-b border-[#d4a640]/40 bg-[#160c06]/90 px-6 py-5 shadow-2xl backdrop-blur no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/5tools-logo.png"
              alt="5 Tools"
              className="h-20 w-auto"
            />
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[#fff5df]">
                Work Order Engine
              </h1>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-[#d4a640]">
                Repair & Maintenance Workspace
              </p>
            </div>
          </div>

          <div className="hidden gap-10 text-right text-sm font-bold text-[#e6d2aa] md:flex">
            <div>
              <p>253.584.8200</p>
              <p className="text-xs uppercase text-[#c9b58e]">Call Us</p>
            </div>
            <div>
              <p>Tacoma, Washington</p>
              <p className="text-xs uppercase text-[#c9b58e]">Service Area</p>
            </div>
          </div>
        </div>

        <nav className="mt-5 rounded-2xl border border-[#d4a640]/30 bg-[#0f0804]/75 shadow-inner">
          <div className="mx-auto flex max-w-7xl flex-wrap px-8">
            {navLinks.map((link) => {
              const active = link.href === "/work-order-engine";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`border-b-4 px-5 py-4 text-sm font-bold uppercase tracking-wide transition ${
                    active
                      ? "border-[#d4a66a] bg-[#4c2d12] text-white"
                      : "border-transparent text-[#f5ede2] hover:border-[#d4a66a] hover:bg-[#4c2d12]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-[#d4a640]/30 no-print">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#8b5e3c_0%,#9b6b45_8%,#7c5235_16%,#a7794f_24%,#7a5237_32%,#966845_40%,#7d5436_48%,#a1714b_56%,#815638_64%,#9c6d48_72%,#785033_80%,#a3734c_88%,#6d482d_100%)] opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-7 shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#d4a66a]">
              5 Tools Operations
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-[#fff8f0]">
              Work Order Engine
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#f3e8d8]">
              Intake → approval → scheduler → tracker → estimator → operations
              hub.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-4 shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur">
            <Link
              href="/"
              className="border border-[#7c5725] bg-[#120a05]/70 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#2f1b0d]"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/work-order-pricing"
              className="border border-[#d4a640] bg-[#120a05]/70 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#2f1b0d]"
            >
              Work Order Pricing
            </Link>
            <button
              onClick={startNew}
              className="border border-[#7c5725] bg-[#241509]/90 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70"
            >
              New
            </button>
            <button
              onClick={printReport}
              className="bg-[#8a5a18] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#b98525]"
            >
              Print / PDF
            </button>
            <button
              onClick={printInvoice}
              className="bg-[#160c06]/90 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#4c2d12]"
            >
              Print Invoice
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-8 print:max-w-none print:p-0">
        <section className="mb-5 rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur no-print">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold">Status: {message}</p>
              <p className="mt-1 text-xs text-[#e6d2aa]">
                Queues written to localStorage for Operations Hub, Project
                Scheduler, Project Tracker, Service Ticket, and Work Order Pricing import.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={localSave}
                className="rounded-xl border border-[#7c5725] bg-[#241509]/90 px-3 py-2 text-sm font-semibold text-[#fff5df] hover:bg-[#120a05]/70"
              >
                Local Save
              </button>
              <button
                onClick={localLoad}
                className="rounded-xl border border-[#7c5725] bg-[#241509]/90 px-3 py-2 text-sm font-semibold text-[#fff5df] hover:bg-[#120a05]/70"
              >
                Local Load
              </button>
              <button
                onClick={cloudSave}
                disabled={busy}
                className="rounded-xl bg-[#8a5a18] px-3 py-2 text-sm font-bold text-white hover:bg-[#b98525] disabled:opacity-50"
              >
                Cloud Save
              </button>
              <button
                onClick={() => cloudList(true)}
                disabled={busy}
                className="rounded-xl border border-[#d4a640] bg-[#120a05]/70 px-3 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70 disabled:opacity-50"
              >
                Cloud List
              </button>
              <button
                onClick={cloudDelete}
                disabled={busy}
                className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                Delete Cloud
              </button>
              <button
                onClick={deleteCurrentWorkOrder}
                disabled={busy}
                className="rounded-xl border border-red-500 bg-[#241509]/90 px-3 py-2 text-sm font-black text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                Delete Work Order
              </button>
              <button
                onClick={() => importPricingUpdate(true)}
                className="rounded-xl border border-[#d4a640] bg-[#120a05]/70 px-3 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70"
              >
                Import Pricing
              </button>
              <button
                onClick={exportJson}
                className="rounded-xl border border-[#7c5725] bg-[#241509]/90 px-3 py-2 text-sm font-semibold text-[#fff5df] hover:bg-[#120a05]/70"
              >
                Export JSON
              </button>
              <button
                onClick={generateInvoice}
                className="rounded-xl border border-[#7c5725] bg-[#241509]/90 px-3 py-2 text-sm font-black text-[#fff5df] hover:bg-[#120a05]/70"
              >
                Create Invoice
              </button>
              <button
                onClick={printInvoice}
                className="rounded-xl bg-[#160c06]/90 px-3 py-2 text-sm font-black text-white hover:bg-[#4c2d12]"
              >
                Print Invoice
              </button>
            </div>
          </div>
          {cloudRows.length > 0 && (
            <div className="mt-4">
              <Field label="Saved Cloud Work Orders">
                <select
                  value={selectedCloudId}
                  onChange={(e) => {
                    setSelectedCloudId(e.target.value);
                    cloudLoad(e.target.value);
                  }}
                  className="w-full rounded-2xl border border-[#7c5725] bg-[#120a05]/70 px-3 py-2.5 text-[#fff5df] outline-none focus:border-[#d4a640] focus:bg-[#241509]/90 focus:ring-2 focus:ring-[#b57a32]/20"
                >
                  <option value="">Select Saved Work Order</option>

                  {cloudRows.map((row) => {
                    const raw = row.raw_json;
                    const property =
                      raw?.propertyAddress ||
                      row.property_address ||
                      "Unknown Property";
                    const unit = raw?.unit ? ` #${raw.unit}` : "";
                    const wo =
                      raw?.workOrderNumber ||
                      row.work_order_number ||
                      row.id.slice(0, 8);
                    const category = raw?.category || row.category || "Work Order";
                    const status = raw?.status || row.status || "Status Unknown";

                    return (
                      <option key={row.id} value={row.id}>
                        {property}
                        {unit} — {wo} — {category} — {status}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>
          )}
        </section>

        <section className="mb-5 rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur no-print">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4a640]">
                Pending Report Handoffs
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#fff5df]">
                Reports Ready for Work Orders
              </h2>
              <p className="mt-1 text-sm text-[#e6d2aa]">
                Items flagged in Reports appear here. Accept one to convert it into the current Work Order form.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshReportHandoffs}
              className="rounded-xl border border-[#d4a640] bg-[#120a05]/70 px-4 py-2 text-sm font-black text-[#fff5df] hover:bg-[#2f1b0d]"
            >
              Refresh Handoffs
            </button>
          </div>

          {pendingReportHandoffs.length ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {pendingReportHandoffs.map((handoff) => (
                <div
                  key={handoff.id}
                  className="rounded-2xl border border-[#7c5725] bg-[#241509]/90 p-4 shadow-inner"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-[#fff5df]">
                        {handoff.title || handoff.component || "Report Handoff"}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-[#e6d2aa]">
                        {handoff.propertyAddress || handoff.propertyName || "No property listed"}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#d4a640]">
                        {handoff.areaName || "Area not listed"} · {handoff.priority || "Priority not set"}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#d4a640]/70 bg-[#120a05]/70 px-3 py-1 text-xs font-black uppercase tracking-wide text-[#fff5df]">
                      {handoff.recommendedAction || "Flagged"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#7c5725] bg-[#120a05]/60 p-3 text-sm leading-6 text-[#f3e8d8]">
                    <p>
                      <span className="font-black text-[#d4a640]">Component:</span>{" "}
                      {handoff.component || "Not listed"}
                    </p>
                    <p>
                      <span className="font-black text-[#d4a640]">Rating:</span>{" "}
                      {handoff.rating || "Not listed"}
                    </p>
                    <p>
                      <span className="font-black text-[#d4a640]">Skill:</span>{" "}
                      {handoff.skillCategory || "General Maintenance"}
                    </p>
                    {handoff.notes ? (
                      <p className="mt-2 whitespace-pre-wrap">
                        <span className="font-black text-[#d4a640]">Notes:</span> {handoff.notes}
                      </p>
                    ) : null}
                    {handoff.photoRefs?.length ? (
                      <p className="mt-2 text-xs font-bold text-[#e6d2aa]">
                        {handoff.photoRefs.length} issue photo reference{handoff.photoRefs.length === 1 ? "" : "s"} attached in notes.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => acceptReportHandoff(handoff)}
                      className="rounded-xl bg-[#8a5a18] px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-[#b98525]"
                    >
                      Accept → Create Work Order
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectReportHandoff(handoff.id)}
                      className="rounded-xl border border-red-500 bg-[#241509]/90 px-4 py-2 text-sm font-black text-red-200 hover:bg-red-950/50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#7c5725] bg-[#241509]/70 p-5 text-sm font-semibold text-[#e6d2aa]">
              No pending report handoffs. Create one from Reports by setting an item to Repair Recommended, Vendor Needed, or Immediate Attention, then click Create Work Request.
            </div>
          )}
        </section>

        <div className="no-print space-y-6">
          <section className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.8fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d4a640]">
                  Current Work Order
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#fff5df]">
                  {workOrder.workOrderNumber || "New Work Order"}
                </h2>
                <p className="mt-1 truncate text-sm text-[#e6d2aa]">
                  {workOrder.propertyAddress || "No property selected yet"}
                </p>
              </div>

              <div className="rounded-md border border-[#7c5725] bg-[#241509]/90 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#e6d2aa]">
                  Status / Priority
                </p>
                <p className="mt-2 text-lg font-black text-[#fff5df]">
                  {workOrder.status}
                </p>
                <p className="text-sm font-semibold text-[#d4a640]">
                  {workOrder.priority}
                </p>
              </div>

              <div className="rounded-md border border-[#7c5725] bg-[#241509]/90 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#e6d2aa]">
                  Category
                </p>
                <p className="mt-2 text-lg font-black text-[#fff5df]">
                  {workOrder.category}
                </p>
                <p className="text-sm text-[#e6d2aa]">
                  Source: {workOrder.source}
                </p>
              </div>

              <div className="rounded-md border border-[#7c5725] bg-[#241509]/90 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#e6d2aa]">
                  Current Total
                </p>
                <p className="mt-2 text-2xl font-black text-[#fff5df]">
                  {money(totals.grand)}
                </p>
                <p className="text-sm text-[#e6d2aa]">Tax included</p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
              <div className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                <h2 className="text-lg font-black text-[#fff5df]">Workflow</h2>
                <div className="mt-4 space-y-2 text-sm">
                  {[
                    [
                      "1",
                      "Intake",
                      workOrder.issueDescription ? "Started" : "Needed",
                    ],
                    ["2", "Scope", workOrder.scopeOfWork ? "Ready" : "Needed"],
                    ["3", "Approval", workOrder.approvalStatus],
                    ["4", "Schedule", workOrder.scheduledDate ? "Set" : "Open"],
                    ["5", "Cost", totals.grand > 0 ? "Priced" : "Open"],
                    [
                      "6",
                      "Close-Out",
                      workOrder.completionNotes ? "Notes" : "Open",
                    ],
                  ].map(([step, label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-md border border-[#7c5725] bg-[#241509]/90 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#160c06]/90 text-xs font-black text-white">
                          {step}
                        </span>
                        <span className="font-bold text-[#fff5df]">
                          {label}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#d4a640]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                <h2 className="text-lg font-black text-[#fff5df]">
                  Route Work
                </h2>
                <div className="mt-4 grid gap-2">
                  <input
                    ref={pdfImportRef}
                    type="file"
                    accept=".pdf,.txt,.json,.csv"
                    className="hidden"
                    onChange={(e) => handlePdfOrTextFile(e.target.files?.[0] || null)}
                  />
                  <button
                    onClick={importPdfOrOcr}
                    className="rounded-md border border-[#d4a640] bg-[#241509]/90 px-4 py-2 text-sm font-black text-[#fff5df] hover:bg-[#120a05]/70"
                  >
                    Import PDF / OCR
                  </button>
                  <button
                    onClick={pushServiceTicket}
                    className="rounded-md border border-[#d4a640] bg-[#241509]/90 px-4 py-2 text-sm font-black text-[#fff5df] hover:bg-[#120a05]/70"
                  >
                    Push Service Ticket
                  </button>
                  <button
                    onClick={runWorkflow}
                    className="rounded-md bg-[#8a5a18] px-4 py-3 text-sm font-black text-white hover:bg-[#b98525]"
                  >
                    Run Full Workflow
                  </button>
                  <button
                    onClick={pushOperations}
                    className="rounded-md border border-[#7c5725] bg-[#241509]/90 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70"
                  >
                    Push Operations Hub
                  </button>
                  <button
                    onClick={pushScheduler}
                    className="rounded-md border border-[#7c5725] bg-[#241509]/90 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70"
                  >
                    Push Scheduler
                  </button>
                  <button
                    onClick={pushTracker}
                    className="rounded-md border border-[#7c5725] bg-[#241509]/90 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70"
                  >
                    Push Tracker
                  </button>
                  <button
                    onClick={pushEstimator}
                    className="rounded-md border border-[#7c5725] bg-[#241509]/90 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70"
                  >
                    Push Pricing
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                <h2 className="text-lg font-black text-[#fff5df]">
                  Cost Summary
                </h2>
                <div className="mt-4 rounded-md border border-[#7c5725] bg-[#241509]/90 p-4">
                  <div className="flex justify-between text-sm">
                    <span>Estimate Status</span>
                    <strong>{workOrder.estimateStatus || "Not Started"}</strong>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span>Estimate Total</span>
                    <strong>{money(asNumber(workOrder.estimateTotal))}</strong>
                  </div>
                  {workOrder.pricingRecordId ? (
                    <div className="mt-2 text-xs text-[#e6d2aa]">
                      Pricing Record: {workOrder.pricingRecordId}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Materials</span>
                    <strong>{money(totals.materials)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Labor</span>
                    <strong>{money(totals.labor)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{workOrder.tripFeeLabel || "Trip Fee"}</span>
                    <strong>{money(totals.tripFee)}</strong>
                  </div>
                  <div className="flex justify-between border-t border-[#7c5725] pt-2">
                    <span>Subtotal</span>
                    <strong>{money(totals.subtotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <strong>{money(totals.tax)}</strong>
                  </div>
                  <div className="mt-3 flex justify-between rounded-md bg-[#160c06]/90 px-3 py-3 text-base text-white">
                    <span className="font-black">Total</span>
                    <strong>{money(totals.grand)}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                <h2 className="text-lg font-black text-[#fff5df]">
                  Routing Flags
                </h2>
                <div className="mt-4 space-y-2 text-sm">
                  {[
                    ["Operations", workOrder.pushedToOperations],
                    ["Service Ticket", workOrder.pushedToServiceTicket],
                    ["Scheduler", workOrder.pushedToScheduler],
                    ["Tracker", workOrder.pushedToTracker],
                    ["Work Order Pricing", workOrder.pushedToEstimator],
                  ].map(([label, sent]) => (
                    <div
                      key={String(label)}
                      className="flex justify-between rounded-md border border-[#7c5725] bg-[#241509]/90 px-3 py-2"
                    >
                      <span>{label}</span>
                      <strong
                        className={sent ? "text-green-700" : "text-[#d4a640]"}
                      >
                        {sent ? "Sent" : "Not Sent"}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                <h2 className="text-lg font-black text-[#fff5df]">
                  Print / Export
                </h2>
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={printReport}
                    className="rounded-md bg-[#8a5a18] px-4 py-3 text-sm font-black text-white hover:bg-[#b98525]"
                  >
                    Print Professional Work Order
                  </button>
                  <button
                    onClick={exportJson}
                    className="rounded-md border border-[#7c5725] bg-[#241509]/90 px-4 py-2 text-sm font-bold text-[#fff5df] hover:bg-[#120a05]/70"
                  >
                    Export JSON
                  </button>
                </div>
              </div>
            </aside>

            <div className="min-w-0 space-y-6">
              <Card
                title="Work Order Intake"
                description="Primary job information, property details, requestor, and issue description."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <Input
                    label="Work Order #"
                    value={workOrder.workOrderNumber}
                    onChange={(v) => update("workOrderNumber", v)}
                  />
                  <Select
                    label="Status"
                    value={workOrder.status}
                    onChange={(v) => update("status", v)}
                    options={statusOptions}
                  />
                  <Select
                    label="Priority"
                    value={workOrder.priority}
                    onChange={(v) => update("priority", v)}
                    options={priorityOptions}
                  />
                  <Select
                    label="Source"
                    value={workOrder.source}
                    onChange={(v) => update("source", v)}
                    options={sourceOptions}
                  />
                  <Select
                    label="Category"
                    value={workOrder.category}
                    onChange={(v) => update("category", v)}
                    options={categoryOptions}
                  />
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div className="rounded-md border border-[#7c5725] bg-[#120a05]/70 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#fff5df]">
                      Property / Unit
                    </h3>
                    <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                      <Input
                        label="Property Address"
                        value={workOrder.propertyAddress}
                        onChange={(v) => update("propertyAddress", v)}
                      />
                      <Input
                        label="Unit"
                        value={workOrder.unit}
                        onChange={(v) => update("unit", v)}
                      />
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_90px_120px]">
                      <Input
                        label="City"
                        value={workOrder.city}
                        onChange={(v) => update("city", v)}
                      />
                      <Input
                        label="State"
                        value={workOrder.state}
                        onChange={(v) => update("state", v)}
                      />
                      <Input
                        label="Zip"
                        value={workOrder.zip}
                        onChange={(v) => update("zip", v)}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-[#7c5725] bg-[#120a05]/70 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#fff5df]">
                      Requestor / Contact
                    </h3>
                    <Input
                      label="Requestor Name"
                      value={workOrder.requestorName}
                      onChange={(v) => update("requestorName", v)}
                    />
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Input
                        label="Phone"
                        value={workOrder.requestorPhone}
                        onChange={(v) => update("requestorPhone", v)}
                      />
                      <Input
                        label="Email"
                        value={workOrder.requestorEmail}
                        onChange={(v) => update("requestorEmail", v)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <TextArea
                    label="Issue Description"
                    value={workOrder.issueDescription}
                    onChange={(v) => update("issueDescription", v)}
                    rows={5}
                    placeholder="Describe the reported problem, location, symptoms, and known history."
                  />
                </div>
              </Card>

              <Card
                title="Scope, Access, and Approval"
                description="Prepare vendor instructions and determine whether approval is needed before dispatch."
              >
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-black uppercase tracking-wide text-[#fff5df]">
                        Vendor Scope
                      </h3>
                      <button
                        onClick={() =>
                          update(
                            "scopeOfWork",
                            buildScope(
                              workOrder.category,
                              workOrder.issueDescription,
                            ),
                          )
                        }
                        className="rounded-md bg-[#8a5a18] px-4 py-2 text-sm font-bold text-white hover:bg-[#b98525]"
                      >
                        Generate Scope
                      </button>
                    </div>
                    <TextArea
                      label="Scope of Work"
                      value={workOrder.scopeOfWork}
                      onChange={(v) => update("scopeOfWork", v)}
                      rows={7}
                    />
                    <div className="mt-4">
                      <TextArea
                        label="Access Notes"
                        value={workOrder.accessNotes}
                        onChange={(v) => update("accessNotes", v)}
                        rows={4}
                        placeholder="Lockbox, tenant contact, gate code, pets, parking, special instructions."
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-[#7c5725] bg-[#120a05]/70 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#fff5df]">
                      Approval Control
                    </h3>
                    <label className="mb-4 flex items-center gap-3 rounded-md border border-[#7c5725] bg-[#241509]/90 p-3 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={workOrder.approvalRequired}
                        onChange={(e) => {
                          update("approvalRequired", e.target.checked);
                          update(
                            "approvalStatus",
                            e.target.checked ? "Pending" : "Not Required",
                          );
                        }}
                        className="h-5 w-5"
                      />
                      Owner approval required
                    </label>
                    <Select
                      label="Approval Status"
                      value={workOrder.approvalStatus}
                      onChange={(v) => update("approvalStatus", v)}
                      options={approvalOptions}
                    />
                    <div className="mt-4">
                      <Input
                        label="Maintenance Limit"
                        value={workOrder.maintenanceLimit}
                        onChange={(v) => update("maintenanceLimit", v)}
                        placeholder="$500.00"
                      />
                    </div>
                    <div className="mt-4">
                      <TextArea
                        label="Approval Notes"
                        value={workOrder.approvalNotes}
                        onChange={(v) => update("approvalNotes", v)}
                        rows={5}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                title="Vendor, Schedule, Costing, and Billing"
                description="Assign the job, set the schedule, and capture billable totals."
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-md border border-[#7c5725] bg-[#120a05]/70 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#fff5df]">
                      Vendor / Schedule
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        label="Vendor Name"
                        value={workOrder.vendorName}
                        onChange={(v) => update("vendorName", v)}
                      />
                      <Input
                        label="Assigned To"
                        value={workOrder.assignedTo}
                        onChange={(v) => update("assignedTo", v)}
                      />
                      <Input
                        label="Vendor Phone"
                        value={workOrder.vendorPhone}
                        onChange={(v) => update("vendorPhone", v)}
                      />
                      <Input
                        label="Vendor Email"
                        value={workOrder.vendorEmail}
                        onChange={(v) => update("vendorEmail", v)}
                      />
                      <Input
                        label="Scheduled Date"
                        type="date"
                        value={workOrder.scheduledDate}
                        onChange={(v) => update("scheduledDate", v)}
                      />
                      <Input
                        label="Scheduled Time"
                        type="time"
                        value={workOrder.scheduledTime}
                        onChange={(v) => update("scheduledTime", v)}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-[#7c5725] bg-[#120a05]/70 p-4">
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[#fff5df]">
                      Cost / Billing
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <MoneyInput
                        label="Materials"
                        value={workOrder.materials}
                        onChange={(v) => update("materials", v)}
                      />
                      <MoneyInput
                        label="Labor"
                        value={workOrder.labor}
                        onChange={(v) => update("labor", v)}
                      />
                      <div>
                        <Field label="Fee Type">
                          <select
                            value={workOrder.tripFeeLabel || "Trip Fee"}
                            onChange={(e) => update("tripFeeLabel", e.target.value as TripFeeLabel)}
                            className="w-full rounded-2xl border border-[#7c5725] bg-[#120a05]/70 px-3 py-2.5 text-[#fff5df] outline-none focus:border-[#d4a640] focus:bg-[#241509]/90 focus:ring-2 focus:ring-[#b57a32]/20"
                          >
                            <option value="Trip Fee">Trip Fee</option>
                            <option value="Diagnostic Fee">Diagnostic Fee</option>
                          </select>
                        </Field>
                        <div className="mt-2">
                          <MoneyInput
                            label={workOrder.tripFeeLabel || "Trip Fee"}
                            value={workOrder.tripFee}
                            onChange={(v) => update("tripFee", v)}
                          />
                        </div>
                      </div>
                      <Input
                        label="Tax Rate %"
                        value={workOrder.taxRate}
                        onChange={(v) => update("taxRate", v)}
                      />
                      <div className="md:col-span-2">
                        <Select
                          label="Bill To"
                          value={workOrder.billTo}
                          onChange={(v) => update("billTo", v)}
                          options={billToOptions}
                        />
                      </div>
                    </div>
                    <label className="mt-4 flex items-center gap-3 rounded-md border border-[#7c5725] bg-[#241509]/90 p-3 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={workOrder.tenantCharge}
                        onChange={(e) =>
                          update("tenantCharge", e.target.checked)
                        }
                        className="h-5 w-5"
                      />
                      Potential tenant charge / deposit disposition related
                    </label>
                    {workOrder.tenantCharge && (
                      <div className="mt-4">
                        <TextArea
                          label="Tenant Charge Notes"
                          value={workOrder.tenantChargeNotes}
                          onChange={(v) => update("tenantChargeNotes", v)}
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card
                title="Completion / Close-Out Photos"
                description="Before and after photos are stored on the work order and pushed/shared with the Service Ticket package."
              >
                <div className="grid gap-5 xl:grid-cols-2">
                  <PhotoManager
                    title="Before Photos"
                    description="Condition before repair, access, damage, or diagnostic work."
                    photos={workOrder.beforePhotoData || []}
                    notes={workOrder.beforePhotos}
                    onNotesChange={(v) => update("beforePhotos", v)}
                    onAddPhotos={(files) => addPhotos("before", files)}
                    onCaptionChange={(id, caption) => updatePhotoCaption("before", id, caption)}
                    onRemovePhoto={(id) => removePhoto("before", id)}
                    onSaveCloud={() => savePhotosToCloud("before")}
                  />
                  <PhotoManager
                    title="After Photos"
                    description="Completed repair, cleanup, installed parts, or final condition."
                    photos={workOrder.afterPhotoData || []}
                    notes={workOrder.afterPhotos}
                    onNotesChange={(v) => update("afterPhotos", v)}
                    onAddPhotos={(files) => addPhotos("after", files)}
                    onCaptionChange={(id, caption) => updatePhotoCaption("after", id, caption)}
                    onRemovePhoto={(id) => removePhoto("after", id)}
                    onSaveCloud={() => savePhotosToCloud("after")}
                  />
                  <TextArea
                    label="Completion Notes"
                    value={workOrder.completionNotes}
                    onChange={(v) => update("completionNotes", v)}
                    rows={5}
                  />
                  <TextArea
                    label="Internal Notes"
                    value={workOrder.internalNotes}
                    onChange={(v) => update("internalNotes", v)}
                    rows={5}
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
        {printMode === "workOrder" ? (
        <section className="print-only print-report bg-[#241509]/90 p-0 text-[#1f1f1f]">
          <div className="print-sheet border border-[#2f1f14] bg-[#241509]/90">
            {/* Professional 5 Tools print header modeled after a standard work-order form */}
            <div className="grid grid-cols-[1fr_0.8fr] border-b border-[#2f1f14]">
              <div className="flex gap-4 p-5">
                <img
                  src="/5tools-logo.png"
                  alt="5 Tools"
                  className="print-logo h-20 w-auto shrink-0 object-contain"
                />
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-[#fff5df]">
                    5 Tools Maintenance
                  </h1>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#d4a640]">
                    Professional Work Order
                  </p>
                  <div className="mt-3 text-[11px] leading-5 text-[#3f3024]">
                    <p>15 Oregon Ave Ste 110</p>
                    <p>Tacoma, WA 98409</p>
                    <p>Phone: (253) 242-5465</p>
                  </div>
                </div>
              </div>

              <div className="border-l border-[#2f1f14] bg-[#120a05]/70 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4a640]">
                  Work Order #
                </p>
                <h2 className="mt-1 text-3xl font-black text-[#fff5df]">
                  {workOrder.workOrderNumber || "Work Order"}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="border border-[#7c5725] bg-[#241509]/90 p-2">
                    <p className="font-bold text-[#e6d2aa]">Status</p>
                    <p className="font-black text-[#fff5df]">
                      {workOrder.status}
                    </p>
                  </div>
                  <div className="border border-[#7c5725] bg-[#241509]/90 p-2">
                    <p className="font-bold text-[#e6d2aa]">Priority</p>
                    <p className="font-black text-[#fff5df]">
                      {workOrder.priority}
                    </p>
                  </div>
                  <div className="border border-[#7c5725] bg-[#241509]/90 p-2">
                    <p className="font-bold text-[#e6d2aa]">Created</p>
                    <p className="font-black text-[#fff5df]">
                      {workOrder.createdAt
                        ? new Date(workOrder.createdAt).toLocaleDateString()
                        : todayInput()}
                    </p>
                  </div>
                  <div className="border border-[#7c5725] bg-[#241509]/90 p-2">
                    <p className="font-bold text-[#e6d2aa]">Printed</p>
                    <p className="font-black text-[#fff5df]">
                      {reportGeneratedAt}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[0.9fr_1.1fr] border-b border-[#2f1f14]">
              <div className="border-r border-[#2f1f14] p-4">
                <p className="print-box-title">To / Vendor</p>
                <p className="mt-2 text-sm font-black text-[#fff5df]">
                  {workOrder.vendorName ||
                    workOrder.assignedTo ||
                    "5 Tools Maintenance"}
                </p>
                <div className="mt-2 text-[11px] leading-5">
                  <p>{workOrder.vendorPhone || "Phone: --"}</p>
                  <p>{workOrder.vendorEmail || "Email: --"}</p>
                  <p>Assigned To: {workOrder.assignedTo || "--"}</p>
                </div>
              </div>

              <div className="p-4">
                <p className="print-box-title">Job Site</p>
                <p className="mt-2 text-sm font-black text-[#fff5df]">
                  {workOrder.propertyAddress || "No property address entered"}
                  {workOrder.unit ? `, Unit ${workOrder.unit}` : ""}
                </p>
                <p className="text-[11px] leading-5">
                  {[workOrder.city, workOrder.state, workOrder.zip]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <p>
                    <span className="font-bold">Source:</span>{" "}
                    {workOrder.source}
                  </p>
                  <p>
                    <span className="font-bold">Category:</span>{" "}
                    {workOrder.category}
                  </p>
                  <p>
                    <span className="font-bold">Scheduled:</span>{" "}
                    {[workOrder.scheduledDate, workOrder.scheduledTime]
                      .filter(Boolean)
                      .join(" at ") || "--"}
                  </p>
                  <p>
                    <span className="font-bold">Maintenance Limit:</span>{" "}
                    {workOrder.maintenanceLimit || "--"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 border-b border-[#2f1f14] text-[11px]">
              <div className="print-fact">
                <span>Estimate Requested</span>
                <strong>
                  {workOrder.estimateStatus &&
                  workOrder.estimateStatus !== "Not Started"
                    ? "Yes"
                    : "--"}
                </strong>
              </div>
              <div className="print-fact">
                <span>Estimate Amount</span>
                <strong>{money(asNumber(workOrder.estimateTotal))}</strong>
              </div>
              <div className="print-fact">
                <span>Tenant Notified</span>
                <strong>{workOrder.accessNotes ? "Review Notes" : "--"}</strong>
              </div>
              <div className="print-fact">
                <span>Permission to Enter</span>
                <strong>
                  {workOrder.accessNotes ? "See Access Notes" : "--"}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-[0.9fr_1.1fr] border-b border-[#2f1f14]">
              <div className="border-r border-[#2f1f14] p-4">
                <p className="print-box-title">Tenant / Requestor</p>
                <p className="mt-2 text-sm font-black text-[#fff5df]">
                  {workOrder.requestorName || workOrder.source || "Not entered"}
                </p>
                <div className="mt-2 text-[11px] leading-5">
                  <p>{workOrder.requestorPhone || "Phone: --"}</p>
                  <p>{workOrder.requestorEmail || "Email: --"}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="print-box-title">Access / Property Notes</p>
                <p className="mt-2 min-h-[45px] whitespace-pre-wrap text-[11px] leading-5">
                  {workOrder.accessNotes || "No access notes entered."}
                </p>
              </div>
            </div>

            <div className="print-section border-b border-[#2f1f14]">
              <div className="print-section-title px-4 py-2 text-xs font-black uppercase tracking-wide">
                Description
              </div>
              <p className="min-h-[80px] whitespace-pre-wrap px-4 py-3 text-[12px] leading-6">
                {workOrder.issueDescription || "No issue description entered."}
              </p>
            </div>

            <div className="grid grid-cols-2 border-b border-[#2f1f14]">
              <div className="border-r border-[#2f1f14]">
                <div className="print-section-title px-4 py-2 text-xs font-black uppercase tracking-wide">
                  Issue Details
                </div>
                <div className="space-y-2 p-4 text-[11px] leading-5">
                  <p>
                    <span className="font-bold">Issue:</span>{" "}
                    {workOrder.category}
                  </p>
                  <p>
                    <span className="font-bold">Location of Issue:</span>{" "}
                    {workOrder.unit || workOrder.propertyAddress || "--"}
                  </p>
                  <p>
                    <span className="font-bold">Bill To:</span>{" "}
                    {workOrder.billTo}
                  </p>
                  <p>
                    <span className="font-bold">Tenant Charge:</span>{" "}
                    {workOrder.tenantCharge ? "Yes" : "No"}
                  </p>
                  {workOrder.tenantChargeNotes ? (
                    <p className="whitespace-pre-wrap">
                      <span className="font-bold">Tenant Charge Notes:</span>{" "}
                      {workOrder.tenantChargeNotes}
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="print-section-title px-4 py-2 text-xs font-black uppercase tracking-wide">
                  Vendor Instructions
                </div>
                <p className="min-h-[120px] whitespace-pre-wrap p-4 text-[11px] leading-5">
                  {workOrder.scopeOfWork || "No scope of work entered."}
                </p>
              </div>
            </div>

            <div className="print-page-break-after border-b border-[#2f1f14]">
              <div className="print-section-title px-4 py-2 text-xs font-black uppercase tracking-wide">
                Technician Notes
              </div>
              <div className="min-h-[155px] space-y-3 p-4 text-[11px] leading-5">
                {workOrder.completionNotes ? (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold">Completion Notes:</span>{" "}
                    {workOrder.completionNotes}
                  </p>
                ) : (
                  <p className="text-[#6f6256]">Technician notes:</p>
                )}
                {workOrder.beforePhotos ? (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold">Before Photos / Notes:</span>{" "}
                    {workOrder.beforePhotos}
                  </p>
                ) : null}
                {workOrder.afterPhotos ? (
                  <p className="whitespace-pre-wrap">
                    <span className="font-bold">After Photos / Notes:</span>{" "}
                    {workOrder.afterPhotos}
                  </p>
                ) : null}
              </div>
            </div>

            {((workOrder.beforePhotoData || []).length > 0 || (workOrder.afterPhotoData || []).length > 0) ? (
              <div className="border-b border-[#2f1f14]">
                <div className="print-section-title px-4 py-2 text-xs font-black uppercase tracking-wide">
                  Before / After Photos
                </div>
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <p className="print-box-title">Before Photos</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(workOrder.beforePhotoData || []).map((photo) => (
                        <div key={photo.id} className="border border-[#7c5725] p-1">
                          <img src={getPhotoDisplaySrc(photo)} alt={photo.caption || photo.name} className="h-28 w-full object-cover" />
                          <p className="mt-1 text-[9px] font-bold leading-3 text-[#fff5df]">
                            {photo.caption || photo.name}
                          </p>
                        </div>
                      ))}
                    </div>
                    {workOrder.beforePhotos ? (
                      <p className="mt-2 whitespace-pre-wrap text-[10px] leading-4">{workOrder.beforePhotos}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="print-box-title">After Photos</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(workOrder.afterPhotoData || []).map((photo) => (
                        <div key={photo.id} className="border border-[#7c5725] p-1">
                          <img src={getPhotoDisplaySrc(photo)} alt={photo.caption || photo.name} className="h-28 w-full object-cover" />
                          <p className="mt-1 text-[9px] font-bold leading-3 text-[#fff5df]">
                            {photo.caption || photo.name}
                          </p>
                        </div>
                      ))}
                    </div>
                    {workOrder.afterPhotos ? (
                      <p className="mt-2 whitespace-pre-wrap text-[10px] leading-4">{workOrder.afterPhotos}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="border-b border-[#2f1f14]">
              <div className="print-section-title px-4 py-2 text-xs font-black uppercase tracking-wide">
                Account Statement
              </div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#7c5725] bg-[#120a05]/70 text-left">
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#e4d2bc]">
                    <td className="px-3 py-2">Materials</td>
                    <td className="px-3 py-2 text-right font-bold">
                      {money(totals.materials)}
                    </td>
                  </tr>
                  <tr className="border-b border-[#e4d2bc]">
                    <td className="px-3 py-2">Labor</td>
                    <td className="px-3 py-2 text-right font-bold">
                      {money(totals.labor)}
                    </td>
                  </tr>
                  <tr className="border-b border-[#e4d2bc]">
                    <td className="px-3 py-2">{workOrder.tripFeeLabel || "Trip Fee"}</td>
                    <td className="px-3 py-2 text-right font-bold">
                      {money(totals.tripFee)}
                    </td>
                  </tr>
                  <tr className="border-b border-[#e4d2bc]">
                    <td className="px-3 py-2">
                      Tax ({asNumber(workOrder.taxRate).toFixed(2)}%)
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {money(totals.tax)}
                    </td>
                  </tr>
                  <tr className="bg-[#120a05]/70 text-sm">
                    <td className="px-3 py-3 font-black">Total</td>
                    <td className="px-3 py-3 text-right font-black">
                      {money(totals.grand)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-4 gap-4 p-5 text-[11px]">
              <div className="signature-line">
                <span>Created By</span>
              </div>
              <div className="signature-line">
                <span>Authorized By</span>
              </div>
              <div className="signature-line">
                <span>Signed By</span>
              </div>
              <div className="signature-line">
                <span>Dated By</span>
              </div>
            </div>

            <div className="border-t border-[#7c5725] bg-[#120a05]/70 px-5 py-3 text-[10px] leading-4 text-[#e6d2aa]">
              <p className="font-bold text-[#fff5df]">Prepared by 5 Tools</p>
              <p>
                This professional work order summarizes maintenance intake,
                jobsite information, tenant/requestor details, vendor
                instructions, access notes, cost summary, and technician notes.
                This is a maintenance work order record and does not represent a
                licensed inspection, engineering opinion, or certified report.
              </p>
            </div>
          </div>
        </section>
        ) : (
        <section className="print-only print-report bg-[#241509]/90 p-0 text-[#1f1f1f]">
          <div className="print-sheet border border-[#2f1f14] bg-[#241509]/90">
            <div className="grid grid-cols-[1fr_0.8fr] border-b border-[#2f1f14]">
              <div className="flex gap-4 p-5">
                <img
                  src="/5tools-logo.png"
                  alt="5 Tools"
                  className="print-logo h-20 w-auto shrink-0 object-contain"
                />
                <div>
                  <h1 className="text-3xl font-black uppercase tracking-tight text-[#fff5df]">5 Tools Maintenance</h1>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-[#d4a640]">Invoice</p>
                  <div className="mt-3 text-[11px] leading-5 text-[#3f3024]">
                    <p>15 Oregon Ave Ste 110</p>
                    <p>Tacoma, WA 98409</p>
                    <p>Phone: (253) 242-5465</p>
                  </div>
                </div>
              </div>
              <div className="border-l border-[#2f1f14] bg-[#120a05]/70 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4a640]">Invoice #</p>
                <h2 className="mt-1 text-2xl font-black text-[#fff5df]">{workOrder.invoiceNumber || buildInvoiceNumber(workOrder.workOrderNumber)}</h2>
                <div className="mt-3 space-y-1 text-[11px]">
                  <p><span className="font-bold">Status:</span> {workOrder.invoiceStatus || "Draft"}</p>
                  <p><span className="font-bold">Invoice Date:</span> {workOrder.invoiceDate || todayInput()}</p>
                  <p><span className="font-bold">Due Date:</span> {workOrder.invoiceDueDate || addDaysInput(15)}</p>
                  <p><span className="font-bold">Work Order:</span> {workOrder.workOrderNumber || "--"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-[#2f1f14]">
              <div className="border-r border-[#2f1f14] p-4">
                <p className="print-box-title">Bill To</p>
                <p className="mt-2 text-sm font-black text-[#fff5df]">{workOrder.invoiceRecipientName || workOrder.billTo}</p>
                <p className="mt-1 text-[11px]">{workOrder.invoiceRecipientEmail || ""}</p>
                <p className="mt-1 text-[11px]">Billing Type: {workOrder.billTo}</p>
              </div>
              <div className="p-4">
                <p className="print-box-title">Service Address</p>
                <p className="mt-2 text-sm font-black text-[#fff5df]">
                  {workOrder.propertyAddress || "No property address entered"}{workOrder.unit ? `, Unit ${workOrder.unit}` : ""}
                </p>
                <p className="text-[11px]">{[workOrder.city, workOrder.state, workOrder.zip].filter(Boolean).join(", ")}</p>
                <p className="mt-2 text-[11px]"><span className="font-bold">Category:</span> {workOrder.category}</p>
              </div>
            </div>

            <div className="border-b border-[#2f1f14] p-4">
              <p className="print-box-title">Work Summary</p>
              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5">
                {workOrder.completionNotes || workOrder.scopeOfWork || workOrder.issueDescription || "No work summary entered."}
              </p>
            </div>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-[#2f1f14] bg-[#3f2a1b] text-left text-white">
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#e4d2bc]"><td className="px-3 py-2">Materials</td><td className="px-3 py-2 text-right font-bold">{money(totals.materials)}</td></tr>
                <tr className="border-b border-[#e4d2bc]"><td className="px-3 py-2">Labor</td><td className="px-3 py-2 text-right font-bold">{money(totals.labor)}</td></tr>
                <tr className="border-b border-[#e4d2bc]"><td className="px-3 py-2">{workOrder.tripFeeLabel || "Trip Fee"}</td><td className="px-3 py-2 text-right font-bold">{money(totals.tripFee)}</td></tr>
                <tr className="border-b border-[#e4d2bc]"><td className="px-3 py-2">Sales Tax ({asNumber(workOrder.taxRate).toFixed(2)}%)</td><td className="px-3 py-2 text-right font-bold">{money(totals.tax)}</td></tr>
                <tr className="bg-[#120a05]/70 text-sm"><td className="px-3 py-3 font-black">Total Due</td><td className="px-3 py-3 text-right font-black">{money(totals.grand)}</td></tr>
              </tbody>
            </table>

            <div className="border-t border-[#7c5725] bg-[#120a05]/70 px-5 py-3 text-[10px] leading-4 text-[#e6d2aa]">
              <p className="font-bold text-[#fff5df]">Invoice Notes</p>
              <p className="whitespace-pre-wrap">{workOrder.invoiceNotes || "Payment is due by the invoice due date unless other written arrangements have been approved."}</p>
              {workOrder.invoiceStatus === "Paid" ? (
                <p className="mt-2 font-bold text-green-800">Paid {workOrder.invoicePaidDate || ""} {workOrder.invoicePaymentMethod ? `by ${workOrder.invoicePaymentMethod}` : ""}</p>
              ) : null}
            </div>
          </div>
        </section>
        )}
      </div>

      <footer className="border-t border-[#d4a640]/40 bg-[#3f2a1b] px-8 py-6 text-center text-xs leading-6 text-[#f1e6d8] no-print">
        5 Tools supports maintenance workflow, work order pricing, scheduling,
        repair documentation, inventory tracking, and field operations.
      </footer>
    </main>
  );
}
