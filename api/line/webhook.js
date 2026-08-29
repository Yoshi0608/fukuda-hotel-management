// KIKYŪ Cleaning Automation — LINE Messaging API webhook (Vercel serverless, no dependencies)
// Env vars (set in Vercel dashboard, never in code): LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, KIKYU_OWNER_USER_ID (optional)
// Behaviour (PoC scope only — no cleaning logic here):
//   * verifies X-Line-Signature (HMAC-SHA256 of raw body with channel secret)
//   * 1:1 message "id"  → replies with the sender's userId  (so the owner can learn their own ID)
//   * join event (bot added to a group) → pushes the groupId to KIKYU_OWNER_USER_ID (nothing is posted in the group)
//   * message inside a group containing "id" → replies with groupId (fallback if push to owner is not configured)
const crypto = require("crypto");

module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });
}
async function lineApi(path, body) {
  const r = await fetch("https://api.line.me/v2/bot/message/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.LINE_CHANNEL_ACCESS_TOKEN },
    body: JSON.stringify(body),
  });
  return r.status;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("ok"); // LINE "Verify" button sends POST; GET = health
  const raw = await readRaw(req);
  const expected = crypto.createHmac("sha256", process.env.LINE_CHANNEL_SECRET || "").update(raw).digest("base64");
  if (expected !== req.headers["x-line-signature"]) return res.status(401).send("bad signature");
  let events = [];
  try { events = JSON.parse(raw).events || []; } catch { return res.status(400).send("bad json"); }

  for (const ev of events) {
    const src = ev.source || {};
    if (ev.type === "join" && src.groupId) {
      // Never log ids or secrets. The groupId is delivered to the owner's LINE only (nothing posted in the group).
      if (process.env.KIKYU_OWNER_USER_ID) {
        await lineApi("push", { to: process.env.KIKYU_OWNER_USER_ID,
          messages: [{ type: "text", text: "【KIKYŪ 清掃自動化】グループ接続を検知しました。\ngroupId: " + src.groupId }] });
      }
    } else if (ev.type === "message" && ev.message && ev.message.type === "text" && /^\s*id\s*$/i.test(ev.message.text)) {
      const idText = src.groupId ? "groupId: " + src.groupId : "userId: " + src.userId;
      await lineApi("reply", { replyToken: ev.replyToken, messages: [{ type: "text", text: "【KIKYŪ 清掃自動化】\n" + idText }] });
    }
  }
  res.status(200).send("ok");
};
