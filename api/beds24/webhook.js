// KIKYŪ Cleaning Automation — Beds24 Booking Webhook receiver (Vercel, no dependencies).
// Beds24 → POST here (custom header X-Kikyu-Webhook-Key set in Beds24 webhook config) → we
// forward a minimal, PII-free trigger to GitHub Actions (repository_dispatch) which runs the engine.
// Env: KIKYU_BEDS24_WEBHOOK_KEY, GITHUB_DISPATCH_TOKEN (fine-grained PAT, contents:write on the
// private runtime repo only), GITHUB_DISPATCH_REPO ("owner/repo"). Never logs the payload.
module.exports.config = { api: { bodyParser: false } };
function readRaw(req) { return new Promise((r) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => r(d)); }); }
module.exports = async (req, res) => {
  if (req.method === "GET")   // health/readiness: booleans only, never values
    return res.status(200).json({ ok: true, key_configured: !!process.env.KIKYU_BEDS24_WEBHOOK_KEY,
      dispatch_configured: !!(process.env.GITHUB_DISPATCH_TOKEN && process.env.GITHUB_DISPATCH_REPO) });
  if (req.method !== "POST") return res.status(405).end();
  const want = process.env.KIKYU_BEDS24_WEBHOOK_KEY;
  if (!want || req.headers["x-kikyu-webhook-key"] !== want) return res.status(403).end();
  let body = {}; try { body = JSON.parse(await readRaw(req)); } catch { return res.status(400).end(); }
  const b = body.booking || {};
  if (!b.id) return res.status(400).end();
  // idempotency key only (booking id + modifiedTime); the engine re-reads Beds24 itself.
  const payload = { event_type: "beds24-booking",
    client_payload: { key: `${b.id}@${b.modifiedTime || ""}`, status: b.status || null, departure: b.departure || null } };
  const repo = process.env.GITHUB_DISPATCH_REPO, tok = process.env.GITHUB_DISPATCH_TOKEN;
  if (!repo || !tok) return res.status(200).json({ ok: true, forwarded: false });   // accept, polling will catch up
  const r = await fetch(`https://api.github.com/repos/${repo}/dispatches`, { method: "POST",
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "User-Agent": "kikyu-cleaning" },
    body: JSON.stringify(payload) });
  return res.status(200).json({ ok: true, forwarded: r.status === 204 });
};
