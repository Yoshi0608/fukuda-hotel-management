// KIKYŪ Cleaning Automation — LINE Messaging API webhook (Vercel serverless, no dependencies)
// Env vars (set in Vercel dashboard, never in code): LINE_CHANNEL_SECRET, LINE_CHANNEL_ID (or LINE_CHANNEL_ACCESS_TOKEN), KIKYU_OWNER_USER_ID (optional)
// Behaviour (production scope — no cleaning logic here; the engine pushes via /api/line/push):
//   * verifies X-Line-Signature (HMAC-SHA256 of raw body with channel secret) before parsing
//   * join event (bot added to a group) → pushes the groupId to KIKYU_OWNER_USER_ID only (nothing is posted in the group)
//   * everything else is ignored (no replies, no logging of ids)
const crypto = require("crypto");

module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });
}

// --- LINE auth helper (inline; Vercel deploys every file under api/ as a function) -----------------
// Token strategy (user directive 2026-08-29, Developers Console unavailable):
//   1. LINE_CHANNEL_ACCESS_TOKEN if set (long-lived, issued in Developers Console) — future option.
//   2. Otherwise issue a *stateless* channel access token (15 min, unlimited) from LINE_CHANNEL_ID +
//      LINE_CHANNEL_SECRET via POST https://api.line.me/oauth2/v3/token (official, client_credentials).
let _tok = { value: null, exp: 0 };
async function lineToken() {
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) return process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (_tok.value && Date.now() < _tok.exp) return _tok.value;
  const body = new URLSearchParams({ grant_type: "client_credentials",
    client_id: process.env.LINE_CHANNEL_ID || "", client_secret: process.env.LINE_CHANNEL_SECRET || "" });
  const r = await fetch("https://api.line.me/oauth2/v3/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("token issue failed: HTTP " + r.status);
  const j = await r.json();
  _tok = { value: j.access_token, exp: Date.now() + Math.max(60, (j.expires_in || 900) - 60) * 1000 };
  return _tok.value;
}

async function lineApi(path, body, retryKey) {
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + (await lineToken()) };
  if (retryKey) headers["X-Line-Retry-Key"] = retryKey;
  const r = await fetch("https://api.line.me/v2/bot/message/" + path, { method: "POST", headers, body: JSON.stringify(body) });
  return r.status;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("ok"); // LINE "Verify" button sends POST; GET = health
  const raw = await readRaw(req);
  const expected = crypto.createHmac("sha256", process.env.LINE_CHANNEL_SECRET || "").update(raw).digest("base64");
  if (expected !== req.headers["x-line-signature"]) return res.status(401).send("bad signature");
  let events = [];
  try { events = JSON.parse(raw).events || []; } catch { return res.status(400).send("bad json"); }

  // Production scope: the bot only *listens*. It never replies in the cleaning-company group.
  // Kept: group join → tell the owner (privately) so KIKYU_GROUP_ID can be re-set if the group is recreated.
  // Removed after PoC (2026-08-29): "id" / "test" commands, double-push retry-key experiment.
  for (const ev of events) {
    const src = ev.source || {};
    if (ev.type === "join" && src.groupId && process.env.KIKYU_OWNER_USER_ID) {
      await lineApi("push", { to: process.env.KIKYU_OWNER_USER_ID,
        messages: [{ type: "text", text: "【KIKYŪ 清掃自動化】グループ接続を検知しました。\ngroupId: " + src.groupId }] });
    }
  }
  res.status(200).send("ok");
};
