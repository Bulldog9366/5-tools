import { NextResponse } from "next/server";
import { ALL_PRESETS, rateCardSummary, type LaborMode } from "@/lib/estimator/rate-card";

// Cost Estimator — "Estimate with Claude". Staff describe a job; Claude
// suggests starting line items for the Cost Estimator: known jobs come
// straight off the fixed rate card above, and anything not on the rate
// card gets a real web search for current material/labor pricing instead
// of a guess. Everything returned here is a draft — staff review, edit,
// and confirm every line before it's part of a real estimate.

export const maxDuration = 60;

const MAX_CHARS = 4000;
const MAX_LINES = 10;
const MODEL = process.env.ESTIMATE_MODEL || "claude-sonnet-5-5";
const ANTHROPIC_VERSION = "2023-06-01";

type DraftLine = {
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

type DraftSource = { title: string; url: string };

const SYSTEM_PROMPT = `You are the 5 Tools Cost Estimator's pricing assistant. Staff describe a maintenance or repair job; you suggest a starting list of line items for the estimate — they will review and edit every line before it's final.

You have 5 Tools' own fixed rate card below. Use a preset exactly as listed whenever the job matches it — those prices are company policy, not a guess, so never override them with a web search result.

Only when a job needs materials or labor that are NOT on the rate card, use the web_search tool to find current, real pricing (e.g. a major hardware store's listed price for a specific part, or a typical regional labor rate for that trade) before proposing a number. Never invent a price from memory for something not on the rate card — search for it. Keep search queries specific (e.g. "40 gallon electric water heater price Home Depot", not just "water heater").

# 5 Tools rate card
${rateCardSummary()}

# How to answer
After any research, respond with ONLY a JSON object as your final output, no other text, no markdown fences:
{"lines": [ { "item": string, "category": string, "description": string, "qty": number, "laborMode": "flat" | "hourly", "laborFlat": number, "laborHours": number, "laborRate": number, "materials": number, "taxable": boolean }, ... ], "question": string | null}

- Use "laborMode": "flat" with "laborFlat" set (laborHours/laborRate at 0), OR "hourly" with laborHours/laborRate set (laborFlat at 0).
- "materials" is a per-unit price; the page multiplies it by qty.
- Include a Trip / Service Fee line only if the job clearly needs a site visit beyond the repair itself.
- At most ${MAX_LINES} lines. If the description is too vague to draft anything useful, return "lines": [] and put ONE clarifying question in "question"; otherwise "question" should be null.
- Never include SSNs, bank/card numbers, or any customer's private account details in any field.`;

function asString(value: unknown, max = 200) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function sanitizeLine(raw: unknown): DraftLine | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const item = asString(r.item, 120);
  if (!item) return null;

  const preset = ALL_PRESETS.find((p) => p.item.toLowerCase() === item.toLowerCase());
  const laborMode: LaborMode = r.laborMode === "hourly" ? "hourly" : "flat";

  return {
    item: preset?.item ?? item,
    category: asString(r.category, 60) || preset?.category || "General",
    description: asString(r.description, 400) || preset?.description || "",
    qty: Math.max(0.01, asNumber(r.qty) || 1),
    laborMode,
    laborFlat: laborMode === "flat" ? asNumber(r.laborFlat) : 0,
    laborHours: laborMode === "hourly" ? asNumber(r.laborHours) : 0,
    laborRate: laborMode === "hourly" ? asNumber(r.laborRate) : 0,
    materials: asNumber(r.materials),
    taxable: r.taxable !== false,
  };
}

type AnthropicContentBlock = {
  type: string;
  text?: string;
  content?: Array<{ type: string; title?: string; url?: string }>;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Estimate with Claude isn't set up yet: ANTHROPIC_API_KEY is missing." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!description) {
    return NextResponse.json({ error: "Describe the job first." }, { status: 400 });
  }
  if (description.length > MAX_CHARS) {
    return NextResponse.json({ error: "That description is too long. Shorten it and try again." }, { status: 400 });
  }

  const context = body?.property ? `Property: ${String(body.property).slice(0, 200)}` : "";

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 4 }],
        messages: [
          {
            role: "user",
            content: context ? `${context}\n\nJob description: ${description}` : `Job description: ${description}`,
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Claude. Try again." }, { status: 502 });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const status = response.status === 429 ? 429 : 502;
    const message =
      response.status === 400 && detail.includes("web search is not enabled")
        ? "Web search isn't enabled for this account. An admin needs to turn it on in the Claude Console (Settings → Capabilities) before Estimate with Claude can look up prices."
        : "Claude couldn't price that job. Try again.";
    return NextResponse.json({ error: message }, { status });
  }

  const data = (await response.json().catch(() => null)) as { content?: AnthropicContentBlock[]; stop_reason?: string } | null;
  const blocks = data?.content ?? [];

  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("\n");

  const sources: DraftSource[] = [];
  const seenUrls = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const result of block.content) {
      if (result.type !== "web_search_result" || !result.url || seenUrls.has(result.url)) continue;
      seenUrls.add(result.url);
      sources.push({ title: result.title || result.url, url: result.url });
    }
  }

  let parsed: { lines?: unknown; question?: unknown };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : text);
  } catch {
    return NextResponse.json({ error: "Couldn't read that back as line items. Try rephrasing the job." }, { status: 502 });
  }

  const lines = Array.isArray(parsed.lines)
    ? parsed.lines.map(sanitizeLine).filter((l): l is DraftLine => l !== null).slice(0, MAX_LINES)
    : [];
  const question = typeof parsed.question === "string" && parsed.question.trim() ? parsed.question.trim() : null;

  if (lines.length === 0 && !question) {
    return NextResponse.json({ error: "Couldn't draft anything from that description. Add more detail and try again." }, { status: 422 });
  }

  return NextResponse.json({ lines, question, sources: sources.slice(0, 6) });
}
