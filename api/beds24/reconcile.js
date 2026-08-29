// KIKYŪ Cleaning Automation — daily reconciliation kick from Vercel Cron (second, independent fallback).
// GitHub's own `schedule` trigger is best-effort; this makes sure the engine runs at least once a day
// even if GitHub never fires the cron. Vercel calls GET /api/beds24/reconcile with
// `Authorization: Bearer <CRON_SECRET>` (Vercel sets CRON_SECRET automatically for cron jobs).
// It only dispatches workflow_dispatch(trigger="vercel-cron"); the engine reads Beds24 itself.
const crypto = require("crypto");
function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).end();
  const secret = process.env.CRON_SECRET, key = process.env.KIKYU_BEDS24_WEBHOOK_KEY;
  const auth = String(req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  const ok = (secret && safeEqual(auth, secret)) || (key && safeEqual(req.headers["x-kikyu-webhook-key"], key));
  if (!ok) return res.status(403).end();
  const tok = process.env.GITHUB_DISPATCH_TOKEN, repo = process.env.GITHUB_DISPATCH_REPO;
  const wf = process.env.GITHUB_DISPATCH_WORKFLOW || "kikyu-cleaning.yml";
  if (!tok || !repo) return res.status(200).json({ ok: true, forwarded: false, reason: "dispatch not configured" });
  let status = 0;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${wf}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "kikyu-cleaning", "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { trigger: "vercel-cron", dry_run: "false" } }),
    });
    status = r.status;
  } catch { status = 0; }
  return res.status(200).json({ ok: true, forwarded: status === 204, github_status: status });
};
