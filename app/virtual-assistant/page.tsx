"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type AssistantItem = {
  id: string;
  type: "Task" | "Reminder" | "Work Order" | "Note";
  title: string;
  details: string;
  createdAt: string;
  status: "Open" | "Done";
};

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const STORAGE_KEY = "five_tools_virtual_assistant_items_v1";

const quickActions = [
  { label: "Work Orders", href: "/work-order-engine" },
  { label: "Pricing Notebook", href: "/work-order-pricing" },
  { label: "Scheduler", href: "/project-scheduler" },
  { label: "Projects", href: "/project-tracker" },
  { label: "Reports", href: "/inspections" },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseCommand(raw: string): Omit<AssistantItem, "id" | "createdAt" | "status"> {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (lower.startsWith("add task")) {
    return {
      type: "Task",
      title: text.replace(/^add task/i, "").trim() || "New task",
      details: text,
    };
  }

  if (lower.startsWith("add reminder")) {
    return {
      type: "Reminder",
      title: text.replace(/^add reminder/i, "").trim() || "New reminder",
      details: text,
    };
  }

  if (lower.startsWith("add work order")) {
    return {
      type: "Work Order",
      title: text.replace(/^add work order/i, "").trim() || "New work order",
      details: text,
    };
  }

  return {
    type: "Note",
    title: text || "New note",
    details: text,
  };
}

export default function VirtualAssistantPage() {
  const [items, setItems] = useState<AssistantItem[]>([]);
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("Ready.");
  const recognitionRef = useRef<any>(null);

  const speechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch {
        setItems([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!speechSupported) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListening(true);
      setMessage("Listening...");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setCommand(transcript);
      processCommand(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      setMessage("Voice command failed. Try again or type the command.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, [speechSupported]);

  function processCommand(input: string) {
    const clean = input.trim();
    if (!clean) {
      setMessage("No command entered.");
      return;
    }

    const lower = clean.toLowerCase();

    if (lower === "clear command") {
      setCommand("");
      setMessage("Command cleared.");
      return;
    }

    if (lower === "show tasks") {
      setMessage("Showing open tasks.");
      return;
    }

    const parsed = parseCommand(clean);

    const newItem: AssistantItem = {
      id: makeId(),
      ...parsed,
      createdAt: new Date().toLocaleString(),
      status: "Open",
    };

    setItems((prev) => [newItem, ...prev]);
    setMessage(`Added ${newItem.type}: ${newItem.title}`);
  }

  function startListening() {
    if (!recognitionRef.current) {
      setMessage("Voice commands are not supported in this browser.");
      return;
    }

    try {
      recognitionRef.current.start();
    } catch {
      setMessage("Voice command is already active.");
    }
  }

  function toggleDone(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "Open" ? "Done" : "Open" }
          : item
      )
    );
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const openItems = items.filter((item) => item.status === "Open");
  const doneItems = items.filter((item) => item.status === "Done");

  return (
    <main className="min-h-screen bg-[#ece3d4] text-[#1b1b1b]">
      <header className="border-b border-[#a98a67] bg-[#f7f1e7] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-8">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-[#2e1f12]">
              5Tools
            </h1>

            <p className="mt-2 text-xs font-bold uppercase tracking-[0.35em] text-[#9c6b2f]">
              Virtual Assistant
            </p>
          </div>

          <div className="hidden gap-10 text-right text-sm font-bold text-[#5a4633] md:flex">
            <div>
              <p>253.584.8200</p>
              <p className="text-xs uppercase text-[#8a7a68]">Call Us</p>
            </div>

            <div>
              <p>Tacoma, Washington</p>
              <p className="text-xs uppercase text-[#8a7a68]">Service Area</p>
            </div>
          </div>
        </div>

        <nav className="border-t border-[#8b6b47] bg-[#4d3624] shadow-inner">
          <div className="mx-auto flex max-w-7xl flex-wrap px-8">
            <Link
              href="/"
              className="border-b-4 border-transparent px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#f5ede2] transition hover:border-[#d4a66a] hover:bg-[#6b4a31]"
            >
              Dashboard
            </Link>
            {quickActions.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b-4 border-transparent px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#f5ede2] transition hover:border-[#d4a66a] hover:bg-[#6b4a31]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-[#b89b79]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#8b5e3c_0%,#9b6b45_8%,#7c5235_16%,#a7794f_24%,#7a5237_32%,#966845_40%,#7d5436_48%,#a1714b_56%,#815638_64%,#9c6d48_72%,#785033_80%,#a3734c_88%,#6d482d_100%)] opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-8 py-12 lg:grid-cols-[1fr_360px]">
          <div className="border border-[#d4b08a] bg-[rgba(35,20,10,0.78)] p-8 shadow-2xl backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#d4a66a]">
              Voice + Command Intake
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-[#fff8f0]">
              Virtual Assistant Command Center
            </h2>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#f3e8d8]">
              Capture spoken or typed instructions, create local task items, and
              keep quick links close for work orders, pricing, scheduling,
              project tracking, and reports.
            </p>
          </div>

          <aside className="rounded-md border border-[#b38b66] bg-[#f8f1e7]/95 p-6 shadow-2xl backdrop-blur-sm">
            <h3 className="border-b border-[#d8c0a4] pb-3 text-2xl font-black text-[#2f1f14]">
              Status
            </h3>
            <div className="mt-5 grid gap-3">
              <div className="border border-[#d8c0a4] bg-[#fffaf3] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#9c6b2f]">
                  Open Items
                </p>
                <p className="mt-1 text-3xl font-black text-[#2f1f14]">
                  {openItems.length}
                </p>
              </div>
              <div className="border border-[#d8c0a4] bg-[#fffaf3] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#9c6b2f]">
                  Completed
                </p>
                <p className="mt-1 text-3xl font-black text-[#2f1f14]">
                  {doneItems.length}
                </p>
              </div>
              <div className="border border-[#d8c0a4] bg-[#fffaf3] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#9c6b2f]">
                  Total Captured
                </p>
                <p className="mt-1 text-3xl font-black text-[#2f1f14]">
                  {items.length}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-8 py-10 lg:grid-cols-[1fr_320px]">
        <div className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
          <h3 className="text-2xl font-black text-[#2f1f14]">
            Enter Command
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#5f4a39]">
            Examples: Add task call tenant, Add reminder follow up tomorrow,
            Add work order leaking sink at Unit 4.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder='Try: "Add work order leaking kitchen faucet at Unit 4"'
              className="min-h-32 w-full border border-[#c9ab86] bg-[#f8f1e7] p-4 text-base text-[#2f1f14] outline-none transition placeholder:text-[#8a7a68] focus:border-[#b57a32] focus:bg-white"
            />

            <div className="flex flex-col gap-3">
              <button
                onClick={startListening}
                disabled={listening}
                className="bg-[#c58a3b] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-[#ad742b] disabled:cursor-not-allowed disabled:bg-[#8a7a68]"
              >
                {listening ? "Listening..." : "Voice Command"}
              </button>

              <button
                onClick={() => processCommand(command)}
                className="bg-[#4d3624] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#f5ede2] shadow-lg transition hover:bg-[#6b4a31]"
              >
                Run Command
              </button>

              <button
                onClick={() => setCommand("")}
                className="border border-[#b38b66] bg-[#f8f1e7] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#2f1f14] transition hover:bg-[#efe3d2]"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 border border-[#d8c0a4] bg-[#f8f1e7] p-3 text-sm font-bold text-[#5f4a39]">
            {message}
          </div>

          {!speechSupported && (
            <div className="mt-3 border border-[#c58a3b] bg-[#fff7e8] p-3 text-sm font-semibold text-[#5f4a39]">
              Voice commands are not supported in this browser. Typed commands
              still work.
            </div>
          )}
        </div>

        <aside className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
          <h3 className="text-2xl font-black text-[#2f1f14]">Quick Open</h3>
          <div className="mt-5 grid gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between border border-[#d8c0a4] bg-[#fffaf3] px-4 py-3 text-sm font-bold text-[#2f1f14] transition hover:border-[#c58a3b] hover:bg-[#f3e6d4]"
              >
                <span>{action.label}</span>
                <span className="text-[#9c6b2f]">→</span>
              </Link>
            ))}
          </div>

          <button
            onClick={() => setItems([])}
            className="mt-6 w-full border border-[#8b2f1f] bg-[#fff1ed] px-4 py-3 text-left text-sm font-bold uppercase tracking-wide text-[#8b2f1f] transition hover:bg-[#ffe1d9]"
          >
            Clear Local Data
          </button>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-8 pb-14">
        <div className="border border-[#c9ab86] bg-[#fffaf3] p-6 shadow-md">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-3xl font-black text-[#2f1f14]">
                Assistant Items
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5f4a39]">
                Local command history for the current browser. Cloud wiring can
                be added later without changing this layout.
              </p>
            </div>
            <Link
              href="/"
              className="bg-[#4d3624] px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-[#f5ede2] transition hover:bg-[#6b4a31]"
            >
              Back to Dashboard
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="border border-dashed border-[#c9ab86] bg-[#f8f1e7] p-8 text-center text-sm font-bold text-[#8a7a68]">
              No assistant items yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#d8c0a4] bg-[#fffaf3] p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-[#4d3624] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#f5ede2]">
                          {item.type}
                        </span>
                        <span
                          className={`px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                            item.status === "Open"
                              ? "bg-[#e8f0df] text-[#33521e]"
                              : "bg-[#e2d8c8] text-[#5a4633]"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <h4 className="mt-3 text-xl font-black text-[#2f1f14]">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-sm leading-6 text-[#5f4a39]">
                        {item.details}
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#9c6b2f]">
                        Created: {item.createdAt}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleDone(item.id)}
                        className="border border-[#b38b66] bg-[#f8f1e7] px-3 py-2 text-sm font-bold text-[#2f1f14] transition hover:bg-[#efe3d2]"
                      >
                        {item.status === "Open" ? "Mark Done" : "Reopen"}
                      </button>

                      <button
                        onClick={() => deleteItem(item.id)}
                        className="border border-[#8b2f1f] bg-[#fff1ed] px-3 py-2 text-sm font-bold text-[#8b2f1f] transition hover:bg-[#ffe1d9]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-[#8b6b47] bg-[#3f2a1b] px-8 py-6 text-center text-xs leading-6 text-[#f1e6d8]">
        5 Tools Virtual Assistant supports command capture, local task tracking,
        work-order intake notes, scheduling reminders, and field operations.
      </footer>
    </main>
  );
}
