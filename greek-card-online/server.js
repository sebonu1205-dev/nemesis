'use strict';
// ルーム戦サーバー。勝敗の処理・入れ替えの秘匿・入力の検証はすべてここで行う。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const E = require('./engine.js');

const PORT = process.env.PORT || 8080;
const GRACE_MS = +(process.env.GRACE_MS || 90000);   // 切断から部屋を閉じるまで
const IDLE_MS = 30 * 60 * 1000;                      // 無操作で部屋を閉じる
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rooms = new Map();

const INDEX = path.join(__dirname, 'public', 'index.html');
const server = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  fs.readFile(INDEX, (err, buf) => {
    if (err) { res.writeHead(500); return res.end('index.html not found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

const rnd = n => { let s = ''; for (let i = 0; i < n; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };
const token = () => require('crypto').randomBytes(12).toString('hex');
const send = (seat, o) => { if (seat && seat.ws && seat.ws.readyState === 1) seat.ws.send(JSON.stringify(o)); };
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8);
const isCard = k => Number.isInteger(k) && k >= 0 && k < 15;

function newSeat(ws, name, def) { return { ws, token: token(), name: cleanName(name) || def, connected: true, deck: null, orig: null, swapDone: false, pick: null, again: false, timer: null }; }
function names(r) { const a = r.seats[0].name, b = r.seats[1] ? r.seats[1].name : ''; return a === b ? [a, b + '2'] : [a, b]; }
function touch(r) { clearTimeout(r.idle); r.idle = setTimeout(() => closeRoom(r, '長い間操作がなかったため、部屋を閉じました'), IDLE_MS); }
function closeRoom(r, why) {
  clearTimeout(r.idle);
  r.seats.forEach(s => { if (s) { clearTimeout(s.timer); send(s, { t: 'closed', why }); } });
  rooms.delete(r.code);
}

// 席 s から見た情報。自分=0、相手=1 に正規化して送る
function view(r, s) {
  const S = r.S, me = S.p[s], op = S.p[1 - s];
  return { round: S.round,
    me: { deck: me.deck, hand: me.hand, used: me.used, own: me.own, dec: me.dec, prev: me.prev, score: me.score },
    opp: { handN: op.hand.length, used: op.used, own: op.own, dec: op.dec, prev: op.prev, score: op.score } };
}
const flip = a => [a[1], a[0]];
function normLog(L, s) {
  if (s === 0) return L;
  return { notes: L.notes, names: flip(L.names), r: L.r, cards: flip(L.cards), sc0: flip(L.sc0), n: flip(L.n), pre: flip(L.pre), w: L.w === -1 ? -1 : 1 - L.w, sc: L.sc };
}
function finalFor(r, s) {
  const f = E.finalWinner(r.S);
  return { w: f.w === -1 ? -1 : (f.w === s ? 0 : 1), why: f.why,
    decks: [r.S.p[s].deck, r.S.p[1 - s].deck], orig: [r.seats[s].orig, r.seats[1 - s].orig] };
}
function nm(r, s) { const n = names(r); return [n[s], n[1 - s]]; }

function startBuild(r) {
  r.phase = 'build'; r.S = null; r.log = []; r.fin = false;
  r.seats.forEach(s => { s.deck = s.orig = null; s.swapDone = false; s.pick = null; s.again = false; });
  r.seats.forEach((s, i) => send(s, { t: 'build', names: nm(r, i) }));
}
function sync(r, i) {
  const s = r.seats[i], o = r.seats[1 - i], base = { t: 'sync', phase: r.phase, names: nm(r, i), code: r.code, oppOn: !!(o && o.connected) };
  if (r.phase === 'lobby') return base;
  if (r.phase === 'build') return { ...base, done: !!s.deck };
  if (r.phase === 'swap') return { ...base, myDeck: s.deck, orig: [s.orig, o.orig], done: s.swapDone };
  const out = { ...base, orig: [s.orig, o.orig], view: view(r, i), picked: s.pick != null, log: r.log.map(L => normLog(L, i)) };
  if (r.phase === 'final') out.fin = finalFor(r, i);
  return out;
}

function handle(ws, m) {
  if (!m || typeof m.t !== 'string') return;
  const ctx = ws.ctx;
  if (m.t === 'create') {
    if (ctx) return;
    let code; do code = rnd(4); while (rooms.has(code));
    const r = { code, seats: [newSeat(ws, m.name, 'ホスト'), null], phase: 'lobby', S: null, log: [], idle: null };
    rooms.set(code, r); ws.ctx = { r, i: 0 }; touch(r);
    return send(r.seats[0], { t: 'created', code, token: r.seats[0].token });
  }
  if (m.t === 'join') {
    if (ctx) return;
    const code = String(m.code || '').toUpperCase().trim(), r = rooms.get(code);
    if (!r) return ws.send(JSON.stringify({ t: 'error', msg: 'その部屋は見つかりません。コードを確かめてください' }));
    if (r.seats[1] || r.phase !== 'lobby') return ws.send(JSON.stringify({ t: 'error', msg: 'その部屋はすでに満員です' }));
    r.seats[1] = newSeat(ws, m.name, 'ゲスト'); ws.ctx = { r, i: 1 }; touch(r);
    send(r.seats[1], { t: 'joined', code, token: r.seats[1].token });
    return startBuild(r);
  }
  if (m.t === 'resume') {
    const r = rooms.get(String(m.code || '').toUpperCase()), i = r ? r.seats.findIndex(s => s && s.token === m.token) : -1;
    if (i < 0) return ws.send(JSON.stringify({ t: 'closed', why: '部屋が見つかりません(時間切れの可能性があります)' }));
    const s = r.seats[i]; if (s.ws && s.ws !== ws) { s.ws.ctx = null; try { s.ws.close(); } catch (e) {} }
    clearTimeout(s.timer); s.ws = ws; s.connected = true; ws.ctx = { r, i }; touch(r);
    send(s, sync(r, i)); send(r.seats[1 - i], { t: 'opp', on: true });
    return;
  }
  if (!ctx) return;
  const { r, i } = ctx, s = r.seats[i], o = r.seats[1 - i]; touch(r);
  if (m.t === 'leave') return closeRoom(r, '相手が退出しました');
  if (m.t === 'deck' && r.phase === 'build' && !s.deck) {
    const d = Array.isArray(m.deck) ? m.deck.slice(0, 5).filter(isCard).sort((a, b) => a - b) : [];
    if (!E.legal(d)) return send(s, { t: 'error', msg: 'デッキが条件を満たしていません' });
    s.deck = d; s.orig = d.slice();
    if (o && o.deck) {
      r.phase = 'swap';
      r.seats.forEach((x, k) => send(x, { t: 'reveal', names: nm(r, k), orig: [x.orig, r.seats[1 - k].orig] }));
    }
    return;
  }
  if (m.t === 'swap' && r.phase === 'swap' && !s.swapDone) {
    if (m.pos != null) {
      const ok = E.swapOptions(s.deck).some(x => x.pos === m.pos && x.card === m.card);
      if (!ok) return send(s, { t: 'error', msg: 'その入れ替えはできません' });
      s.deck[m.pos] = m.card; s.deck.sort((a, b) => a - b);
    }
    s.swapDone = true;
    if (o && o.swapDone) {
      r.phase = 'play'; r.S = E.mkState([r.seats[0].deck, r.seats[1].deck]); r.log = [];
      r.seats.forEach((x, k) => send(x, { t: 'turn', view: view(r, k) }));
    }
    return;
  }
  if (m.t === 'pick' && r.phase === 'play' && s.pick == null) {
    if (!r.S.p[i].hand.includes(m.card)) return send(s, { t: 'error', msg: 'そのカードは出せません' });
    s.pick = m.card;
    if (o.pick == null) return;
    const S = r.S, n = names(r);
    const L = { notes: [], names: n, r: S.round, cards: [r.seats[0].pick, r.seats[1].pick] };
    L.sc0 = [S.p[0].score, S.p[1].score];
    E.resolve(S, L.cards, L); S.round++; r.log.push(L);
    r.seats.forEach(x => x.pick = null);
    const over = S.round > 5; if (over) r.phase = 'final';
    r.seats.forEach((x, k) => {
      send(x, { t: 'result', L: normLog(L, k), view: view(r, k) });
      if (over) send(x, { t: 'final', fin: finalFor(r, k) });
    });
    return;
  }
  if (m.t === 'again' && r.phase === 'final') {
    s.again = true;
    if (o && o.again) return startBuild(r);
    return send(o, { t: 'opp_again' });
  }
}

wss.on('connection', ws => {
  ws.isAlive = true; ws.on('pong', () => ws.isAlive = true);
  ws.on('message', buf => { let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; } try { handle(ws, m); } catch (e) { console.error(e); } });
  ws.on('close', () => {
    const c = ws.ctx; if (!c) return;
    const { r, i } = c, s = r.seats[i]; if (!s || s.ws !== ws) return;
    s.connected = false;
    if (r.phase === 'lobby') return closeRoom(r, '部屋を閉じました');
    send(r.seats[1 - i], { t: 'opp', on: false });
    clearTimeout(s.timer);
    s.timer = setTimeout(() => closeRoom(r, '相手の接続が戻らなかったため、部屋を閉じました'), GRACE_MS);
  });
});
setInterval(() => wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }), 25000);

if (require.main === module) server.listen(PORT, () => console.log('listening on', PORT));
module.exports = { server, rooms };
