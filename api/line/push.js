// KIKYŪ Cleaning Automation — push relay used by the Cleaning Engine (and PoC).
// POST /api/line/push   headers: x-kikyu-key: <KIKYU_OPS_KEY>   body: {to:"owner"|"group"|"<id>", text, notification_id}
// X-Line-Retry-Key is derived from notification_id exactly like adapters/line_messaging.py, so the engine's
// Outbox can retry safely: LINE answers 409 for a duplicate key (= already delivered → engine marks SENT).
// Returns {line_http_status, delivered:boolean, duplicate:boolean}. Never logs or returns ids/secrets.
const crypto = require("crypto");
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


function uuid5(name) {
  const ns = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const h = crypto.createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = req.headers["x-kikyu-key"];
  if (!process.env.KIKYU_OPS_KEY || key !== process.env.KIKYU_OPS_KEY) return res.status(403).json({ error: "forbidden" });
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { to, text, notification_id } = body || {};
  if (!to || !text || !notification_id) return res.status(400).json({ error: "to, text, notification_id required" });
  const dest = to === "owner" ? process.env.KIKYU_OWNER_USER_ID : to === "group" ? process.env.KIKYU_GROUP_ID : to;
  if (!dest) return res.status(400).json({ error: "destination not configured" });
  try {
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await lineToken()),
                 "X-Line-Retry-Key": uuid5("kikyu-cleaning/" + notification_id) },
      body: JSON.stringify({ to: dest, messages: [{ type: "text", text: String(text).slice(0, 5000) }] }),
    });
    let detail = null;
    if (r.status !== 200 && r.status !== 409) { try { detail = (await r.json()).message || null; } catch {} }
    // dest_shape is diagnostic only (prefix + length), never the id itself
    return res.status(200).json({ line_http_status: r.status, delivered: r.status === 200, duplicate: r.status === 409,
      detail, dest_shape: dest.slice(0, 1) + "…" + dest.length });
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
};
