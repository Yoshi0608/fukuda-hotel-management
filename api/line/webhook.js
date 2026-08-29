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
async function lineApi(path, body, retryKey) {
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + process.env.LINE_CHANNEL_ACCESS_TOKEN };
  if (retryKey) headers["X-Line-Retry-Key"] = retryKey;
  const r = await fetch("https://api.line.me/v2/bot/message/" + path, { method: "POST", headers, body: JSON.stringify(body) });
  return r.status;
}
function uuid5(name) { // RFC 4122 v5 (namespace URL) — identical to Python uuid.uuid5(uuid.NAMESPACE_URL, name)
  const ns = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const h = crypto.createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
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
    } else if (ev.type === "message" && ev.message && ev.message.type === "text" && !src.groupId && src.userId
               && /^\s*test\s*$/i.test(ev.message.text)
               && (!process.env.KIKYU_OWNER_USER_ID || process.env.KIKYU_OWNER_USER_ID === src.userId)) {
      // Phase 14 PoC (1:1 only): push the TEST message twice with the SAME X-Line-Retry-Key.
      // Expected: 1st = 200 (delivered once), 2nd = 409 (LINE recognises the duplicate → not delivered again).
      const key = uuid5("kikyu-cleaning/PoC-" + ev.timestamp);
      const msg = { to: src.userId, messages: [{ type: "text", text: "KIKYŪ 清掃自動化 TEST\nこのメッセージはテストです。対応は不要です。" }] };
      const s1 = await lineApi("push", msg, key);
      const s2 = await lineApi("push", msg, key);
      await lineApi("reply", { replyToken: ev.replyToken, messages: [{ type: "text",
        text: "【KIKYŪ 清掃自動化 / Retry Key テスト】\n1回目 push: HTTP " + s1 + "\n2回目 push（同一Retry Key）: HTTP " + s2 +
              "\n期待値: 200 / 409。TESTメッセージが1通だけ届いていれば成功です。" }] });
    }
  }
  res.status(200).send("ok");
};
