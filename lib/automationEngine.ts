export type AutomationTrigger =
  | "work-order-created"
  | "work-order-status-changed"
  | "report-item-flagged"
  | "invoice-created"
  | "scheduler-task-overdue"
  | "service-ticket-created";

export type AutomationCondition =
  | "always"
  | "priority-is-emergency"
  | "status-is-approved"
  | "has-photos"
  | "assigned-vendor-exists";

export type AutomationAction =
  | "create-scheduler-task"
  | "create-service-ticket"
  | "notify-manager"
  | "create-invoice-draft"
  | "create-report";

export type AutomationEventPayload = {
  id?: string;
  title?: string;
  property?: string;
  unit?: string;
  priority?: string;
  status?: string;
  description?: string;
  vendor?: string;
  photos?: string[];
  sourceModule?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export type AutomationEvent = {
  trigger: AutomationTrigger;
  payload: AutomationEventPayload;
};

export type AutomationRule = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  condition: AutomationCondition;
  actions: AutomationAction[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type AutomationActionResult = {
  action: AutomationAction;
  success: boolean;
  message: string;
  createdRecord?: Record<string, unknown>;
};

export type AutomationRunResult = {
  ruleId: string;
  ruleName: string;
  trigger: AutomationTrigger;
  conditionMatched: boolean;
  actionsRun: AutomationActionResult[];
  ranAt: string;
};

const STORAGE_KEY = "fiveToolsAutomationRules";
const HISTORY_KEY = "fiveToolsAutomationHistory";

export const defaultAutomationRules: AutomationRule[] = [
  {
    id: "emergency-work-order-flow",
    name: "Emergency Work Order Flow",
    trigger: "work-order-created",
    condition: "priority-is-emergency",
    actions: [
      "create-scheduler-task",
      "create-service-ticket",
      "notify-manager",
    ],
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "flagged-report-item-flow",
    name: "Flagged Report Item Flow",
    trigger: "report-item-flagged",
    condition: "always",
    actions: ["create-scheduler-task", "create-service-ticket", "notify-manager"],
    active: true,
    createdAt: new Date().toISOString(),
  },
];

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getAutomationRules(): AutomationRule[] {
  const saved = readJson<AutomationRule[]>(STORAGE_KEY, []);

  if (!saved.length) {
    writeJson(STORAGE_KEY, defaultAutomationRules);
    return defaultAutomationRules;
  }

  return saved;
}

export function saveAutomationRules(rules: AutomationRule[]) {
  writeJson(STORAGE_KEY, rules);
}

export function registerRule(rule: AutomationRule) {
  const rules = getAutomationRules();
  const existingIndex = rules.findIndex((item) => item.id === rule.id);

  const cleanRule: AutomationRule = {
    ...rule,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    rules[existingIndex] = cleanRule;
  } else {
    rules.push(cleanRule);
  }

  saveAutomationRules(rules);
  return cleanRule;
}

export function deleteRule(ruleId: string) {
  const rules = getAutomationRules().filter((rule) => rule.id !== ruleId);
  saveAutomationRules(rules);
  return rules;
}

export function getAutomationHistory(): AutomationRunResult[] {
  return readJson<AutomationRunResult[]>(HISTORY_KEY, []);
}

export function saveAutomationHistory(history: AutomationRunResult[]) {
  writeJson(HISTORY_KEY, history.slice(0, 100));
}

export function clearAutomationHistory() {
  writeJson(HISTORY_KEY, []);
}

function conditionMatches(
  condition: AutomationCondition,
  payload: AutomationEventPayload,
) {
  switch (condition) {
    case "always":
      return true;
    case "priority-is-emergency":
      return String(payload.priority || "").toLowerCase() === "emergency";
    case "status-is-approved":
      return String(payload.status || "").toLowerCase() === "approved";
    case "has-photos":
      return Array.isArray(payload.photos) && payload.photos.length > 0;
    case "assigned-vendor-exists":
      return Boolean(payload.vendor);
    default:
      return false;
  }
}

function createSchedulerTask(payload: AutomationEventPayload): AutomationActionResult {
  const task = {
    id: `schedule-${Date.now()}`,
    title: payload.title || "Automated Scheduler Task",
    property: payload.property || "Unassigned Property",
    priority: payload.priority || "Normal",
    description: payload.description || "Created by 5 Tools Automation Engine.",
    status: "Pending",
    createdAt: new Date().toISOString(),
  };

  const existing = readJson<Record<string, unknown>[]>("fiveToolsSchedulerTasks", []);
  writeJson("fiveToolsSchedulerTasks", [task, ...existing]);

  return {
    action: "create-scheduler-task",
    success: true,
    message: "Scheduler task created.",
    createdRecord: task,
  };
}

function createServiceTicket(payload: AutomationEventPayload): AutomationActionResult {
  const ticket = {
    id: `ticket-${Date.now()}`,
    title: payload.title || "Automated Service Ticket",
    property: payload.property || "Unassigned Property",
    unit: payload.unit || "",
    priority: payload.priority || "Normal",
    description: payload.description || "Created by 5 Tools Automation Engine.",
    sourceModule: payload.sourceModule || "automation-center",
    status: "New",
    createdAt: new Date().toISOString(),
  };

  const existing = readJson<Record<string, unknown>[]>("fiveToolsServiceTickets", []);
  writeJson("fiveToolsServiceTickets", [ticket, ...existing]);

  return {
    action: "create-service-ticket",
    success: true,
    message: "Service ticket created.",
    createdRecord: ticket,
  };
}

function notifyManager(payload: AutomationEventPayload): AutomationActionResult {
  const notice = {
    id: `notice-${Date.now()}`,
    title: payload.title || "5 Tools Automation Alert",
    message:
      payload.description ||
      `${payload.trigger || "Automation"} requires manager review.`,
    priority: payload.priority || "Normal",
    property: payload.property || "Unassigned Property",
    createdAt: new Date().toISOString(),
    read: false,
  };

  const existing = readJson<Record<string, unknown>[]>("fiveToolsNotifications", []);
  writeJson("fiveToolsNotifications", [notice, ...existing]);

  return {
    action: "notify-manager",
    success: true,
    message: "Manager notification created.",
    createdRecord: notice,
  };
}

function createInvoiceDraft(payload: AutomationEventPayload): AutomationActionResult {
  const invoice = {
    id: `invoice-draft-${Date.now()}`,
    title: payload.title || "Automated Invoice Draft",
    property: payload.property || "Unassigned Property",
    status: "Draft",
    description: payload.description || "Created by 5 Tools Automation Engine.",
    createdAt: new Date().toISOString(),
  };

  const existing = readJson<Record<string, unknown>[]>("fiveToolsInvoiceDrafts", []);
  writeJson("fiveToolsInvoiceDrafts", [invoice, ...existing]);

  return {
    action: "create-invoice-draft",
    success: true,
    message: "Invoice draft created.",
    createdRecord: invoice,
  };
}

function createReport(payload: AutomationEventPayload): AutomationActionResult {
  const report = {
    id: `report-${Date.now()}`,
    title: payload.title || "Automated Report",
    property: payload.property || "Unassigned Property",
    status: "Draft",
    description: payload.description || "Created by 5 Tools Automation Engine.",
    photos: payload.photos || [],
    createdAt: new Date().toISOString(),
  };

  const existing = readJson<Record<string, unknown>[]>("fiveToolsReports", []);
  writeJson("fiveToolsReports", [report, ...existing]);

  return {
    action: "create-report",
    success: true,
    message: "Report draft created.",
    createdRecord: report,
  };
}

function runAction(
  action: AutomationAction,
  payload: AutomationEventPayload,
): AutomationActionResult {
  switch (action) {
    case "create-scheduler-task":
      return createSchedulerTask(payload);
    case "create-service-ticket":
      return createServiceTicket(payload);
    case "notify-manager":
      return notifyManager(payload);
    case "create-invoice-draft":
      return createInvoiceDraft(payload);
    case "create-report":
      return createReport(payload);
    default:
      return {
        action,
        success: false,
        message: "Unknown automation action.",
      };
  }
}

export function runActions(
  actions: AutomationAction[],
  payload: AutomationEventPayload,
): AutomationActionResult[] {
  return actions.map((action) => runAction(action, payload));
}

export function triggerEvent(event: AutomationEvent): AutomationRunResult[] {
  const rules = getAutomationRules();
  const matchingRules = rules.filter(
    (rule) => rule.active && rule.trigger === event.trigger,
  );

  const results: AutomationRunResult[] = matchingRules.map((rule) => {
    const matched = conditionMatches(rule.condition, event.payload);

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      trigger: event.trigger,
      conditionMatched: matched,
      actionsRun: matched ? runActions(rule.actions, event.payload) : [],
      ranAt: new Date().toISOString(),
    };
  });

  const history = getAutomationHistory();
  saveAutomationHistory([...results, ...history]);

  return results;
}

export function runEmergencyWorkOrderTest() {
  return triggerEvent({
    trigger: "work-order-created",
    payload: {
      id: `wo-test-${Date.now()}`,
      title: "Emergency Work Order Test",
      property: "Test Property",
      unit: "Test Unit",
      priority: "Emergency",
      status: "New",
      description:
        "Test emergency work order generated from the 5 Tools Automation Engine.",
      sourceModule: "automation-center",
      createdAt: new Date().toISOString(),
    },
  });
}
