export const meta = { game: "كوت أونو", minPlayers: 1, maxPlayers: 12 };
const BN = { 5: "باب", 6: "ستة", 7: "سبعة", 8: "ثمانية", 9: "باون" };
const PTS = { 5: [5, 10], 6: [6, 12], 7: [7, 14], 8: [8, 16], 9: [36, 18] };
const cc = (e) => Math.floor(e / 13);
const rr = (e) => e % 13;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function rnd(S) {
  S.seed = (S.seed + 0x6d2b79f5) | 0;
  let t = S.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const sortHand = (h) => h.sort((a, b) => cc(a) - cc(b) || rr(b) - rr(a));

function blank(seed) {
  return {
    seed,
    N: 6,
    phase: "lobby",
    seats: Array(6).fill(null),
    sc: [0, 0],
    rounds: 0,
    dealer: 5,
    high: 0,
    bidder: -1,
    malzom: false,
    trump: -1,
    trick: [],
    led: null,
    hi: 0,
    tw: [0, 0],
    turn: -1,
    bq: [],
    log: Array(6).fill(""),
    h: [],
    rs: null,
    last: null,
  };
}

export function setup(players) {
  return blank(hashStr((players || []).join("|")));
}

function deal(S) {
  S.dealer = (S.dealer + 1) % S.N;
  const d = [];
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 13; r++) {
      if (S.N === 4 && (r < 4 || (r === 4 && c < 2))) continue;
      d.push(c * 13 + r);
    }
  }
  d.push(53, 54);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(S) * (i + 1));
    const t = d[i];
    d[i] = d[j];
    d[j] = t;
  }
  S.h = Array.from({ length: S.N }, (_, p) => sortHand(d.slice(p * 9, p * 9 + 9)));
  S.phase = "bid";
  S.high = 0;
  S.bidder = -1;
  S.malzom = false;
  S.trump = -1;
  S.trick = [];
  S.led = null;
  S.hi = 0;
  S.tw = [0, 0];
  S.turn = -1;
  S.rs = null;
  S.last = null;
  S.log = Array(S.N).fill("");
  S.bq = Array.from({ length: S.N }, (_, k) => (S.dealer + k + 1) % S.N);
}

function est(h) {
  let b = 0;
  let bs = -1;
  for (let c = 0; c < 4; c++) {
    const cs = h.filter((e) => cc(e) === c);
    const s = cs.length * 0.6 + cs.filter((e) => rr(e) >= 10).length * 0.5;
    if (s > bs) {
      bs = s;
      b = c;
    }
  }
  const jokers = h.filter((e) => cc(e) === 4).length;
  const aces = h.filter((e) => cc(e) < 4 && cc(e) !== b && rr(e) === 12).length;
  return { c: b, e: bs + jokers * 1.2 + aces * 0.7 + 1 };
}

function doBid(S, p, b) {
  const forced = S.bq.length === 1 && !S.high;
  S.bq.shift();
  if (b > S.high) {
    S.high = b;
    S.bidder = p;
    S.malzom = forced && b === 5;
  }
  S.log[p] = !b ? "طاف" : forced && b === 5 ? "ملزوم" : BN[b];
  if (!S.bq.length) S.phase = "trump";
}

function startPlay(S) {
  S.phase = "play";
  S.turn = S.bidder;
  S.log = Array(S.N).fill("");
}

function canLead(S, p, e) {
  return (p % 2 === S.bidder % 2 && ((S.high === 8 && e === 54) || S.high === 9)) || S.hi >= 4;
}

function legal(S, p) {
  const h = S.h[p] || [];
  if (!S.trick.length) {
    const L = h.filter((e) => cc(e) < 4 || canLead(S, p, e));
    return L.length ? L : h;
  }
  const l = S.led;
  const has = l !== null && h.some((e) => cc(e) === l);
  return h.filter((e) => cc(e) === 4 || !has || cc(e) === l);
}

const pw = (S, t) => {
  const e = t.c;
  if (t.dead) return -2;
  if (cc(e) === 4) return 1000 + rr(e);
  if (cc(e) === S.trump) return 500 + (rr(e) === 12 ? 100 : rr(e));
  if (cc(e) === S.led) return rr(e);
  return -1;
};
const K = (S, e) =>
  cc(e) === 4 ? 1000 + rr(e) : cc(e) === S.trump ? 500 + (rr(e) === 12 ? 100 : rr(e)) : rr(e);
const win = (S) => S.trick.reduce((a, b) => (pw(S, b) > pw(S, a) ? b : a));

function botPick(S, p) {
  const L = legal(S, p);
  const low = (a) => a.reduce((m, x) => (K(S, x) < K(S, m) ? x : m));
  if (!S.trick.length) {
    const nt = L.filter((e) => cc(e) < 4 && cc(e) !== S.trump);
    const pool = nt.length ? nt : L;
    return pool.reduce((a, b) => (K(S, b) > K(S, a) ? b : a));
  }
  const cur = win(S);
  const mate = cur.p % 2 === p % 2;
  const bt = L.filter((e) => pw(S, { c: e }) > pw(S, cur));
  return !mate && bt.length ? low(bt) : low(L);
}

function play(S, p, e) {
  S.h[p].splice(S.h[p].indexOf(e), 1);
  const first = !S.trick.length;
  const dead = first && cc(e) === 4 && !canLead(S, p, e);
  S.trick.push({ p, c: e, dead });
  if (first) S.led = cc(e) < 4 ? cc(e) : dead ? null : S.trump;
  else if (S.led === null && cc(e) < 4) S.led = cc(e);
  if (cc(e) === S.trump && rr(e) >= 9) S.hi++;
  if (S.trick.length < S.N) {
    S.turn = (p + 1) % S.N;
    return;
  }
  const w = win(S);
  S.last = { t: S.trick.map((x) => ({ p: x.p, c: x.c })), w: w.p };
  S.tw[w.p % 2]++;
  S.trick = [];
  S.led = null;
  S.turn = w.p;
  const left = S.h[0].length;
  const bt = S.bidder % 2;
  if (!left || S.tw[bt] >= S.high || S.tw[bt] + left < S.high) endRound(S);
}

function endRound(S) {
  const bt = S.bidder % 2;
  const b = S.high;
  const t = S.tw[bt];
  const ok = t >= b;
  const [mk, fl] = S.malzom ? [5, 5] : PTS[b];
  const to = ok ? bt : 1 - bt;
  const pts = ok ? mk : fl;
  S.sc[to] += pts;
  const won = (S.rounds === 0 && b === 9 && ok) || S.sc[to] >= 101 || (S.sc[to] >= 51 && !S.sc[1 - to]);
  S.rounds++;
  S.rs = { bt, ok: ok ? 1 : 0, t, b, mz: S.malzom ? 1 : 0, pts, to, ov: won ? 1 : 0 };
  S.phase = won ? "over" : "end";
}

function drive(S) {
  for (let guard = 0; guard < 400; guard++) {
    if (S.phase === "bid") {
      const p = S.bq[0];
      if (S.seats[p]) return;
      let b = Math.min(9, Math.floor(est(S.h[p]).e + rnd(S) - 0.5));
      if (!(b >= 5 && b > S.high)) b = 0;
      if (S.bq.length === 1 && !S.high && !b) b = 5;
      doBid(S, p, b);
    } else if (S.phase === "trump") {
      if (S.seats[S.bidder]) return;
      S.trump = est(S.h[S.bidder]).c;
      startPlay(S);
    } else if (S.phase === "play") {
      if (S.seats[S.turn]) return;
      play(S, S.turn, botPick(S, S.turn));
    } else return;
  }
}

function waitSeat(S) {
  return S.phase === "bid" ? S.bq[0] : S.phase === "trump" ? S.bidder : S.phase === "play" ? S.turn : -1;
}

const bad = (error) => ({ ok: false, error });
const OK = { ok: true };
const seatOf = (S, pid) => S.seats.findIndex((s) => s && s.id === pid);
const isInt = (x) => Number.isInteger(x);

export function validateAction(S, pid, a) {
  if (!a || typeof a !== "object") return bad("حركة غير صالحة");
  const me = seatOf(S, pid);
  switch (a.type) {
    case "sit": {
      if (typeof a.name !== "string" || !a.name.trim()) return bad("اكتب اسمك");
      let t = a.seat;
      if (t === "auto") t = me >= 0 ? me : S.seats.findIndex((s) => !s);
      if (!isInt(t) || t < 0 || t >= S.N) return bad("ما فيه مقعد فاضي");
      if (S.phase !== "lobby" && me >= 0) return bad("أنت جالس");
      const o = S.seats[t];
      if (o && o.id !== pid) return bad("المقعد محجوز");
      return OK;
    }
    case "mode":
      if (S.phase !== "lobby" || me < 0) return bad("غير مسموح");
      if (a.n !== 4 && a.n !== 6) return bad("عدد غير صالح");
      return S.seats.filter(Boolean).length > a.n ? bad("عدد الجالسين أكبر من المقاعد") : OK;
    case "start":
      return S.phase === "lobby" && me >= 0 ? OK : bad("اجلس أولًا");
    case "bid": {
      if (S.phase !== "bid" || me < 0 || S.bq[0] !== me) return bad("مو دورك");
      const forced = S.bq.length === 1 && !S.high;
      if (a.b === 0) return forced ? bad("لازم تزايد") : OK;
      return isInt(a.b) && a.b >= 5 && a.b <= 9 && a.b > S.high ? OK : bad("مزايدة غير صالحة");
    }
    case "trump":
      if (S.phase !== "trump" || me < 0 || S.bidder !== me) return bad("مو دورك");
      return isInt(a.t) && a.t >= 0 && a.t < 4 ? OK : bad("لون غير صالح");
    case "play":
      if (S.phase !== "play" || me < 0 || S.turn !== me) return bad("مو دورك");
      return isInt(a.e) && legal(S, me).includes(a.e) ? OK : bad("ورقة غير مسموحة");
    case "next":
      return S.phase === "end" && me >= 0 ? OK : bad("غير مسموح");
    case "new":
      return S.phase === "over" && me >= 0 ? OK : bad("غير مسموح");
    case "bot":
      if (me < 0 || !isInt(a.seat) || a.seat < 0 || a.seat >= S.N) return bad("غير مسموح");
      if (a.seat === me || !S.seats[a.seat] || waitSeat(S) !== a.seat) return bad("غير مسموح");
      return OK;
    case "leave":
      return me >= 0 ? OK : bad("غير جالس");
    default:
      return bad("حركة غير معروفة");
  }
}

export function applyAction(state, pid, a) {
  const S = JSON.parse(JSON.stringify(state));
  const me = seatOf(S, pid);
  switch (a.type) {
    case "sit": {
      let t = a.seat;
      if (t === "auto") t = me >= 0 ? me : S.seats.findIndex((s) => !s);
      if (me >= 0 && me !== t) S.seats[me] = null;
      S.seats[t] = { id: pid, name: a.name.trim().slice(0, 14) };
      S.seed = (S.seed ^ hashStr(pid + t)) | 0;
      break;
    }
    case "mode":
      {
        const ns = Array(a.n).fill(null);
        const rest = [];
        S.seats.forEach((x, i) => {
          if (!x) return;
          if (i < a.n) ns[i] = x;
          else rest.push(x);
        });
        rest.forEach((x) => {
          ns[ns.findIndex((y) => !y)] = x;
        });
        S.N = a.n;
        S.seats = ns;
      }
      S.log = Array(a.n).fill("");
      S.dealer = a.n - 1;
      break;
    case "start":
    case "new":
      if (a.type === "start" && isInt(a.n)) S.seed = (S.seed ^ a.n) | 0;
      S.sc = [0, 0];
      S.rounds = 0;
      S.dealer = S.N - 1;
      deal(S);
      break;
    case "next":
      deal(S);
      break;
    case "bid":
      doBid(S, me, a.b);
      break;
    case "trump":
      S.trump = a.t;
      startPlay(S);
      break;
    case "play":
      play(S, me, a.e);
      break;
    case "bot":
      S.seats[a.seat] = null;
      break;
    case "leave":
      S.seats[me] = null;
      break;
  }
  drive(S);
  return S;
}

export function isGameOver() {
  return { over: false };
}

export function viewFor(S, pid) {
  const you = seatOf(S, pid);
  return {
    N: S.N,
    phase: S.phase,
    you,
    seats: S.seats.map((s) => (s ? { name: s.name } : null)),
    sc: S.sc,
    rounds: S.rounds,
    dealer: S.dealer,
    high: S.high,
    bidder: S.bidder,
    malzom: S.malzom,
    trump: S.trump,
    trick: S.trick,
    led: S.led,
    tw: S.tw,
    turn: S.turn,
    bq: S.bq,
    log: S.log,
    rs: S.rs,
    last: S.last,
    counts: S.h.map((h) => h.length),
    hand: you >= 0 && S.h[you] ? S.h[you] : [],
    legal: you >= 0 && S.phase === "play" && S.turn === you ? legal(S, you) : [],
  };
}
