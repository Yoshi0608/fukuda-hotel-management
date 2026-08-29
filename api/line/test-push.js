// KIKYŪ Cleaning Automation — TEST push endpoint (PoC only; remove or disable after Phase 14/15)
// GET /api/line/test-push?key=<KIKYU_OPS_KEY>&to=<userId|groupId>&k=<retry-key>
// Env vars: LINE_CHANNEL_ACCESS_TOKEN, KIKYU_OPS_KEY
// Uses X-Line-Retry-Key (UUID v5 derived from k) exactly like adapters/line_messaging.py, so calling twice with the
// same k must NOT deliver twice (LINE answers 409 Conflict on the duplicate).
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


function uuid5(name) { // RFC 4122 v5, namespace URL — mirrors Python uuid.uuid5(uuid.NAMESPACE_URL, ...)
  const ns = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const h = crypto.createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

module.exports = async (req, res) => {
  const { key, to, k, text } = req.query || {};
  if (!process.env.KIKYU_OPS_KEY || key !== process.env.KIKYU_OPS_KEY) return res.status(403).json({ error: "forbidden" });
  if (!to || !k) return res.status(400).json({ error: "to and k are required" });
  const retryKey = uuid5("kikyu-cleaning/" + k);
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await lineToken()),
               "X-Line-Retry-Key": retryKey },
    body: JSON.stringify({ to, messages: [{ type: "text", text: text || "KIKYŪ 清掃自動化 TEST\nこのメッセージはテストです。対応は不要です。" }] }),
  });
  const body = await r.text();
  res.status(200).json({ line_http_status: r.status, retry_key: retryKey, line_response: body.slice(0, 300) });
};
