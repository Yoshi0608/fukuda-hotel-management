// KIKYŪ Cleaning Automation — ops/status endpoint (PoC; requires KIKYU_OPS_KEY)
// GET /api/line/status?key=...&action=info            → token issuance check + webhook endpoint info (endpoint, active)
// GET /api/line/status?key=...&action=set_endpoint    → PUT webhook endpoint = https://www.fukudahotel.com/api/line/webhook
// GET /api/line/status?key=...&action=test_webhook    → POST /v2/bot/channel/webhook/test (LINE calls our webhook)
// Never returns secrets or tokens.

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

const ENDPOINT = "https://www.fukudahotel.com/api/line/webhook";
async function api(method, path, body) {
  const r = await fetch("https://api.line.me" + path, { method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await lineToken()) },
    body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, body: json || text.slice(0, 300) };
}
module.exports = async (req, res) => {
  const { action } = req.query || {};
  const key = req.headers["x-kikyu-key"] || (req.query || {}).key;   // header preferred (query strings can end up in logs)
  if (!process.env.KIKYU_OPS_KEY || key !== process.env.KIKYU_OPS_KEY) return res.status(403).json({ error: "forbidden" });
  try {
    if (action === "info") {
      await lineToken();
      const info = await api("GET", "/v2/bot/info");
      const wh = await api("GET", "/v2/bot/channel/webhook/endpoint");
      return res.status(200).json({ token: "ok", bot: info, webhook: wh });
    }
    if (action === "set_endpoint") return res.status(200).json(await api("PUT", "/v2/bot/channel/webhook/endpoint", { endpoint: ENDPOINT }));
    if (action === "test_webhook") return res.status(200).json(await api("POST", "/v2/bot/channel/webhook/test", { endpoint: ENDPOINT }));
    return res.status(400).json({ error: "unknown action" });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
};
