// Replays tools/eval/questions.json against the live /chat endpoint and saves
// the answers + tool usage. Usage: node tools/eval/run.mjs --label baseline [--only id1,id2]
// Each case is a fresh conversation with id "eval-<label>-<case>" so test chats
// are easy to tell apart from real ones in the DB.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.CHAT_BASE || "https://shop-chat-agent-lively-fog-4926.fly.dev";
const ORIGIN = "https://informatica.com.ua";
const SHOP_ID = "86804627772"; // public: window.shopId on the storefront

const dir = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const label = arg("label") || "run";
const only = arg("only")?.split(",");
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

const cases = JSON.parse(fs.readFileSync(path.join(dir, "questions.json"), "utf8"))
  .filter((c) => !only || only.includes(c.id));

async function ask(message, conversationId, pageProduct) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Origin: ORIGIN,
      "X-Shopify-Shop-Id": SHOP_ID,
    },
    body: JSON.stringify({ message, conversation_id: conversationId, prompt_type: "standardAssistant", page_product: pageProduct || null }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  let text = "";
  const events = [];
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const ev = JSON.parse(line.slice(6));
      if (ev.type === "chunk") text += ev.chunk;
      else if (ev.type === "new_message") text += "\n";
      else events.push(ev.type);
    } catch { /* ignore keep-alives */ }
  }
  return { text: text.trim(), events };
}

async function toolUsage(conversationId) {
  const res = await fetch(`${BASE}/log-data?conversationId=${encodeURIComponent(conversationId)}`);
  const data = await res.json();
  const tools = [];
  for (const m of data.messages || []) {
    let blocks;
    try { blocks = JSON.parse(m.content); } catch { continue; }
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      if (b.type === "tool_use" || b.type === "server_tool_use") {
        tools.push({ name: b.name, input: JSON.stringify(b.input).slice(0, 200) });
      }
    }
  }
  return tools;
}

const results = [];
for (const c of cases) {
  const conversationId = `eval-${label}-${stamp}-${c.id}`;
  const t0 = Date.now();
  try {
    const { text, events } = await ask(c.message, conversationId, c.page_product);
    const tools = await toolUsage(conversationId);
    results.push({ id: c.id, conversationId, ms: Date.now() - t0, chars: text.length, answer: text, tools, events });
    console.log(`${c.id}: ${text.length} chars, ${tools.length} tool calls, ${Date.now() - t0} ms`);
  } catch (e) {
    results.push({ id: c.id, conversationId, error: String(e) });
    console.log(`${c.id}: ERROR ${e}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}

const out = path.join(dir, "results", `${stamp}-${label}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`saved ${out}`);
