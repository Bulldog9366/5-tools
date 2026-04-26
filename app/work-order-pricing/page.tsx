"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type UploadedPdf = {
  file: File | null;
  fileName: string;
  uploadedAt?: string;
};

type ExtractedWorkOrder = {
  workOrderNumber: string;
  status: string;
  createdOn: string;
  estimateRequestedOn: string;
  estimateAmount: string;
  estimatedOn: string;
  scheduledOn: string;
  completedOn: string;

  propertyAddress: string;
  city: string;
  state: string;
  zip: string;
  unit: string;

  tenantNames: string;
  tenantPhones: string;
  tenantEmails: string;
  tenantAvailability: string;

  permissionToEnter: string;
  accessNotes: string;
  pets: string;

  maintenanceLimit: string;

  issueCategory: string;
  issueSubcategory: string;
  applianceType: string;
  brand: string;
  model: string;

  problemDescription: string;
  issueDetails: string;
  safetyConcern: string;

  vendorAssigned: string;
  requestedAction: string;
};

type JobClassification = {
  tradeCategory: string;
  jobType: string;
  severity: string;
  occupancyStatus: string;
  accessComplexity: string;
  recommendedPath: string;
  confidence: number;
};

type PricingBreakdown = {
  pricingRuleUsed: string;
  serviceCall: string;
  labor: string;
  materials: string;
  disposal: string;
  other: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  pricingNote: string;
  approvalNeeded: boolean;
  manualReviewRequired: boolean;
};

type GeneratedOutputs = {
  vendorInstructions: string;
  ownerUpdate: string;
  internalSummary: string;
};

type InternalReview = {
  assignedTo: string;
  status: string;
  followUpDate: string;
  internalNotes: string;
};

type SavedPricingRecord = {
  id: string;
  created_at: string;
  file_name: string | null;
  work_order_number: string | null;
  property_address: string | null;
  issue_category: string | null;
  job_type: string | null;
  total_amount: number | null;
  record_status: string | null;
};

type PricingRule = {
  key: string;
  label: string;
  tradeCategory: string;
  jobType: string;
  keywords: string[];
  serviceCallMin: number;
  serviceCallMax: number;
  laborMin: number;
  laborMax: number;
  materialsMin: number;
  materialsMax: number;
  disposalMin: number;
  disposalMax: number;
  note: string;
};

const DEFAULT_EXTRACTED: ExtractedWorkOrder = {
  workOrderNumber: "",
  status: "",
  createdOn: "",
  estimateRequestedOn: "",
  estimateAmount: "",
  estimatedOn: "",
  scheduledOn: "",
  completedOn: "",

  propertyAddress: "",
  city: "",
  state: "WA",
  zip: "",
  unit: "",

  tenantNames: "",
  tenantPhones: "",
  tenantEmails: "",
  tenantAvailability: "",

  permissionToEnter: "",
  accessNotes: "",
  pets: "",

  maintenanceLimit: "",

  issueCategory: "",
  issueSubcategory: "",
  applianceType: "",
  brand: "",
  model: "",

  problemDescription: "",
  issueDetails: "",
  safetyConcern: "",

  vendorAssigned: "Appliance Co",
  requestedAction: "Inspect issue and provide repair recommendation.",
};

const DEFAULT_CLASSIFICATION: JobClassification = {
  tradeCategory: "",
  jobType: "",
  severity: "Low",
  occupancyStatus: "Occupied",
  accessComplexity: "Easy",
  recommendedPath: "Diagnose only",
  confidence: 0,
};

const DEFAULT_PRICING: PricingBreakdown = {
  pricingRuleUsed: "",
  serviceCall: "",
  labor: "",
  materials: "",
  disposal: "",
  other: "",
  taxRate: "10.5",
  taxAmount: "",
  total: "",
  pricingNote: "",
  approvalNeeded: false,
  manualReviewRequired: false,
};

const DEFAULT_OUTPUTS: GeneratedOutputs = {
  vendorInstructions: "",
  ownerUpdate: "",
  internalSummary: "",
};

const DEFAULT_INTERNAL_REVIEW: InternalReview = {
  assignedTo: "",
  status: "New",
  followUpDate: "",
  internalNotes: "",
};

const PRICING_RULES: PricingRule[] = [
  {
    key: "appliance_diagnostic",
    label: "Appliance Diagnostic",
    tradeCategory: "Appliance",
    jobType: "Diagnostic",
    keywords: ["appliance", "diagnostic", "not working", "issue", "problem"],
    serviceCallMin: 125,
    serviceCallMax: 185,
    laborMin: 0,
    laborMax: 150,
    materialsMin: 0,
    materialsMax: 75,
    disposalMin: 0,
    disposalMax: 0,
    note: "Diagnostic only unless additional repair is approved.",
  },
  {
    key: "dishwasher_common_repair",
    label: "Dishwasher Common Repair",
    tradeCategory: "Appliance",
    jobType: "Dishwasher Repair",
    keywords: ["dishwasher", "cleaning", "cycle", "not cleaning", "drain", "spray arm"],
    serviceCallMin: 125,
    serviceCallMax: 185,
    laborMin: 175,
    laborMax: 350,
    materialsMin: 25,
    materialsMax: 180,
    disposalMin: 0,
    disposalMax: 0,
    note: "Common dishwasher repair range based on standard service conditions.",
  },
  {
    key: "dryer_common_repair",
    label: "Dryer Common Repair",
    tradeCategory: "Appliance",
    jobType: "Dryer Repair",
    keywords: ["dryer", "won't turn off", "will not turn off", "heating", "not shutting off"],
    serviceCallMin: 125,
    serviceCallMax: 185,
    laborMin: 180,
    laborMax: 425,
    materialsMin: 40,
    materialsMax: 220,
    disposalMin: 0,
    disposalMax: 0,
    note: "Common dryer repair range. Control and sensor issues may require approval before parts are ordered.",
  },
  {
    key: "washer_common_repair",
    label: "Washer Common Repair",
    tradeCategory: "Appliance",
    jobType: "Washer Repair",
    keywords: ["washer", "washing machine", "spin", "drain", "leak"],
    serviceCallMin: 125,
    serviceCallMax: 185,
    laborMin: 175,
    laborMax: 400,
    materialsMin: 25,
    materialsMax: 220,
    disposalMin: 0,
    disposalMax: 0,
    note: "Common washer repair range.",
  },
  {
    key: "range_common_repair",
    label: "Range / Oven Repair",
    tradeCategory: "Appliance",
    jobType: "Range Repair",
    keywords: ["range", "oven", "stove", "burner", "broil", "bake"],
    serviceCallMin: 125,
    serviceCallMax: 185,
    laborMin: 185,
    laborMax: 425,
    materialsMin: 30,
    materialsMax: 250,
    disposalMin: 0,
    disposalMax: 0,
    note: "Common cooking appliance repair range.",
  },
];

function sectionCard(title: string, subtitle?: string) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseCurrencyInput(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function midpoint(min: number, max: number) {
  return (min + max) / 2;
}

function extractFirstMatch(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match?.[1]?.trim() ?? "";
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function formatDateForInput(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return value;

  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function inferIssueCategory(description: string) {
  const lower = description.toLowerCase();
  if (lower.includes("dishwasher")) return "Dishwasher";
  if (lower.includes("dryer")) return "Dryer";
  if (lower.includes("washer")) return "Washer";
  if (lower.includes("range") || lower.includes("oven") || lower.includes("stove")) return "Range/Oven";
  if (lower.includes("refrigerator") || lower.includes("fridge")) return "Refrigerator";
  if (lower.includes("microwave")) return "Microwave";
  if (lower.includes("garbage disposal") || lower.includes("disposal")) return "Garbage Disposal";
  if (lower.includes("toilet")) return "Toilet";
  if (lower.includes("sink")) return "Sink";
  if (lower.includes("water heater")) return "Water Heater";
  return "General Maintenance";
}

function extractApplianceInfo(description: string) {
  const lower = description.toLowerCase();
  let applianceType = "";
  if (lower.includes("dishwasher")) applianceType = "Dishwasher";
  else if (lower.includes("dryer")) applianceType = "Dryer";
  else if (lower.includes("washer")) applianceType = "Washer";
  else if (lower.includes("range") || lower.includes("oven") || lower.includes("stove")) applianceType = "Range/Oven";
  else if (lower.includes("refrigerator") || lower.includes("fridge")) applianceType = "Refrigerator";

  const modelMatch =
    description.match(/(?:make\/model|model(?: number)?)[:\s-]*([A-Z0-9\-]+)/i) ||
    description.match(/\b([A-Z]{2,}[A-Z0-9\-]{4,})\b/);

  const brandMatch =
    description.match(/\b(Samsung|Whirlpool|GE|LG|Frigidaire|Maytag|Kenmore|Bosch|KitchenAid|Amana)\b/i) || null;

  return {
    applianceType,
    brand: brandMatch?.[1] ?? "",
    model: modelMatch?.[1] ?? "",
  };
}

function classifyWorkOrder(data: ExtractedWorkOrder): JobClassification {
  const fullText = `${data.issueCategory} ${data.problemDescription} ${data.issueDetails}`.toLowerCase();

  let tradeCategory = "General Maintenance";
  let jobType = "Manual Review";
  let confidence = 0.55;
  let recommendedPath = "Diagnose only";
  let severity = "Low";

  if (
    fullText.includes("dishwasher") ||
    fullText.includes("dryer") ||
    fullText.includes("washer") ||
    fullText.includes("appliance") ||
    fullText.includes("oven") ||
    fullText.includes("stove")
  ) {
    tradeCategory = "Appliance";
    confidence = 0.8;
  }

  if (fullText.includes("dishwasher")) {
    jobType = "Dishwasher Repair";
    confidence = 0.9;
  } else if (fullText.includes("dryer")) {
    jobType = "Dryer Repair";
    confidence = 0.9;
  } else if (fullText.includes("washer")) {
    jobType = "Washer Repair";
    confidence = 0.85;
  } else if (fullText.includes("range") || fullText.includes("oven") || fullText.includes("stove")) {
    jobType = "Range Repair";
    confidence = 0.85;
  } else if (tradeCategory === "Appliance") {
    jobType = "Diagnostic";
    confidence = 0.75;
  }

  if (fullText.includes("smoking") || fullText.includes("sparking") || fullText.includes("fire hazard")) {
    severity = "High";
    recommendedPath = "Manual review";
    confidence = Math.max(confidence, 0.9);
  } else if (fullText.includes("not working") || fullText.includes("will not") || fullText.includes("won't")) {
    severity = "Medium";
  }

  const occupancyStatus = data.tenantNames ? "Occupied" : "Vacant";

  let accessComplexity = "Easy";
  const accessText = `${data.permissionToEnter} ${data.accessNotes}`.toLowerCase();
  if (accessText.includes("gate") || accessText.includes("call upon arrival") || accessText.includes("tenant requests")) {
    accessComplexity = "Moderate";
  }

  return {
    tradeCategory,
    jobType,
    severity,
    occupancyStatus,
    accessComplexity,
    recommendedPath,
    confidence,
  };
}

function findPricingRule(data: ExtractedWorkOrder, classification: JobClassification) {
  const haystack =
    `${classification.tradeCategory} ${classification.jobType} ${data.issueCategory} ${data.problemDescription} ${data.issueDetails}`.toLowerCase();

  let bestRule: PricingRule | null = null;
  let bestScore = -1;

  for (const rule of PRICING_RULES) {
    let score = 0;
    if (rule.tradeCategory.toLowerCase() === classification.tradeCategory.toLowerCase()) score += 3;
    if (rule.jobType.toLowerCase() === classification.jobType.toLowerCase()) score += 4;
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  return bestRule;
}

function calculatePricing(
  rule: PricingRule | null,
  data: ExtractedWorkOrder,
  classification: JobClassification
): PricingBreakdown {
  if (!rule) {
    return {
      pricingRuleUsed: "Manual Review",
      serviceCall: "0.00",
      labor: "0.00",
      materials: "0.00",
      disposal: "0.00",
      other: "0.00",
      taxRate: "10.5",
      taxAmount: "0.00",
      total: "0.00",
      pricingNote: "No matching pricing rule found. Review manually.",
      approvalNeeded: false,
      manualReviewRequired: true,
    };
  }

  let serviceCall = midpoint(rule.serviceCallMin, rule.serviceCallMax);
  let labor = midpoint(rule.laborMin, rule.laborMax);
  let materials = midpoint(rule.materialsMin, rule.materialsMax);
  let disposal = midpoint(rule.disposalMin, rule.disposalMax);
  const other = 0;

  const limit = parseCurrencyInput(data.maintenanceLimit);

  let pricingNote = rule.note;
  if (classification.accessComplexity === "Moderate") {
    labor += 45;
    pricingNote += " Access coordination may add labor time.";
  }

  if (classification.severity === "High") {
    labor += 75;
    pricingNote += " Safety concern noted; manual review strongly recommended.";
  }

  if (classification.recommendedPath === "Diagnose only") {
    labor = Math.min(labor, 125);
    materials = 0;
    pricingNote += " Initial pricing assumes diagnostic-first workflow.";
  }

  const subtotal = serviceCall + labor + materials + disposal + other;
  const taxRate = 10.5;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const approvalNeeded = limit > 0 ? total > limit : false;

  return {
    pricingRuleUsed: rule.label,
    serviceCall: serviceCall.toFixed(2),
    labor: labor.toFixed(2),
    materials: materials.toFixed(2),
    disposal: disposal.toFixed(2),
    other: other.toFixed(2),
    taxRate: taxRate.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
    pricingNote: approvalNeeded
      ? `${pricingNote} Total exceeds maintenance limit and should be reviewed for approval.`
      : pricingNote,
    approvalNeeded,
    manualReviewRequired: classification.severity === "High",
  };
}

function buildVendorInstructions(
  data: ExtractedWorkOrder,
  classification: JobClassification,
  pricing: PricingBreakdown
) {
  const accessLine = [data.permissionToEnter, data.accessNotes].filter(Boolean).join(" ");
  const issueLine = data.problemDescription || data.issueDetails || "General maintenance issue reported.";
  const vendorName = data.vendorAssigned || "Assigned Vendor";

  return `ASPEN NW REAL ESTATE LLC
Vendor Work Order Instructions

Property: ${data.propertyAddress}${data.city ? `, ${data.city}` : ""}${data.state ? `, ${data.state}` : ""}${data.zip ? ` ${data.zip}` : ""}
Work Order #: ${data.workOrderNumber || "--"}
Vendor: ${vendorName}

Tenant / Access:
${data.tenantNames || "--"}
${data.tenantPhones ? `Phone: ${data.tenantPhones}` : ""}
${data.tenantEmails ? `Email: ${data.tenantEmails}` : ""}
Availability: ${data.tenantAvailability || "--"}
Permission / Access Notes: ${accessLine || "--"}

Issue Summary:
${issueLine}

Classification:
Trade Category: ${classification.tradeCategory || "--"}
Job Type: ${classification.jobType || "--"}
Recommended Path: ${classification.recommendedPath || "--"}

Scope of Work:
1. Inspect and diagnose the reported issue.
2. Confirm cause of failure and whether repair is recommended.
3. Provide estimate for any work beyond initial diagnostic.
4. Complete minor repair only if within authorized limit.
5. Advise whether repair or replacement is the better option if applicable.

Pricing Guidance:
Suggested Service Call: ${formatCurrency(parseCurrencyInput(pricing.serviceCall))}
Suggested Labor: ${formatCurrency(parseCurrencyInput(pricing.labor))}
Suggested Materials Allowance: ${formatCurrency(parseCurrencyInput(pricing.materials))}
Suggested Total: ${formatCurrency(parseCurrencyInput(pricing.total))}

Authorization:
Maintenance Limit: ${data.maintenanceLimit ? formatCurrency(parseCurrencyInput(data.maintenanceLimit)) : "--"}
${pricing.approvalNeeded ? "Do not exceed limit without Aspen NW approval." : "Proceed within approved maintenance limit."}

Completion Requirements:
- Provide diagnosis and recommendation
- Include parts and labor breakdown if additional work is needed
- Provide photos if applicable
- Reference work order number on invoice

Billing:
Reference Work Order #${data.workOrderNumber || "--"} on invoice.`;
}

function buildOwnerUpdate(
  data: ExtractedWorkOrder,
  classification: JobClassification,
  pricing: PricingBreakdown
) {
  const issue = data.problemDescription || data.issueDetails || "a maintenance issue";
  const vendor = data.vendorAssigned || "the vendor";
  const safety = data.safetyConcern
    ? `The reported notes indicate: ${data.safetyConcern}.`
    : "At this time, there are no reported indications of an immediate safety concern.";

  return `The tenant has reported ${
    issue.charAt(0).toLowerCase() === issue.charAt(0) ? issue : issue.toLowerCase()
  }${issue.endsWith(".") ? "" : "."}

${safety}

We have requested ${vendor} to inspect the issue and advise what work is recommended. Based on the current review, this appears to fall under ${classification.jobType || "general maintenance"}.

Current pricing guidance is approximately ${formatCurrency(parseCurrencyInput(pricing.total))}${
    pricing.approvalNeeded
      ? `, which is above the current maintenance limit of ${formatCurrency(parseCurrencyInput(data.maintenanceLimit))} and would require approval before proceeding beyond diagnostic work.`
      : "."
  }

We will follow up once the vendor provides findings and next-step recommendations.`;
}

function buildInternalSummary(
  data: ExtractedWorkOrder,
  classification: JobClassification,
  pricing: PricingBreakdown
) {
  return `Internal Summary

Work Order: ${data.workOrderNumber || "--"}
Property: ${data.propertyAddress || "--"}
Issue Category: ${data.issueCategory || "--"}
Job Type: ${classification.jobType || "--"}
Vendor: ${data.vendorAssigned || "--"}
Suggested Total: ${formatCurrency(parseCurrencyInput(pricing.total))}
Approval Needed: ${pricing.approvalNeeded ? "Yes" : "No"}

Pricing Note:
${pricing.pricingNote || "--"}`;
}

function parseWorkOrderText(rawText: string): ExtractedWorkOrder {
  const normalized = normalizeWhitespace(rawText);
  const compact = normalized.replace(/\s+/g, " ").trim();

  const workOrderNumber =
    extractFirstMatch(
      compact,
      /\b(\d{3,}-\d+)\b\s+(?:New|Open|Closed|Completed|Pending)\s+\d{1,2}\/\d{1,2}\/\d{4}/i
    ) || "";

  const status =
    extractFirstMatch(
      compact,
      /\b\d{3,}-\d+\b\s+(New|Open|Closed|Completed|Pending)\s+\d{1,2}\/\d{1,2}\/\d{4}/i
    ) || "";

  const createdOn = formatDateForInput(
    extractFirstMatch(
      compact,
      /\b\d{3,}-\d+\b\s+(?:New|Open|Closed|Completed|Pending)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
    ) || ""
  );

  const maintenanceLimit =
    extractFirstMatch(compact, /Maintenance Limit\s*\$?([0-9,]+\.\d{2}|[0-9,]+)/i) || "";

  const permissionToEnter =
    extractFirstMatch(compact, /Permission to Enter\s+(.*?)\s+Job Site\b/i) || "";

  const jobSiteBlock =
    extractFirstMatch(compact, /Job Site\s+(.*?)\s+Pet\(s\)\b/i) || "";

  const propertyAddress =
    extractFirstMatch(
      jobSiteBlock,
      /((?:\d{2,6}\s+[A-Za-z0-9.'#\-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Blvd|Boulevard|Terrace|Ter)(?:\s+[A-Za-z0-9.'#\-]+)*))/i
    ) || "";

  const city =
    extractFirstMatch(jobSiteBlock, /([A-Za-z .'-]+),\s*[A-Z]{2}\s*\d{5}/i) || "";

  const state =
    extractFirstMatch(jobSiteBlock, /[A-Za-z .'-]+,\s*([A-Z]{2})\s*\d{5}/i) || "WA";

  const zip =
    extractFirstMatch(jobSiteBlock, /[A-Za-z .'-]+,\s*[A-Z]{2}\s*(\d{5})/i) || "";

  const tenantNames = Array.from(
    compact.matchAll(
      /([A-Z][a-z]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z'-]+)+)\s+(?:Mobile|Phone)\s*-\s*\([0-9]{3}\)\s*[0-9\-]{8,}/g
    )
  )
    .map((m) => m[1]?.trim())
    .filter(Boolean)
    .join(", ");

  const tenantPhones = Array.from(
    compact.matchAll(/(?:Mobile|Phone)\s*-\s*(\([0-9]{3}\)\s*[0-9\-]{8,})/g)
  )
    .map((m) => m[1]?.trim())
    .filter((phone) => phone !== "(253) 584-8200" && phone !== "(253) 683-4549")
    .join(", ");

  const tenantEmails = Array.from(
    compact.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)
  )
    .map((m) => m[0])
    .filter(Boolean)
    .join(", ");

  const tenantAvailability =
    extractFirstMatch(compact, /Tenant Availability\s+(.*?)\s+Description\b/i) ||
    (compact.includes(" Anytime ") || compact.endsWith(" Anytime") || compact.includes("Anytime Tenant")
      ? "Anytime"
      : "");

  const pets =
    extractFirstMatch(compact, /Pet\(s\)\s+([^-][A-Za-z0-9 .,'()/-]*?)(?=\s+Maintenance Limit\b)/i) ||
    (compact.includes("Pet(s) --") ? "--" : "");

  const description =
    extractFirstMatch(compact, /Description\s+(.*?)\s+Issue Details\b/i) ||
    extractFirstMatch(compact, /Description\s+(.*?)\s+Created By:/i) ||
    "";

  const issueDetails =
    extractFirstMatch(compact, /Issue Details\s+(.*?)\s+Created By:/i) || "";

  const issueCategory =
    extractFirstMatch(compact, /Issue\s+([A-Za-z\/ ]+?)\s+Sparking or smoking\b/i) ||
    inferIssueCategory(`${description} ${issueDetails}`);

  const makeModel =
    extractFirstMatch(compact, /Make and model number\s*([A-Z0-9\-]+)/i) ||
    extractFirstMatch(compact, /Make\/model:\s*([A-Z0-9\-]+)/i) ||
    "";

  const applianceBits = extractApplianceInfo(`${description} ${issueDetails} ${makeModel}`);

  const safetyConcern = compact.match(/Sparking or smoking\s*No/i)
    ? "No sparking or smoking reported."
    : compact.match(/Sparking or smoking\s*Yes/i)
      ? "Sparking or smoking reported."
      : "";

  const accessNotes =
    permissionToEnter.toLowerCase().includes("tenant requests") ||
    permissionToEnter.toLowerCase().includes("gate")
      ? permissionToEnter
      : "";

  return {
    ...DEFAULT_EXTRACTED,
    workOrderNumber,
    status,
    createdOn,
    propertyAddress,
    city,
    state,
    zip,
    tenantNames,
    tenantPhones,
    tenantEmails,
    tenantAvailability,
    permissionToEnter,
    accessNotes,
    pets,
    maintenanceLimit: maintenanceLimit
      ? Number(maintenanceLimit.replace(/,/g, "")).toFixed(2)
      : "",
    issueCategory,
    issueSubcategory: "",
    applianceType: applianceBits.applianceType || issueCategory,
    brand: applianceBits.brand,
    model: makeModel || applianceBits.model,
    problemDescription: description,
    issueDetails,
    safetyConcern,
    requestedAction: "Inspect issue and advise what repair is recommended.",
  };
}

export default function WorkOrderPricingPage() {
  const supabase = createClient();

  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdf>({
    file: null,
    fileName: "",
  });

  const [rawPdfText, setRawPdfText] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedWorkOrder>(DEFAULT_EXTRACTED);
  const [classification, setClassification] = useState<JobClassification>(DEFAULT_CLASSIFICATION);
  const [pricing, setPricing] = useState<PricingBreakdown>(DEFAULT_PRICING);
  const [outputs, setOutputs] = useState<GeneratedOutputs>(DEFAULT_OUTPUTS);
  const [internalReview, setInternalReview] = useState<InternalReview>(DEFAULT_INTERNAL_REVIEW);
  const [savedRecords, setSavedRecords] = useState<SavedPricingRecord[]>([]);

  const [statusMessage, setStatusMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingPricing, setIsGeneratingPricing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  const subtotal = useMemo(() => {
    return (
      parseCurrencyInput(pricing.serviceCall) +
      parseCurrencyInput(pricing.labor) +
      parseCurrencyInput(pricing.materials) +
      parseCurrencyInput(pricing.disposal) +
      parseCurrencyInput(pricing.other)
    );
  }, [pricing]);

  async function handlePdfSelect(file: File | null) {
    if (!file) return;
    setUploadedPdf({
      file,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
    });
    setStatusMessage(`Loaded PDF: ${file.name}`);
  }

  function handleClearAll() {
    setUploadedPdf({ file: null, fileName: "" });
    setRawPdfText("");
    setExtractedData(DEFAULT_EXTRACTED);
    setClassification(DEFAULT_CLASSIFICATION);
    setPricing(DEFAULT_PRICING);
    setOutputs(DEFAULT_OUTPUTS);
    setInternalReview(DEFAULT_INTERNAL_REVIEW);
    setStatusMessage("Form cleared.");
  }

  async function extractPdfText(file: File) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const loadingTask = pdfjs.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => {
          if (typeof item === "object" && item !== null && "str" in item) {
            return String((item as { str: unknown }).str ?? "");
          }
          return "";
        })
        .join(" ");
      fullText += `\n${pageText}\n`;
    }

    return normalizeWhitespace(fullText);
  }

  async function handleExtractWorkOrder() {
    if (!uploadedPdf.file) {
      setStatusMessage("Choose a PDF first.");
      return;
    }

    setIsExtracting(true);
    setStatusMessage("Extracting PDF text...");

    try {
      const text = await extractPdfText(uploadedPdf.file);
      setRawPdfText(text);

      const parsed = parseWorkOrderText(text);
      const nextClassification = classifyWorkOrder(parsed);
      const rule = findPricingRule(parsed, nextClassification);
      const nextPricing = calculatePricing(rule, parsed, nextClassification);

      setExtractedData(parsed);
      setClassification(nextClassification);
      setPricing(nextPricing);
      setOutputs({
        vendorInstructions: buildVendorInstructions(parsed, nextClassification, nextPricing),
        ownerUpdate: buildOwnerUpdate(parsed, nextClassification, nextPricing),
        internalSummary: buildInternalSummary(parsed, nextClassification, nextPricing),
      });

      setStatusMessage("PDF extracted and work order fields populated.");
    } catch (error) {
      console.error(error);
      setStatusMessage("PDF extraction failed. Confirm pdfjs-dist is installed and try again.");
    } finally {
      setIsExtracting(false);
    }
  }

  function updateExtractedField<K extends keyof ExtractedWorkOrder>(field: K, value: ExtractedWorkOrder[K]) {
    setExtractedData((prev) => ({ ...prev, [field]: value }));
  }

  function updateClassificationField<K extends keyof JobClassification>(
    field: K,
    value: JobClassification[K]
  ) {
    setClassification((prev) => ({ ...prev, [field]: value }));
  }

  function updatePricingField<K extends keyof PricingBreakdown>(field: K, value: PricingBreakdown[K]) {
    setPricing((prev) => ({ ...prev, [field]: value }));
  }

  function updateInternalReviewField<K extends keyof InternalReview>(field: K, value: InternalReview[K]) {
    setInternalReview((prev) => ({ ...prev, [field]: value }));
  }

  async function handleGeneratePricing() {
    setIsGeneratingPricing(true);
    try {
      const nextClassification = classifyWorkOrder(extractedData);
      const rule = findPricingRule(extractedData, nextClassification);
      const nextPricing = calculatePricing(rule, extractedData, nextClassification);

      setClassification(nextClassification);
      setPricing(nextPricing);
      setOutputs((prev) => ({
        ...prev,
        internalSummary: buildInternalSummary(extractedData, nextClassification, nextPricing),
      }));
      setStatusMessage("Pricing refreshed.");
    } finally {
      setIsGeneratingPricing(false);
    }
  }

  function handleGenerateVendorInstructions() {
    const text = buildVendorInstructions(extractedData, classification, pricing);
    setOutputs((prev) => ({ ...prev, vendorInstructions: text }));
    setStatusMessage("Vendor instructions generated.");
  }

  function handleGenerateOwnerUpdate() {
    const text = buildOwnerUpdate(extractedData, classification, pricing);
    setOutputs((prev) => ({ ...prev, ownerUpdate: text }));
    setStatusMessage("Owner update generated.");
  }

  function handleGenerateAllOutputs() {
    const vendorInstructions = buildVendorInstructions(extractedData, classification, pricing);
    const ownerUpdate = buildOwnerUpdate(extractedData, classification, pricing);
    const internalSummary = buildInternalSummary(extractedData, classification, pricing);

    setOutputs({
      vendorInstructions,
      ownerUpdate,
      internalSummary,
    });
    setStatusMessage("All outputs generated.");
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(`${label} copied.`);
    } catch {
      setStatusMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function handleSaveRecord() {
    setIsSaving(true);
    setStatusMessage("Saving record...");

    try {
      const payload = {
        file_name: uploadedPdf.fileName || null,
        raw_pdf_text: rawPdfText || null,

        work_order_number: extractedData.workOrderNumber || null,
        status: extractedData.status || null,
        created_on: extractedData.createdOn || null,
        estimate_requested_on: extractedData.estimateRequestedOn || null,
        estimate_amount: extractedData.estimateAmount || null,
        estimated_on: extractedData.estimatedOn || null,
        scheduled_on: extractedData.scheduledOn || null,
        completed_on: extractedData.completedOn || null,

        property_address: extractedData.propertyAddress || null,
        city: extractedData.city || null,
        state: extractedData.state || null,
        zip: extractedData.zip || null,
        unit: extractedData.unit || null,

        tenant_names: extractedData.tenantNames || null,
        tenant_phones: extractedData.tenantPhones || null,
        tenant_emails: extractedData.tenantEmails || null,
        tenant_availability: extractedData.tenantAvailability || null,

        permission_to_enter: extractedData.permissionToEnter || null,
        access_notes: extractedData.accessNotes || null,
        pets: extractedData.pets || null,
        maintenance_limit: extractedData.maintenanceLimit || null,

        issue_category: extractedData.issueCategory || null,
        issue_subcategory: extractedData.issueSubcategory || null,
        appliance_type: extractedData.applianceType || null,
        brand: extractedData.brand || null,
        model: extractedData.model || null,

        problem_description: extractedData.problemDescription || null,
        issue_details: extractedData.issueDetails || null,
        safety_concern: extractedData.safetyConcern || null,

        vendor_assigned: extractedData.vendorAssigned || null,
        requested_action: extractedData.requestedAction || null,

        trade_category: classification.tradeCategory || null,
        job_type: classification.jobType || null,
        severity: classification.severity || null,
        occupancy_status: classification.occupancyStatus || null,
        access_complexity: classification.accessComplexity || null,
        recommended_path: classification.recommendedPath || null,
        confidence: classification.confidence || null,

        pricing_rule_used: pricing.pricingRuleUsed || null,
        service_call: parseCurrencyInput(pricing.serviceCall),
        labor: parseCurrencyInput(pricing.labor),
        materials: parseCurrencyInput(pricing.materials),
        disposal: parseCurrencyInput(pricing.disposal),
        other_amount: parseCurrencyInput(pricing.other),
        tax_rate: parseCurrencyInput(pricing.taxRate),
        tax_amount: parseCurrencyInput(pricing.taxAmount),
        total_amount: parseCurrencyInput(pricing.total),
        pricing_note: pricing.pricingNote || null,
        approval_needed: pricing.approvalNeeded,
        manual_review_required: pricing.manualReviewRequired,

        vendor_instructions: outputs.vendorInstructions || null,
        owner_update: outputs.ownerUpdate || null,
        internal_summary: outputs.internalSummary || null,

        assigned_to: internalReview.assignedTo || null,
        record_status: internalReview.status || null,
        follow_up_date: internalReview.followUpDate || null,
        internal_notes: internalReview.internalNotes || null,
      };

      const { error } = await supabase.from("work_order_pricing_records").insert(payload);

      if (error) throw error;

      setStatusMessage("Record saved.");
      await handleLoadSavedRecords();
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Save failed.";
      setStatusMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLoadSavedRecords() {
    setIsLoadingRecords(true);
    try {
      const { data, error } = await supabase
        .from("work_order_pricing_records")
        .select(
          "id, created_at, file_name, work_order_number, property_address, issue_category, job_type, total_amount, record_status"
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setSavedRecords((data as SavedPricingRecord[]) || []);
      setStatusMessage("Saved records loaded.");
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Could not load saved records.";
      setStatusMessage(message);
    } finally {
      setIsLoadingRecords(false);
    }
  }

  async function handleLoadSingleRecord(recordId: string) {
    try {
      const { data, error } = await supabase
        .from("work_order_pricing_records")
        .select("*")
        .eq("id", recordId)
        .single();

      if (error) throw error;

      setUploadedPdf({
        file: null,
        fileName: safeString(data.file_name),
      });

      setRawPdfText(safeString(data.raw_pdf_text));
      setExtractedData({
        ...DEFAULT_EXTRACTED,
        workOrderNumber: safeString(data.work_order_number),
        status: safeString(data.status),
        createdOn: formatDateForInput(safeString(data.created_on)),
        estimateRequestedOn: safeString(data.estimate_requested_on),
        estimateAmount: safeString(data.estimate_amount),
        estimatedOn: safeString(data.estimated_on),
        scheduledOn: safeString(data.scheduled_on),
        completedOn: safeString(data.completed_on),
        propertyAddress: safeString(data.property_address),
        city: safeString(data.city),
        state: safeString(data.state) || "WA",
        zip: safeString(data.zip),
        unit: safeString(data.unit),
        tenantNames: safeString(data.tenant_names),
        tenantPhones: safeString(data.tenant_phones),
        tenantEmails: safeString(data.tenant_emails),
        tenantAvailability: safeString(data.tenant_availability),
        permissionToEnter: safeString(data.permission_to_enter),
        accessNotes: safeString(data.access_notes),
        pets: safeString(data.pets),
        maintenanceLimit: safeString(data.maintenance_limit),
        issueCategory: safeString(data.issue_category),
        issueSubcategory: safeString(data.issue_subcategory),
        applianceType: safeString(data.appliance_type),
        brand: safeString(data.brand),
        model: safeString(data.model),
        problemDescription: safeString(data.problem_description),
        issueDetails: safeString(data.issue_details),
        safetyConcern: safeString(data.safety_concern),
        vendorAssigned: safeString(data.vendor_assigned),
        requestedAction: safeString(data.requested_action),
      });

      setClassification({
        ...DEFAULT_CLASSIFICATION,
        tradeCategory: safeString(data.trade_category),
        jobType: safeString(data.job_type),
        severity: safeString(data.severity) || "Low",
        occupancyStatus: safeString(data.occupancy_status) || "Occupied",
        accessComplexity: safeString(data.access_complexity) || "Easy",
        recommendedPath: safeString(data.recommended_path) || "Diagnose only",
        confidence: Number(data.confidence) || 0,
      });

      setPricing({
        ...DEFAULT_PRICING,
        pricingRuleUsed: safeString(data.pricing_rule_used),
        serviceCall: Number(data.service_call || 0).toFixed(2),
        labor: Number(data.labor || 0).toFixed(2),
        materials: Number(data.materials || 0).toFixed(2),
        disposal: Number(data.disposal || 0).toFixed(2),
        other: Number(data.other_amount || 0).toFixed(2),
        taxRate: Number(data.tax_rate || 10.5).toFixed(2),
        taxAmount: Number(data.tax_amount || 0).toFixed(2),
        total: Number(data.total_amount || 0).toFixed(2),
        pricingNote: safeString(data.pricing_note),
        approvalNeeded: Boolean(data.approval_needed),
        manualReviewRequired: Boolean(data.manual_review_required),
      });

      setOutputs({
        vendorInstructions: safeString(data.vendor_instructions),
        ownerUpdate: safeString(data.owner_update),
        internalSummary: safeString(data.internal_summary),
      });

      setInternalReview({
        assignedTo: safeString(data.assigned_to),
        status: safeString(data.record_status) || "New",
        followUpDate: formatDateForInput(safeString(data.follow_up_date)),
        internalNotes: safeString(data.internal_notes),
      });

      setStatusMessage("Saved record loaded.");
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Could not load record.";
      setStatusMessage(message);
    }
  }

  async function handleDeleteRecord(recordId: string) {
    try {
      const { error } = await supabase.from("work_order_pricing_records").delete().eq("id", recordId);
      if (error) throw error;
      setSavedRecords((prev) => prev.filter((record) => record.id !== recordId));
      setStatusMessage("Record deleted.");
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Delete failed.";
      setStatusMessage(message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-900 px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-300">5Tools</p>
                <h1 className="mt-1 text-2xl font-semibold text-white">Work Order Pricing Assistant</h1>
                <p className="mt-2 text-sm text-slate-300">
                  Upload a work order PDF, extract details, generate pricing guidance, and create vendor / owner outputs.
                </p>
              </div>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
            <p className="text-sm text-slate-700">{statusMessage || "Ready."}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("PDF Intake", "Load a work order PDF and extract the text into editable fields.")}
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handlePdfSelect(e.target.files?.[0] || null)}
                  className="block w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleExtractWorkOrder}
                  disabled={!uploadedPdf.file || isExtracting}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExtracting ? "Extracting..." : "Extract Work Order"}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoBox label="Loaded File" value={uploadedPdf.fileName || "--"} />
                <InfoBox
                  label="Parser Confidence"
                  value={classification.confidence ? `${Math.round(classification.confidence * 100)}%` : "--"}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Extracted Work Order Data", "Review and correct anything the PDF parser missed.")}
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Work Order #"
                  value={extractedData.workOrderNumber}
                  onChange={(v) => updateExtractedField("workOrderNumber", v)}
                />
                <InputField
                  label="Status"
                  value={extractedData.status}
                  onChange={(v) => updateExtractedField("status", v)}
                />
                <InputField
                  label="Created On"
                  type="date"
                  value={extractedData.createdOn}
                  onChange={(v) => updateExtractedField("createdOn", v)}
                />
                <InputField
                  label="Maintenance Limit"
                  value={extractedData.maintenanceLimit}
                  onChange={(v) => updateExtractedField("maintenanceLimit", v)}
                />

                <InputField
                  label="Property Address"
                  value={extractedData.propertyAddress}
                  onChange={(v) => updateExtractedField("propertyAddress", v)}
                />
                <InputField label="Unit" value={extractedData.unit} onChange={(v) => updateExtractedField("unit", v)} />
                <InputField label="City" value={extractedData.city} onChange={(v) => updateExtractedField("city", v)} />
                <InputField label="State" value={extractedData.state} onChange={(v) => updateExtractedField("state", v)} />
                <InputField label="Zip" value={extractedData.zip} onChange={(v) => updateExtractedField("zip", v)} />
                <InputField
                  label="Tenant Names"
                  value={extractedData.tenantNames}
                  onChange={(v) => updateExtractedField("tenantNames", v)}
                />
                <InputField
                  label="Tenant Phones"
                  value={extractedData.tenantPhones}
                  onChange={(v) => updateExtractedField("tenantPhones", v)}
                />
                <InputField
                  label="Tenant Emails"
                  value={extractedData.tenantEmails}
                  onChange={(v) => updateExtractedField("tenantEmails", v)}
                />
                <InputField
                  label="Tenant Availability"
                  value={extractedData.tenantAvailability}
                  onChange={(v) => updateExtractedField("tenantAvailability", v)}
                />
                <InputField
                  label="Permission to Enter"
                  value={extractedData.permissionToEnter}
                  onChange={(v) => updateExtractedField("permissionToEnter", v)}
                />
                <InputField
                  label="Access Notes"
                  value={extractedData.accessNotes}
                  onChange={(v) => updateExtractedField("accessNotes", v)}
                />
                <InputField label="Pets" value={extractedData.pets} onChange={(v) => updateExtractedField("pets", v)} />
                <InputField
                  label="Issue Category"
                  value={extractedData.issueCategory}
                  onChange={(v) => updateExtractedField("issueCategory", v)}
                />
                <InputField
                  label="Issue Subcategory"
                  value={extractedData.issueSubcategory}
                  onChange={(v) => updateExtractedField("issueSubcategory", v)}
                />
                <InputField
                  label="Appliance Type"
                  value={extractedData.applianceType}
                  onChange={(v) => updateExtractedField("applianceType", v)}
                />
                <InputField
                  label="Brand"
                  value={extractedData.brand}
                  onChange={(v) => updateExtractedField("brand", v)}
                />
                <InputField
                  label="Model"
                  value={extractedData.model}
                  onChange={(v) => updateExtractedField("model", v)}
                />
                <InputField
                  label="Safety Concern"
                  value={extractedData.safetyConcern}
                  onChange={(v) => updateExtractedField("safetyConcern", v)}
                />
                <InputField
                  label="Vendor Assigned"
                  value={extractedData.vendorAssigned}
                  onChange={(v) => updateExtractedField("vendorAssigned", v)}
                />
                <InputField
                  label="Requested Action"
                  value={extractedData.requestedAction}
                  onChange={(v) => updateExtractedField("requestedAction", v)}
                />
              </div>

              <div className="mt-4 grid gap-4">
                <TextAreaField
                  label="Problem Description"
                  value={extractedData.problemDescription}
                  onChange={(v) => updateExtractedField("problemDescription", v)}
                />
                <TextAreaField
                  label="Issue Details"
                  value={extractedData.issueDetails}
                  onChange={(v) => updateExtractedField("issueDetails", v)}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Job Classification", "Pricing rules use this section, so keep it operational and simple.")}
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Trade Category"
                  value={classification.tradeCategory}
                  onChange={(v) => updateClassificationField("tradeCategory", v)}
                  options={[
                    "",
                    "Appliance",
                    "Plumbing",
                    "Electrical",
                    "Carpentry",
                    "Cleaning",
                    "Flooring",
                    "General Maintenance",
                  ]}
                />
                <InputField
                  label="Job Type"
                  value={classification.jobType}
                  onChange={(v) => updateClassificationField("jobType", v)}
                />
                <SelectField
                  label="Severity"
                  value={classification.severity}
                  onChange={(v) => updateClassificationField("severity", v)}
                  options={["Low", "Medium", "High"]}
                />
                <SelectField
                  label="Occupancy Status"
                  value={classification.occupancyStatus}
                  onChange={(v) => updateClassificationField("occupancyStatus", v)}
                  options={["Occupied", "Vacant"]}
                />
                <SelectField
                  label="Access Complexity"
                  value={classification.accessComplexity}
                  onChange={(v) => updateClassificationField("accessComplexity", v)}
                  options={["Easy", "Moderate", "Difficult"]}
                />
                <SelectField
                  label="Recommended Path"
                  value={classification.recommendedPath}
                  onChange={(v) => updateClassificationField("recommendedPath", v)}
                  options={["Diagnose only", "Repair likely", "Replace likely", "Manual review"]}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGeneratePricing}
                  disabled={isGeneratingPricing}
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {isGeneratingPricing ? "Generating..." : "Generate Pricing"}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateVendorInstructions}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Generate Vendor Instructions
                </button>
                <button
                  type="button"
                  onClick={handleGenerateOwnerUpdate}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Generate Owner Update
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAllOutputs}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Generate All
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Pricing Summary", "Manual override is allowed. The app should help, not trap you.")}
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Pricing Rule Used"
                  value={pricing.pricingRuleUsed}
                  onChange={(v) => updatePricingField("pricingRuleUsed", v)}
                />
                <InputField
                  label="Service Call"
                  value={pricing.serviceCall}
                  onChange={(v) => updatePricingField("serviceCall", v)}
                />
                <InputField label="Labor" value={pricing.labor} onChange={(v) => updatePricingField("labor", v)} />
                <InputField
                  label="Materials"
                  value={pricing.materials}
                  onChange={(v) => updatePricingField("materials", v)}
                />
                <InputField
                  label="Disposal"
                  value={pricing.disposal}
                  onChange={(v) => updatePricingField("disposal", v)}
                />
                <InputField label="Other" value={pricing.other} onChange={(v) => updatePricingField("other", v)} />
                <InputField
                  label="Tax Rate %"
                  value={pricing.taxRate}
                  onChange={(v) => updatePricingField("taxRate", v)}
                />
                <InputField
                  label="Tax Amount"
                  value={pricing.taxAmount}
                  onChange={(v) => updatePricingField("taxAmount", v)}
                />
                <InputField label="Total" value={pricing.total} onChange={(v) => updatePricingField("total", v)} />
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <InfoBox label="Subtotal" value={formatCurrency(subtotal)} />
                  <InfoBox label="Tax" value={formatCurrency(parseCurrencyInput(pricing.taxAmount))} />
                  <InfoBox label="Total" value={formatCurrency(parseCurrencyInput(pricing.total))} />
                  <InfoBox label="Approval Needed" value={pricing.approvalNeeded ? "Yes" : "No"} />
                </div>
              </div>

              <div className="mt-4">
                <TextAreaField
                  label="Pricing Note"
                  value={pricing.pricingNote}
                  onChange={(v) => updatePricingField("pricingNote", v)}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Vendor Instructions")}
              <TextAreaField
                label="Vendor Instructions"
                value={outputs.vendorInstructions}
                onChange={(v) => setOutputs((prev) => ({ ...prev, vendorInstructions: v }))}
                rows={16}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => copyToClipboard(outputs.vendorInstructions, "Vendor instructions")}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Copy Vendor Instructions
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Owner Update")}
              <TextAreaField
                label="Owner Update"
                value={outputs.ownerUpdate}
                onChange={(v) => setOutputs((prev) => ({ ...prev, ownerUpdate: v }))}
                rows={12}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => copyToClipboard(outputs.ownerUpdate, "Owner update")}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Copy Owner Update
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Internal Review")}
              <div className="grid gap-4">
                <InputField
                  label="Assigned To"
                  value={internalReview.assignedTo}
                  onChange={(v) => updateInternalReviewField("assignedTo", v)}
                />
                <SelectField
                  label="Status"
                  value={internalReview.status}
                  onChange={(v) => updateInternalReviewField("status", v)}
                  options={["New", "Pending", "Waiting on Vendor", "Waiting on Approval", "Completed"]}
                />
                <InputField
                  label="Follow-Up Date"
                  type="date"
                  value={internalReview.followUpDate}
                  onChange={(v) => updateInternalReviewField("followUpDate", v)}
                />
                <TextAreaField
                  label="Internal Notes"
                  value={internalReview.internalNotes}
                  onChange={(v) => updateInternalReviewField("internalNotes", v)}
                  rows={6}
                />
                <TextAreaField
                  label="Internal Summary"
                  value={outputs.internalSummary}
                  onChange={(v) => setOutputs((prev) => ({ ...prev, internalSummary: v }))}
                  rows={8}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveRecord}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Record"}
                </button>
                <button
                  type="button"
                  onClick={handleLoadSavedRecords}
                  disabled={isLoadingRecords}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {isLoadingRecords ? "Loading..." : "Load Saved Records"}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Saved Records")}
              <div className="space-y-3">
                {savedRecords.length === 0 ? (
                  <p className="text-sm text-slate-500">No saved records loaded.</p>
                ) : (
                  savedRecords.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {record.work_order_number || "No Work Order #"} — {record.property_address || "No address"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {record.issue_category || "No category"} / {record.job_type || "No job type"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Total: {record.total_amount != null ? formatCurrency(Number(record.total_amount)) : "--"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {record.created_at ? new Date(record.created_at).toLocaleString() : "--"}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadSingleRecord(record.id)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {sectionCard("Raw PDF Text")}
              <textarea
                value={rawPdfText}
                onChange={(e) => setRawPdfText(e.target.value)}
                rows={18}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-400"
              />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || "--"}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={type === "date" ? formatDateForInput(value) : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "Select"}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400"
      />
    </label>
  );
}