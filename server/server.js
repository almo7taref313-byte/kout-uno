import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import * as logic from "./logic.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = [path.join(HERE, "public"), path.join(HERE, "..", "client")].find((p) => fs.existsSync(p));
const DATA = process.env.DATA_FILE || path.join(HERE, "data", "rooms.json");
const PORT = +process.env.PORT || 3000;
const META = logic.meta;
const ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_FRAME = 16 * 1024;
const MAX_ACTION = 4 * 1024;

const rooms = new Map();
try {
  const saved = JSON.parse(fs.readFileSync(DATA, "utf8"));
  for (const [name, game] of Object.entries(saved)) rooms.set(name, { game, conns: new Map() });
  console.log(`استرجعت ${rooms.size} غرفة`);
} catch {}
let timer = null;
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const out = {};
    for (const [n, r] of rooms) out[n] = r.game;
    try {
      fs.mkdirSync(path.dirname(DATA), { recursive: true });
      fs.writeFileSync(DATA + ".tmp", JSON.stringify(out));
      fs.renameSync(DATA + ".tmp", DATA);
    } catch (e) {
      console.error("persist failed", e.message);
    }
  }, 500);
}
const getRoom = (name) => {
  if (!rooms.has(name)) rooms.set(name, { game: { status: "waiting", seats: [], state: null, result: null }, conns: new Map() });
  return rooms.get(name);
};

function broadcast(r) {
  const connected = r.conns.size;
  for (const [ws, playerId] of r.conns) {
    if (ws.readyState !== 1) continue;
    ws.send(JSON.stringify({
      type: "state", status: r.game.status, seats: r.game.seats, you: playerId, connected,
      view: r.game.state ? logic.viewFor(r.game.state, playerId) : null,
      result: r.game.result, meta: META,
    }));
  }
}
const err = (ws, error) => ws.readyState === 1 && ws.send(JSON.stringify({ type: "error", error }));

function onMessage(r, ws, raw) {
  if (raw === "__ping") return ws.send("__pong");
  if (Buffer.byteLength(raw) > MAX_FRAME) return err(ws, "message too large");
  let m;
  try { m = JSON.parse(raw); } catch { return err(ws, "invalid json"); }
  if (!m || typeof m !== "object" || Array.isArray(m)) return err(ws, "expected a json object");
  const g = r.game;
  if (m.type === "join") {
    if (typeof m.playerId !== "string" && typeof m.playerId !== "number") return err(ws, "playerId required");
    const id = String(m.playerId).slice(0, 64);
    if (!id) return err(ws, "playerId required");
    r.conns.set(ws, id);
    if (!g.seats.includes(id) && g.seats.length < META.maxPlayers) g.seats.push(id);
    if (g.status === "waiting" && g.seats.length >= META.minPlayers) {
      g.state = logic.setup(g.seats);
      g.status = "playing";
    }
    persist();
    return broadcast(r);
  }
  const pid = r.conns.get(ws);
  if (!pid) return err(ws, "join first");
  if (m.type === "action") {
    if (g.status !== "playing") return err(ws, "game is not in progress");
    if (!g.seats.includes(pid)) return err(ws, "spectators cannot act");
    if (!("action" in m) || Buffer.byteLength(JSON.stringify(m.action) ?? "") > MAX_ACTION) return err(ws, "bad action");
    const v = logic.validateAction(g.state, pid, m.action);
    if (!v.ok) return err(ws, v.error || "invalid action");
    g.state = logic.applyAction(g.state, pid, m.action);
    const end = logic.isGameOver(g.state);
    if (end.over) { g.status = "over"; g.result = end; }
    persist();
    return broadcast(r);
  }
  if (m.type === "reset") {
    if (!g.seats.includes(pid)) return err(ws, "spectators cannot reset");
    const ok = g.seats.length >= META.minPlayers;
    g.state = ok ? logic.setup(g.seats) : null;
    g.status = ok ? "playing" : "waiting";
    g.result = null;
    persist();
    return broadcast(r);
  }
  err(ws, "unknown message type");
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/healthz") return res.end("ok");
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, "");
  let file = path.join(CLIENT, p === "/" || p === "." ? "index.html" : p);
  if (!file.startsWith(CLIENT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(CLIENT, "index.html");
  res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache");
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (!(url.pathname === "/ws" || url.pathname.startsWith("/ws/"))) return socket.destroy();
  const name = url.pathname.slice(3).replace(/^\/+/, "") || "main";
  if (!ROOM_RE.test(name)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const r = getRoom(name);
    ws.on("message", (d, isBin) => {
      if (isBin) return err(ws, "expected a text frame");
      try { onMessage(r, ws, d.toString()); } catch (e) { console.error(e.stack); err(ws, "server error"); }
    });
    ws.on("close", () => { r.conns.delete(ws); broadcast(r); });
    ws.on("error", () => {});
  });
});
server.listen(PORT, () => console.log(`كوت أونو شغّال على http://localhost:${PORT}  (الواجهة: ${CLIENT})`));
