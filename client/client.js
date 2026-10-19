/* كوت أونو — واجهة اللعبة */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COL = ["R", "Y", "G", "B", "W"];
const CN = ["الأحمر", "الأصفر", "الأخضر", "الأزرق"];
const LB = ["2", "3", "4", "5", "6", "7", "8", "9", "0", "⇄", "⊘", "+2", "1"];
const BN = { 5: "باب", 6: "ستة", 7: "سبعة", 8: "ثمانية", 9: "باون" };
const cc = (e) => Math.floor(e / 13);
const rr = (e) => e % 13;
const lbl = (e) => (cc(e) === 4 ? (rr(e) === 2 ? "+4" : "★") : LB[rr(e)]);
const card = (e, x = "") => `<div class="c ${COL[cc(e)]} ${x}"><s>${lbl(e)}</s><i></i><b>${lbl(e)}</b></div>`;

const REMOTE_SERVER_HOST = "YOUR-LINK.onrender.com"; 

function getServerHost() {
  if (REMOTE_SERVER_HOST && REMOTE_SERVER_HOST.trim().length > 0) {
    return REMOTE_SERVER_HOST.trim().replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/\/.*$/, "");
  }
  if (location.protocol === "capacitor:" || location.protocol === "file:") {
    return "localhost:3000";
  }
  return location.host;
}

const params = new URLSearchParams(location.search);
let room = (params.get("room") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
if (!room) {
  room = Array.from({ length: 6 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
  history.replaceState(null, "", "?room=" + room);
}
const LS = (k, v) => {
  try {
    if (v === undefined) return localStorage.getItem(k) || "";
    localStorage.setItem(k, v);
  } catch (_) {}
  return "";
};
function playerId() {
  let id = LS("hf:game:playerId");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    LS("hf:game:playerId", id);
  }
  return id;
}
let myName = LS("kme");
$("myn").value = myName;
$("myn").addEventListener("input", (e) => {
  myName = e.target.value.trim().slice(0, 14);
  LS("kme", myName);
});

let socket = null;
let retry = 0;
let V = null;
let M = null;
function connect() {
  const host = getServerHost();
  const isSecure = (location.protocol === "https:") || (REMOTE_SERVER_HOST && !REMOTE_SERVER_HOST.includes("localhost"));
  const proto = isSecure ? "wss:" : "ws:";
  const wsUrl = `${proto}//${host}/ws/${encodeURIComponent(room)}`;
  
  socket = new WebSocket(wsUrl);
  socket.addEventListener("open", () => {
    retry = 0;
    send({ type: "join", playerId: playerId() });
  });
  socket.addEventListener("message", (event) => {
    if (event.data === "__pong") return;
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    if (msg.type === "state") {
      M = msg;
      V = msg.view;
      render();
    } else if (msg.type === "error") {
      $("net").textContent = msg.error;
    }
  });
  socket.addEventListener("close", () => {
    retry = Math.min(retry + 1, 6);
    const wait = 500 * 2 ** (retry - 1);
    $("net").textContent = "انقطع الاتصال… نعيد المحاولة";
    setTimeout(connect, wait);
  });
}
function send(msg) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}
const act = (action) => send({ type: "action", action });
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send("__ping");
}, 30000);

const AVD = [["g", 1, 0], ["b", 1, 0], ["c", 0, 1], ["s", 1, 0], ["g", 0, 1], ["b", 0, 1]];
function avatar(i) {
  const [h, bd, gl] = AVD[i % 6];
  const SK = "#d9a066";
  let s = `<svg viewBox='0 0 40 40'><rect width='40' height='40' fill='#dbe7ee'/>`;
  s += h === "g" ? `<path d='M6 40c0-8 2-14 3-20C9 8 13 3 20 3s11 5 11 17c1 6 3 12 3 20z' fill='#fff' stroke='#c4c8cf' stroke-width='.6'/>` : `<path d='M5 40c2-7 8-9 15-9s13 2 15 9z' fill='#fff'/>`;
  s += `<rect x='16' y='26' width='8' height='8' fill='#c68a50'/><ellipse cx='11' cy='19' rx='1.8' ry='2.6' fill='#c68a50'/><ellipse cx='29' cy='19' rx='1.8' ry='2.6' fill='#c68a50'/><ellipse cx='20' cy='18' rx='9' ry='11' fill='${SK}'/>`;
  if (h === "g") s += `<path d='M11 15c1-8 5-10 9-10s8 2 9 10c-3-3-6-4.5-9-4.5S14 12 11 15z' fill='#fff' stroke='#c4c8cf' stroke-width='.5'/><path d='M10.6 11.5c2.4-5 6-6 9.4-6s7 1 9.4 6' stroke='#111' stroke-width='1.9' fill='none'/>`;
  if (h === "c") s += [[12, 11, "#1b1b1b"], [16, 7.5, "#1b1b1b"], [20, 6, "#8e8e8e"], [24, 7.5, "#1b1b1b"], [28, 11, "#8e8e8e"], [10.5, 16, "#1b1b1b"], [29.5, 16, "#8e8e8e"], [15, 11, "#8e8e8e"], [25, 11, "#1b1b1b"], [20, 10, "#1b1b1b"]].map(([x, y, c]) => `<circle cx='${x}' cy='${y}' r='3.4' fill='${c}'/>`).join("");
  if (h === "s") s += `<path d='M10.5 17C9.5 8 14 3.5 20 3.5S30.5 8 29.5 17C28.5 12 26 9.5 20 9.5S11.5 12 10.5 17z' fill='#1b1b1b'/><path d='M14 7c3-2 9-2 12 0' stroke='#555' stroke-width='.6' fill='none'/>`;
  if (h === "b") s += `<ellipse cx='16.5' cy='9.5' rx='3' ry='1.3' fill='#fff' opacity='.28'/>`;
  s += `<path d='M14 15.2h5M21 15.2h5' stroke='#222' stroke-width='1.2'/><circle cx='16.5' cy='17.7' r='1' fill='#222'/><circle cx='23.5' cy='17.7' r='1' fill='#222'/><path d='M20 18.5v3.6l-1.3 1' stroke='#a06530' stroke-width='.9' fill='none'/>`;
  if (bd) s += `<path d='M11.2 20c0 7 3.7 9.6 8.8 9.6s8.8-2.6 8.8-9.6c-1.6 3.4-4.3 4.8-8.8 4.8S12.8 23.4 11.2 20z' fill='#222' opacity='.5'/><path d='M16.3 24q3.7-1.8 7.4 0' stroke='#222' stroke-width='1.5' fill='none'/>`;
  s += `<path d='M17.6 26.4q2.4 1.4 4.8 0' stroke='#6b2f25' stroke-width='1' fill='none'/>`;
  if (gl) s += `<circle cx='16.5' cy='17.7' r='3.3' fill='#fff' fill-opacity='.15' stroke='#111' stroke-width='.9'/><circle cx='23.5' cy='17.7' r='3.3' fill='#fff' fill-opacity='.15' stroke='#111' stroke-width='.9'/><path d='M19.8 17.5h.4M13.2 17.2l-2.6-.4M26.8 17.2l2.6-.4' stroke='#111' stroke-width='.9'/>`;
  return s + "</svg>";
}

const ME = () => (V.you >= 0 ? V.you : 0);
const dn = (p) => {
  const N = V.N;
  const r = (p - ME() + N) % N;
  return r === 0 ? "أنت" : r % 2 ? "خصم " + (r + 1) / 2 : N === 4 ? "شريكك" : "شريك " + r / 2;
};
const nm = (p) => (p === V.you ? "أنت" : V.seats[p] ? V.seats[p].name : dn(p));
const fmtTeam = (t) => (t === ME() % 2 ? "فريقك" : "الخصوم");

function render() {
  if (!V) return;
  const me = ME();
  const t = me % 2;
  const seated = V.you >= 0;
  const ph = V.phase;
  const lobby = ph === "lobby";
  const N = V.N;
  $("net").textContent = `الغرفة: ${room} · ${M.connected} متصل`;
  document.querySelectorAll("#md button[data-m]").forEach((b) => b.classList.toggle("on", +b.dataset.m === N));
  $("md").style.display = lobby && seated ? "" : "none";
  $("sc").innerHTML = lobby ? "" : `فريقك <b>${V.sc[t]}</b> · الخصوم <b>${V.sc[1 - t]}</b> <small>(الفوز عند 101)</small>`;
  $("ct").innerHTML = V.trump >= 0 && !lobby ? `العقد: <b>${V.malzom ? "ملزوم" : BN[V.high]}</b> · الحكم: <span class="dot ${COL[V.trump]}"></span>${CN[V.trump]} · الأكلات: فريقك ${V.tw[t]} / الخصوم ${V.tw[1 - t]}` : "";
  const pos = (p, k) => {
    const a = ((-90 + (360 * p) / N) * Math.PI) / 180;
    return `left:${(50 + k * Math.cos(a)).toFixed(1)}%;top:${(50 - k * Math.sin(a)).toFixed(1)}%`;
  };
  const cur = ph === "bid" ? V.bq[0] : ph === "trump" ? V.bidder : ph === "play" ? V.turn : -1;
  $("opp").innerHTML = Array.from({ length: N }, (_, p) => {
    const rel = (p - me + N) % N;
    const human = !!V.seats[p];
    const emp = lobby && !human;
    const bot = !lobby && !human;
    const can = (lobby && !human) || (!lobby && !seated && !human);
    return `<div class="op ${rel % 2 ? "" : "mt"} ${emp ? "emp" : ""} ${cur === p ? "on" : ""}" style="${pos(rel, 40)}" ${can ? `data-seat="${p}"` : ""}><div class="av">${emp ? "+" : avatar(p)}</div><div class="nm"><span>${bot ? "🤖 " : ""}${emp ? "اجلس" : esc(nm(p))}</span></div>${V.log[p] ? `<span class="lg">${esc(V.log[p])}</span>` : ""}</div>`;
  }).join("");
  $("trick").innerHTML = V.trick.map((x) => `<div class="tk" style="${pos((x.p - me + N) % N, 19)}">${card(x.c)}</div>`).join("");
  const mine = seated && ph === "play" && V.turn === me;
  $("hand").innerHTML = V.hand.map((e, i) => `<div data-i="${i}">${card(e, mine ? (V.legal.includes(e) ? "ok" : "dim") : "")}</div>`).join("");
  const rs = V.rs;
  const done = (ph === "end" || ph === "over") && rs;
  $("ban").textContent = done ? (rs.ok ? (rs.bt === t ? "وصلت" : "وصل الخصوم") : rs.bt === t ? "خسرت" : "خسر الخصوم") : "";
  $("ban").style.background = done && rs.to === t ? "#2e7d32" : "#c62828";
  $("last").innerHTML = V.last && !lobby ? `<small>آخر أكلة:</small>${V.last.t.map((x) => card(x.c)).join("")}<small>فاز ${esc(nm(V.last.w))}</small>` : "";

  let m;
  if (lobby) m = seated ? "أنت جالس. أرسل الرابط لأصدقائك (زر الدعوة) ثم اضغط «ابدأ اللعب». المقاعد الفارغة تلعبها بوتات." : "اضغط على مقعد فارغ لتجلس، أو زر «اجلس».";
  else if (done) m = `${fmtTeam(rs.bt)}${rs.ok ? " نجح" : " فشل"} في عقد ${rs.mz ? "ملزوم" : BN[rs.b]} (${rs.t} أكلات)، +${rs.pts} لـ${fmtTeam(rs.to)}${rs.ov ? " — انتهت اللعبة، " + (rs.to === t ? "فزتم!" : "فاز الخصوم") : ""}`;
  else if (!seated) m = "أنت تتفرج. اضغط على مقعد بوت 🤖 لتجلس مكانه.";
  else if (ph === "bid") m = V.bq[0] === me ? "دورك في المزايدة" : `${nm(V.bq[0])} يزايد…`;
  else if (ph === "trump") m = V.bidder === me ? "معك العقد، اختر لون الحكم" : `${nm(V.bidder)} يختار الحكم…`;
  else m = mine ? "دورك، العب ورقة" : `الدور على ${nm(V.turn)}`;
  $("msg").textContent = m;

  let h = "";
  if (lobby) {
    if (!seated) h = '<button data-auto>اجلس</button>';
    else h = '<button data-start>ابدأ اللعب</button>';
  } else if (seated) {
    if (ph === "bid" && V.bq[0] === me) {
      h += `<button data-p ${V.bq.length === 1 && !V.high ? "disabled" : ""}>طاف</button>`;
      for (let b = 5; b <= 9; b++) h += `<button data-b="${b}" ${b <= V.high ? "disabled" : ""}>${BN[b]}</button>`;
    }
    if (ph === "trump" && V.bidder === me) h = COL.slice(0, 4).map((x, i) => `<button class="${x}" data-t="${i}">${CN[i]}</button>`).join("");
    if (ph === "end") h = "<button data-n>اليد التالية</button>";
    if (ph === "over") h = "<button data-w>لعبة جديدة</button>";
  }
  const w = ph === "bid" ? V.bq[0] : ph === "trump" ? V.bidder : ph === "play" ? V.turn : -1;
  if (seated && w >= 0 && w !== me && V.seats[w]) h += `<button data-kick="${w}">${esc(nm(w))} لا يرد؟ حوّله لبوت</button>`;
  $("ctl").innerHTML = h;
}

$("hand").addEventListener("click", (e) => {
  const el = e.target.closest("[data-i]");
  if (!el || !V) return;
  const c = V.hand[+el.dataset.i];
  if (c !== undefined && V.legal.includes(c)) act({ type: "play", e: c });
});
$("ctl").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  if ("b" in d) act({ type: "bid", b: +d.b });
  else if ("p" in d) act({ type: "bid", b: 0 });
  else if ("t" in d) act({ type: "trump", t: +d.t });
  else if ("n" in d) act({ type: "next" });
  else if ("w" in d) act({ type: "new" });
  else if ("start" in d) act({ type: "start", n: Math.floor(Math.random() * 2147483647) });
  else if ("auto" in d) act({ type: "sit", seat: "auto", name: myName || "لاعب" });
  else if ("kick" in d) act({ type: "bot", seat: +d.kick });
});
$("opp").addEventListener("click", (e) => {
  const el = e.target.closest("[data-seat]");
  if (!el) return;
  const s = +el.dataset.seat;
  act({ type: "sit", seat: s, name: myName || "لاعب " + (s + 1) });
});
$("md").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-m]");
  if (b) act({ type: "mode", n: +b.dataset.m });
});
$("inv").addEventListener("click", async () => {
  const host = getServerHost();
  const origin = host.includes(":") ? `http://${host}` : `https://${host}`;
  const url = `${origin}/?room=${encodeURIComponent(room)}`;
  const text = `تعال نلعب كوت أونو! افتح الرابط وجلّس نفسك:
${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(text);
    $("net").textContent = "اننسخ رابط الدعوة، ألصقه في واتساب";
    return;
  } catch (_) {}
  prompt("انسخ رابط الدعوة:", url);
});

connect();
