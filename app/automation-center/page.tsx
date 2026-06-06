"use client";

import { useMemo, useState } from "react";
import FiveToolsShell from "../../components/FiveToolsShell";

type FlowStatus = "Active" | "Paused";
type TriggerType =
  | "New Work Order Created"
  | "Work Order Status Changed"
  | "Report Item Flagged"
  | "Invoice Created"
  | "Service Ticket Created";
type ConditionType =
  | "Priority is Emergency"
  | "Status is Approved"
  | "Has Photos"
  | "Assigned Vendor Exists"
  | "No Condition";
type ActionType =
  | "Create Scheduler Task"
  | "Create Service Ticket"
  | "Notify Eric"
  | "Add to Invoice Queue"
  | "Create Follow-Up Reminder";

type AutomationFlow = {
  id: number;
  name: string;
  trigger: TriggerType;
  condition: ConditionType;
  actions: ActionType[];
  status: FlowStatus;
  lastRun: string;
};

type HistoryItem = {
  id: number;
  flowName: string;
  result: string;
  time: string;
};

const triggers: TriggerType[] = [
  "New Work Order Created",
  "Work Order Status Changed",
  "Report Item Flagged",
  "Invoice Created",
  "Service Ticket Created",
];

const conditions: ConditionType[] = [
  "Priority is Emergency",
  "Status is Approved",
  "Has Photos",
  "Assigned Vendor Exists",
  "No Condition",
];

const actions: ActionType[] = [
  "Create Scheduler Task",
  "Create Service Ticket",
  "Notify Eric",
  "Add to Invoice Queue",
  "Create Follow-Up Reminder",
];

const starterFlows: AutomationFlow[] = [
  {
    id: 1,
    name: "Emergency Work Order Dispatch",
    trigger: "New Work Order Created",
    condition: "Priority is Emergency",
    actions: ["Create Scheduler Task", "Notify Eric"],
    status: "Active",
    lastRun: "Ready",
  },
  {
    id: 2,
    name: "Flagged Report Follow-Up",
    trigger: "Report Item Flagged",
    condition: "Has Photos",
    actions: ["Create Service Ticket", "Create Follow-Up Reminder"],
    status: "Active",
    lastRun: "Ready",
  },
  {
    id: 3,
    name: "Approved Invoice Queue",
    trigger: "Invoice Created",
    condition: "Status is Approved",
    actions: ["Add to Invoice Queue"],
    status: "Paused",
    lastRun: "Paused",
  },
];

function nowStamp() {
  return new Date().toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FlowCard({
  flow,
  onRun,
  onToggle,
}: {
  flow: AutomationFlow;
  onRun: (id: number) => void;
  onToggle: (id: number) => void;
}) {
  return (
    <div className="rounded-3xl border border-[#b88a35]/60 bg-[#241509]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4a640]">
            Automation Flow
          </p>
          <h3 className="mt-2 text-2xl font-black text-[#fff5df]">
            {flow.name}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => onToggle(flow.id)}
          className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
            flow.status === "Active"
              ? "border-[#d4a640] bg-[#d4a640] text-[#241509] hover:bg-[#f0c96d]"
              : "border-[#8b6b3e] bg-[#3b2a18] text-[#d8c4a0] hover:bg-[#50371f]"
          }`}
        >
          {flow.status}
        </button>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-[#f3e4c4]">
        <div className="rounded-2xl border border-[#7c5725] bg-[#120a05]/70 p-4">
          <span className="font-black text-[#d4a640]">WHEN </span>
          {flow.trigger}
        </div>
        <div className="rounded-2xl border border-[#7c5725] bg-[#120a05]/70 p-4">
          <span className="font-black text-[#d4a640]">IF </span>
          {flow.condition}
        </div>
        <div className="rounded-2xl border border-[#7c5725] bg-[#120a05]/70 p-4">
          <span className="font-black text-[#d4a640]">THEN </span>
          {flow.actions.join(" + ")}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#bfa77b]">
          Last Run: {flow.lastRun}
        </p>
        <button
          type="button"
          onClick={() => onRun(flow.id)}
          className="rounded-2xl border border-[#d4a640] bg-[#8a5a18] px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:bg-[#b98525]"
        >
          Run Test Flow
        </button>
      </div>
    </div>
  );
}

export default function AutomationCenterPage() {
  const [flows, setFlows] = useState<AutomationFlow[]>(starterFlows);
  const [flowName, setFlowName] = useState("New Custom Flow");
  const [trigger, setTrigger] = useState<TriggerType>("New Work Order Created");
  const [condition, setCondition] = useState<ConditionType>("Priority is Emergency");
  const [selectedAction, setSelectedAction] = useState<ActionType>("Create Scheduler Task");
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 1,
      flowName: "System Ready",
      result: "Automation Center loaded and ready for test flows.",
      time: nowStamp(),
    },
  ]);

  const activeCount = useMemo(
    () => flows.filter((flow) => flow.status === "Active").length,
    [flows]
  );

  function addHistory(flowNameValue: string, result: string) {
    setHistory((current) => [
      { id: Date.now(), flowName: flowNameValue, result, time: nowStamp() },
      ...current,
    ]);
  }

  function runFlow(id: number) {
    const flow = flows.find((item) => item.id === id);
    if (!flow) return;

    if (flow.status !== "Active") {
      addHistory(flow.name, "Flow was paused. No action was taken.");
      return;
    }

    const result = `Triggered: ${flow.trigger}. Condition checked: ${flow.condition}. Actions completed: ${flow.actions.join(
      ", "
    )}.`;

    setFlows((current) =>
      current.map((item) =>
        item.id === id ? { ...item, lastRun: nowStamp() } : item
      )
    );

    addHistory(flow.name, result);
  }

  function toggleFlow(id: number) {
    setFlows((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "Active" ? "Paused" : "Active",
              lastRun: item.status === "Active" ? "Paused" : "Ready",
            }
          : item
      )
    );
  }

  function createFlow() {
    const newFlow: AutomationFlow = {
      id: Date.now(),
      name: flowName.trim() || "New Custom Flow",
      trigger,
      condition,
      actions: [selectedAction],
      status: "Active",
      lastRun: "Ready",
    };

    setFlows((current) => [newFlow, ...current]);
    addHistory(newFlow.name, "New automation flow created.");
    setFlowName("New Custom Flow");
  }

  return (
    <FiveToolsShell
      title="Automation Center"
      subtitle="Build and test 5 Tools workflow automations"
    >
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[#7c5725] pb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-[#d4a640]">
                Builder
              </p>
              <h2 className="mt-2 text-3xl font-black text-[#fff5df]">
                Create a Flow
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#e6d2aa]">
                Build simple 5 Tools automations using WHEN, IF, and THEN rules.
                This version runs locally so you can test workflow logic before
                wiring it into Supabase and live modules.
              </p>
            </div>

            <div className="rounded-2xl border border-[#d4a640]/60 bg-[#0f0804]/75 px-5 py-4 text-right">
              <p className="text-3xl font-black text-[#f3c45d]">{activeCount}</p>
              <p className="text-xs font-black uppercase tracking-wide text-[#c9b58e]">
                Active Flows
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                Flow Name
              </span>
              <input
                value={flowName}
                onChange={(event) => setFlowName(event.target.value)}
                className="rounded-2xl border border-[#8d672e] bg-[#0f0804] px-4 py-3 text-sm font-bold text-[#fff5df] outline-none transition placeholder:text-[#8f7a55] focus:border-[#d4a640]"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                WHEN Trigger
              </span>
              <select
                value={trigger}
                onChange={(event) => setTrigger(event.target.value as TriggerType)}
                className="rounded-2xl border border-[#8d672e] bg-[#0f0804] px-4 py-3 text-sm font-bold text-[#fff5df] outline-none transition focus:border-[#d4a640]"
              >
                {triggers.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                IF Condition
              </span>
              <select
                value={condition}
                onChange={(event) => setCondition(event.target.value as ConditionType)}
                className="rounded-2xl border border-[#8d672e] bg-[#0f0804] px-4 py-3 text-sm font-bold text-[#fff5df] outline-none transition focus:border-[#d4a640]"
              >
                {conditions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#d4a640]">
                THEN Action
              </span>
              <select
                value={selectedAction}
                onChange={(event) => setSelectedAction(event.target.value as ActionType)}
                className="rounded-2xl border border-[#8d672e] bg-[#0f0804] px-4 py-3 text-sm font-bold text-[#fff5df] outline-none transition focus:border-[#d4a640]"
              >
                {actions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={createFlow}
            className="mt-6 w-full rounded-2xl border border-[#f3c45d] bg-[#b0771e] px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl transition hover:bg-[#d49a35]"
          >
            Create Automation Flow
          </button>
        </div>

        <aside className="rounded-[2rem] border border-[#d4a640]/50 bg-[#1d1008]/88 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-[#d4a640]">
            Activity
          </p>
          <h2 className="mt-2 text-3xl font-black text-[#fff5df]">
            History Log
          </h2>

          <div className="mt-6 grid max-h-[520px] gap-3 overflow-auto pr-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#765222] bg-[#100804]/80 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-black text-[#f6d27a]">{item.flowName}</h3>
                  <span className="shrink-0 text-xs font-bold text-[#bfa77b]">
                    {item.time}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#e7d5b3]">
                  {item.result}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        {flows.map((flow) => (
          <FlowCard
            key={flow.id}
            flow={flow}
            onRun={runFlow}
            onToggle={toggleFlow}
          />
        ))}
      </section>
    </FiveToolsShell>
  );
}
