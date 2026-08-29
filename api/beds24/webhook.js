// KIKYŪ Cleaning Automation — Beds24 Booking Webhook receiver (Vercel serverless, no dependencies).
//
// Beds24 (Settings → Properties → Access → Booking Webhook, version "2 - no personal data") POSTs here
// about 1 minute after a booking is created / modified / cancelled. This function is a TRIGGER ONLY:
//   * it never trusts or stores the payload (the engine re-reads the booking from the Beds24 API),
//   * it forwards only the booking id to GitHub Actions via `workflow_dispatch`
//     (fine-grained PAT, single repo, permission Actions:write — cannot touch code or secrets),
//   * duplicates / replays are harmless: every run is idempotent and runs are serialised by the
//     workflow's concurrency group (bursts coalesce into at most one pending run).
// Env: KIKYU_BEDS24_WEBHOOK_KEY (shared secret, also set as the Custom Header in Beds24),
//      GITHUB_DISPATCH_TOKEN, GITHUB_DISPATCH_REPO ("owner/repo"), optional GITHUB_DISPATCH_WORKFLOW
//      (default kikyu-cleaning.yml), optional KIKYU_BEDS24_PROPERTY_ID (ignore other properties).
// Never logs headers or the payload.
const crypto = require("crypto");
module.exports.config = { api: { bodyParser: false } };

function readRaw(req, limit = 256 * 1024) {
  return new Promise((resolve) => {
    let d = ""; req.on("data", (c) => { if (d.length < limit) d += c; }); req.on("end", () => resolve(d));
  });
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  const cfg = {
    key: process.env.KIKYU_BEDS24_WEBHOOK_KEY, tok: process.env.GITHUB_DISPATCH_TOKEN,
    repo: process.env.GITHUB_DISPATCH_REPO, wf: process.env.GITHUB_DISPATCH_WORKFLOW || "kikyu-cleaning.yml",
    prop: process.env.KIKYU_BEDS24_PROPERTY_ID,
  };
  if (req.method === "GET")   // health/readiness: booleans only, never values
    return res.status(200).json({ ok: true, key_configured: !!cfg.key, dispatch_configured: !!(cfg.tok && cfg.repo),
      dispatch_mode: "workflow_dispatch", workflow: cfg.wf });
  if (req.method !== "POST") return res.status(405).end();

  // 1. authenticity: Beds24 sends the configured Custom Header verbatim
  const got = req.headers["x-kikyu-webhook-key"];
  if (!cfg.key || !safeEqual(got, cfg.key)) return res.status(403).end();

  // 2. validation: minimal shape only (payload is NOT used as data)
  let body = {}; try { body = JSON.parse(await readRaw(req)); } catch { return res.status(400).end(); }
  const b = body.booking || {};
  const id = String(b.id || "").trim();
  if (!/^\d{1,12}$/.test(id)) return res.status(400).end();
  if (cfg.prop && String(b.propertyId || "") !== String(cfg.prop)) return res.status(200).json({ ok: true, ignored: "other property" });

  // 3. trigger the engine (immediate path). If dispatch is not configured or fails, still 200:
  //    the 3-hourly reconciliation is the guaranteed fallback.
  if (!cfg.tok || !cfg.repo) return res.status(200).json({ ok: true, forwarded: false, reason: "dispatch not configured" });
  let forwarded = false, status = 0;
  try {
    const r = await fetch(`https://api.github.com/repos/${cfg.repo}/actions/workflows/${cfg.wf}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.tok}`, Accept: "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "kikyu-cleaning", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { trigger: `webhook:${id}`, dry_run: "false" } }),
    });
    status = r.status; forwarded = r.status === 204;
  } catch { forwarded = false; }
  return res.status(200).json({ ok: true, forwarded, github_status: status });
};
