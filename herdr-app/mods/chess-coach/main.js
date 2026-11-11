// Chess coach: learn from bosbandid's own mistakes (analysis/report.json from
// ~/Development/Projects/chess.com). Opens straight onto a board: today's daily session if
// it isn't done yet (timers wait for the first click), else a random explore position.
// Modes (chips above the board):
//   Sesi harian: 10 positions, due reviews first (spaced repetition: wrong -> tomorrow,
//                right -> 3, 7, 21 days, then mastered), 60 s each, result screen.
//   Rush:        3 minutes, 3 lives, easy -> hard, best score kept.
//   Jelajahi:    browse concepts and their examples freely.
// A guess counts when it is any move in the example's `good` list (top engine moves within
// 5% win), illegal clicks are refused using the `legal` map from concepts.py.
// Keys: 1/2/3 modes, m mute, space answer, enter next, arrows browse, a ask agent, r reload.
import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { readTextFile, home, appHome, theme, settings, panes, agents, focused, props, hc, run, notify, nextCommand, playSound } from "herdr";
import * as fs from "fs/promises";

const REPORT = () => props()?.report || `${home()}/Development/Projects/chess.com/analysis/report.json`;
const LIGHT = "#f0d9b5", DARK = "#b58863";
const MARK = { played: ["#f2a08f", "#d0705c"], best: ["#cdd26a", "#aaa23a"], pick: ["#f7ec74", "#dac34b"], guess: ["#a9c8ec", "#7ba3cf"] };
const STORE = "chess-coach-v2";
const DAILY_SIZE = 10, DAILY_SECONDS = 60, RUSH_SECONDS = 180, RUSH_LIVES = 3;
const BOXES = [1, 3, 7, 21]; // days until the next review after a right answer, by box
const MASTERED = BOXES.length;

function parseFen(fen) {
  const at = {};
  fen.split(" ")[0].split("/").forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else { at[`${"abcdefgh"[f]}${8 - r}`] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase(); f++; }
    }
  });
  return at;
}

const day = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const keyOf = (e) => `${e.link}#${e.ply}`;
const goodOf = (e) => (e.good?.length ? e.good : e.best_uci ? [e.best_uci.slice(0, 4)] : []);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default class ChessCoach extends View {
  init(_props, cx) {
    this.mode = props()?.start || null;
    this.ci = 0; this.ei = 0; this.size = { width: 400, height: 700 };
    this.resetQuestion();
    try { this.db = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { this.db = {}; }
    this.db.cards ||= {}; this.db.days ||= { last: null, streak: 0 }; this.db.rushBest ||= 0;
    this.h = cx.focus_handle();
    this.load(cx);
    cx.timer.every(500, (cx) => this.tick(cx));
    cx.spawn(async (cx) => { for (;;) { const c = await nextCommand(); if (c === "focus") this.h.focus(); cx.notify(); } });
  }

  load(cx) {
    cx.spawn(async (cx) => {
      try { this.report = JSON.parse(await readTextFile(REPORT())); this.error = null; }
      catch (e) { this.error = `Belum ada laporan di ${REPORT()} (${e})`; }
      if (this.report) {
        const seen = new Set();
        this.all = [];
        for (const c of this.report.concepts) for (const e of c.examples) {
          if (seen.has(keyOf(e))) continue;
          seen.add(keyOf(e));
          this.all.push({ e, c });
        }
        if (!this.inited) {
          this.inited = true;
          if (!this.mode) this.mode = this.db.days.last === day() ? "explore" : "daily";
          if (this.mode === "daily") this.startDaily();
          else if (this.mode === "rush") this.startRush();
          else this.startExplore(true);
        }
      }
      cx.notify();
    });
  }

  persist() { try { localStorage.setItem(STORE, JSON.stringify(this.db)); } catch {} }
  sound(name) { if (!this.db.mute) { try { playSound(`mods/chess-coach/sounds/${name}.mp3`); } catch {} } }

  // ---------- one question ----------
  resetQuestion() { this.pick = null; this.guess = null; this.revealed = false; this.timedOut = false; this.anim = null; this.note = null; }
  current() {
    if (this.mode === "explore") { const c = this.report?.concepts?.[this.ci]; return c && { c, e: c.examples[this.ei] }; }
    return this.queue?.[this.qi];
  }
  shown() { return this.revealed || this.guess !== null || this.timedOut; }
  right() { const q = this.current(); return !!(q && this.guess && goodOf(q.e).includes(this.guess)); }

  clickSquare(name, at, cx) {
    const q = this.current();
    if (!q || this.shown()) return;
    if (!this.engaged && (this.mode === "daily" || this.mode === "rush")) {
      this.engaged = true;
      this.deadline = Date.now() + (this.mode === "rush" ? RUSH_SECONDS : DAILY_SECONDS) * 1000;
    }
    if (at[name]?.[0] === q.e.me[0]) { this.pick = this.pick === name ? null : name; this.note = null; return; }
    if (!this.pick) return;
    const uci = this.pick + name;
    if (q.e.legal && !(uci in q.e.legal)) { this.note = "Langkah itu ilegal, coba lagi."; this.pick = null; return; }
    this.answer(uci, at, cx);
  }

  answer(uci, at, cx) {
    const q = this.current();
    this.guess = uci; this.pick = null; this.note = null;
    const ok = this.right();
    this.sound(ok ? "right" : "wrong");
    // Slide the piece, flash the target: render the start state, then change targets next frame.
    this.anim = { piece: at[uci.slice(0, 2)], from: uci.slice(0, 2), to: uci.slice(2, 4), ok, phase: 0 };
    cx.timer.after(20, (cx) => { if (this.anim) { this.anim.phase = 1; cx.notify(); } });
    this.record(q, ok);
    if (this.mode === "rush") {
      if (ok) this.rush.score++; else this.rush.lives--;
      const id = this.qi;
      cx.timer.after(ok ? 450 : 1400, (cx) => { if (this.mode === "rush" && this.qi === id) { this.nextRush(); cx.notify(); } });
    }
  }

  timeout() {
    this.timedOut = true; this.pick = null;
    this.sound("wrong");
    this.record(this.current(), false);
  }

  // Daily and explore guesses feed the review schedule; rush is just for speed.
  record(q, ok) {
    if (!q || this.mode === "rush") return;
    if (this.mode === "daily") {
      const d = this.daily;
      d.results.push({ concept: q.c.id, ok });
      d.streak = ok ? d.streak + 1 : 0;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
    }
    const k = keyOf(q.e), card = this.db.cards[k] || { box: -1, seen: 0, right: 0, concept: q.c.id };
    if (this.mode === "explore" && this.db.cards[k]) return; // explore only seeds new cards
    card.seen++; if (ok) card.right++;
    card.box = ok ? Math.min(card.box + 1, MASTERED) : 0;
    card.due = card.box >= MASTERED ? day(60) : day(ok ? BOXES[card.box] : 1);
    this.db.cards[k] = card;
    this.persist();
  }

  tick(cx) {
    if (!this.deadline || this.shown()) return;
    const left = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    if (left === 0) {
      if (this.mode === "daily") this.timeout();
      if (this.mode === "rush") return this.endRush(cx);
    }
    if (left !== this.left) { this.left = left; cx.notify(); }
  }

  // ---------- daily session ----------
  dueCount() { const t = day(); return Object.values(this.db.cards).filter((c) => c.box < MASTERED && c.due <= t).length; }

  conceptWeakness(id) {
    const cs = Object.values(this.db.cards).filter((c) => c.concept === id);
    return (cs.reduce((n, c) => n + c.right, 0) + 1) / (cs.reduce((n, c) => n + c.seen, 0) + 2);
  }

  startDaily() {
    const t = day();
    const byKey = new Map(this.all.map((q) => [keyOf(q.e), q]));
    const due = Object.entries(this.db.cards).filter(([, c]) => c.box < MASTERED && c.due <= t)
      .sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([k]) => byKey.get(k)).filter(Boolean).slice(0, DAILY_SIZE);
    // New positions: round-robin over the weakest concepts (lowest guess accuracy, then most games).
    const concepts = [...this.report.concepts].sort((a, b) => this.conceptWeakness(a.id) - this.conceptWeakness(b.id) || b.games - a.games);
    const fresh = concepts.map((c) => this.all.filter((q) => q.c.id === c.id && !this.db.cards[keyOf(q.e)]));
    const picked = [];
    for (let round = 0; picked.length + due.length < DAILY_SIZE && round < 40; round++)
      for (const list of fresh.slice(0, 3)) if (list[round] && picked.length + due.length < DAILY_SIZE) picked.push(list[round]);
    this.queue = [...due, ...shuffle(picked)];
    this.qi = 0;
    this.daily = { results: [], streak: 0, bestStreak: 0, reviews: due.length };
    this.mode = "daily";
    this.engaged = false;
    this.beginQuestion(DAILY_SECONDS);
  }

  beginQuestion(seconds) { this.resetQuestion(); this.deadline = this.engaged ? Date.now() + seconds * 1000 : null; this.left = seconds; }

  nextDaily() {
    if (this.qi + 1 < this.queue.length) { this.qi++; this.beginQuestion(DAILY_SECONDS); return; }
    const days = this.db.days, t = day();
    if (days.last !== t) { days.streak = days.last === day(-1) ? days.streak + 1 : 1; days.last = t; }
    this.persist();
    this.sound("done");
    this.deadline = null;
    this.mode = "result";
    this.result = { kind: "daily", ...this.daily, tomorrow: Object.values(this.db.cards).filter((c) => c.box < MASTERED && c.due <= day(1)).length };
  }

  // ---------- rush ----------
  startRush() {
    // Easy first: the bigger the swing, the more obvious the punishment. Shuffle within bands for variety.
    const sorted = [...this.all].sort((a, b) => (b.e.win_before - b.e.win_after) - (a.e.win_before - a.e.win_after));
    this.queue = [];
    for (let i = 0; i < sorted.length; i += 15) this.queue.push(...shuffle(sorted.slice(i, i + 15)));
    this.qi = 0;
    this.rush = { score: 0, lives: RUSH_LIVES };
    this.mode = "rush";
    this.resetQuestion();
    this.engaged = false;
    this.deadline = null;
    this.left = RUSH_SECONDS;
  }

  nextRush() {
    if (this.rush.lives <= 0 || this.qi + 1 >= this.queue.length) return this.endRush();
    this.qi++; this.resetQuestion();
  }

  endRush(cx) {
    if (this.mode !== "rush") return;
    const best = this.rush.score > this.db.rushBest;
    if (best) { this.db.rushBest = this.rush.score; this.persist(); }
    this.sound("done");
    this.deadline = null;
    this.mode = "result";
    this.result = { kind: "rush", score: this.rush.score, best, record: this.db.rushBest, lives: this.rush.lives };
    cx?.notify();
  }

  startExplore(random) {
    this.mode = "explore"; this.deadline = null; this.listOpen = false;
    if (random) {
      const cs = this.report.concepts;
      this.ci = Math.floor(Math.random() * cs.length);
      this.ei = Math.floor(Math.random() * cs[this.ci].examples.length);
    }
    this.resetQuestion();
  }

  // ---------- agent ----------
  prompt() {
    const { c, e } = this.current();
    return `Gw lagi belajar catur dari game gw sendiri (gw main ${e.me === "white" ? "putih" : "hitam"}). ` +
      `Posisi FEN: ${e.fen} . Langkah ke-${e.move_no} gw main ${e.played}; Stockfish bilang terbaik ${e.best} (${e.best_line.join(" ")}), ` +
      `dan lawan bisa bales ${e.reply_line.join(" ") || "-"}. Peluang menang gw turun ${e.win_before}% -> ${e.win_after}%. ` +
      `Konsepnya: ${c.name} (${c.name_id}). Jelasin pakai bahasa santai: apa yang gw lewatkan, ide di balik langkah terbaik, ` +
      `dan satu kebiasaan berpikir biar nggak ngulang. Singkat aja.`;
  }

  async ask() {
    const mine = panes().find((p) => p.pane === props()?.pane) || panes().find((p) => p.mod === "chess-coach");
    const tab = mine?.tab ?? focused()?.tab;
    const agent = agents().find((a) => a.tab === tab);
    if (!agent) {
      run("pane.split", { direction: "down", argv: ["claude"] });
      notify({ title: "Claude dibuka di bawah papan", body: "Tekan 'a' lagi setelah Claude siap.", level: "info" });
      return;
    }
    // "done" = finished while nobody looked; it's as ready as "idle".
    if (agent.status === "working" || agent.status === "blocked") {
      notify({ title: "Agent lagi sibuk", body: "Tunggu dia selesai, lalu tekan 'a' lagi.", level: "warning" });
      return;
    }
    const r = await hc(["send", agent.address, this.prompt()]);
    if (r.code !== 0) notify({ title: "Gagal kirim ke agent", body: (r.stderr || r.stdout || `exit ${r.code}`).trim().slice(0, 200), level: "error" });
  }

  // ---------- input ----------
  next() {
    if (this.mode === "daily") this.nextDaily();
    else if (this.mode === "rush") this.nextRush();
  }

  key(ev, cx) {
    const k = ev.keystroke, m = this.mode;
    if (k === "m") { this.db.mute = !this.db.mute; this.persist(); }
    else if (k === "r") this.load(cx);
    else if (k === "1") this.startDaily();
    else if (k === "2") this.startRush();
    else if (k === "3") this.startExplore();
    else if (k === "escape") { if (this.pick) this.pick = null; else if (this.listOpen) this.listOpen = false; else return; }
    else if (m === "result") { if (k !== "enter") return; if (this.result.kind === "daily") this.startDaily(); else this.startRush(); } else if (k === "space" && m !== "rush") { if (!this.guess && !this.timedOut) this.revealed = !this.revealed; }
    else if (k === "enter" && m === "daily" && this.shown()) this.next();
    else if (k === "a" && m !== "rush" && this.current()) cx.spawn(async () => this.ask());
    else if (k === "o" && m !== "rush" && this.current()) cx.open_url(this.current().e.link);
    else if (m === "explore" && (k === "up" || k === "down")) this.browse(k === "up" ? -1 : 1, 0);
    else if (m === "explore" && (k === "left" || k === "right")) this.browse(0, k === "left" ? -1 : 1);
    else if (m === "explore" && k === "c") this.listOpen = !this.listOpen;
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  browse(dc, de) {
    const cs = this.report.concepts;
    if (dc) { this.ci = Math.max(0, Math.min(this.ci + dc, cs.length - 1)); this.ei = 0; }
    else this.ei = Math.max(0, Math.min(this.ei + de, cs[this.ci].examples.length - 1));
    this.resetQuestion();
  }

  // ---------- drawing ----------
  button(t, id, label, onClick, strong) {
    return div().id(id).flex_none().px(8).py(4).rounded(5).text_size(11).cursor_pointer()
      .bg(strong ? t.solid : t.raised).text_color(strong ? t.solid_foreground : t.foreground)
      .hover((s) => s.bg(strong ? t.accent : t.hover))
      .on_click((_e, cx) => { onClick(cx); this.h.focus(); cx.notify(); }).child(label);
  }

  board(e, sq) {
    const at = parseFen(e.fen), flip = e.me === "black";
    const marks = {};
    const mark = (uci, kind) => { if (uci) { marks[uci.slice(0, 2)] = kind; marks[uci.slice(2, 4)] = kind; } };
    if (this.shown() && this.mode !== "rush") {
      mark(e.played_uci, "played");
      if (this.guess && !this.right()) mark(this.guess, "guess");
      mark(e.best_uci, "best");
    } else if (this.shown() && !this.right()) mark(e.best_uci, "best");
    else if (this.pick) marks[this.pick] = "pick";
    const a = this.anim;
    const xy = (name) => {
      const file = name.charCodeAt(0) - 97, rank = Number(name[1]);
      return flip ? { x: (7 - file) * sq, y: (rank - 1) * sq } : { x: file * sq, y: (8 - rank) * sq };
    };
    const rows = [];
    for (let r = 0; r < 8; r++) {
      const cells = [];
      for (let c = 0; c < 8; c++) {
        const file = flip ? 7 - c : c, rank = flip ? r + 1 : 8 - r;
        const name = `${"abcdefgh"[file]}${rank}`, light = (file + rank) % 2 === 1;
        const m = marks[name], bg = m ? MARK[m][light ? 0 : 1] : light ? LIGHT : DARK;
        const ink = light ? DARK : LIGHT;
        let cell = div().id(`sq-${name}`).w(sq).h(sq).bg(bg).relative()
          .when(!this.shown(), (el) => el.cursor_pointer().on_click((_e, cx) => { this.clickSquare(name, at, cx); this.h.focus(); cx.notify(); }));
        if (c === 0) cell = cell.child(div().absolute().top(1).left(3).text_size(Math.max(9, sq / 7)).text_color(ink).child(String(rank)));
        if (r === 7) cell = cell.child(div().absolute().bottom(1).right(3).text_size(Math.max(9, sq / 7)).text_color(ink).child("abcdefgh"[file]));
        const hidden = a && (name === a.from || name === a.to);
        if (at[name] && !hidden) cell = cell.child(image(`mods/chess-coach/pieces/${at[name]}.svg`).w(sq).h(sq));
        cells.push(cell);
      }
      rows.push(h_flex().children(cells));
    }
    let grid = v_flex().relative().flex_none().rounded(3).overflow_hidden().children(rows);
    if (a) {
      const from = xy(a.from), to = xy(a.to), p = a.phase ? to : from;
      grid = grid
        .child(div().id("flash").absolute().left(to.x).top(to.y).w(sq).h(sq).bg(a.ok ? "#4caf50" : "#e5484d")
          .opacity(a.phase ? 0 : 0.7).transition("opacity", { duration: 700, easing: "ease-out" }))
        .child(image(`mods/chess-coach/pieces/${a.piece}.svg`).id("slide").absolute().left(p.x).top(p.y).w(sq).h(sq)
          .transition("left", { duration: 180, easing: "ease-out" }).transition("top", { duration: 180, easing: "ease-out" }));
    }
    return grid;
  }

  boardSize(reserve) {
    // on_size_change reports zoomed pixels while .w()/.h() get zoomed again: undo it.
    const z = settings()?.zoom || 1;
    return Math.max(20, Math.floor(Math.min(this.size.width / z - 24, this.size.height / z - reserve) / 8));
  }

  feedback(t, q) {
    const e = q.e, lines = [];
    const sqs = (uci) => `${uci.slice(0, 2)}–${uci.slice(2, 4)}`;
    if (!this.shown()) {
      const waiting = !this.engaged && (this.mode === "daily" || this.mode === "rush");
      if (waiting) lines.push(div().text_size(11).text_color(t.muted).child(this.mode === "daily"
        ? `Sesi hari ini: ${this.queue.length} posisi, ${DAILY_SECONDS} detik per posisi. Timer jalan setelah lo klik bidak.`
        : `${RUSH_SECONDS / 60} menit, ${RUSH_LIVES} nyawa. Timer jalan setelah lo klik bidak.`));
      lines.push(div().text_size(12).text_color(this.note ? t.blocked : t.accent).child(this.note || (this.pick
        ? `${this.pick} dipilih. Klik petak tujuannya.`
        : `Langkah ${e.move_no}, lo ${e.me === "white" ? "putih" : "hitam"} (${e.win_before}%). Cari langkah terbaik.`)));
      return v_flex().gap(4).children(lines);
    }
    const ok = this.right();
    const san = this.guess ? e.legal?.[this.guess] || sqs(this.guess) : null;
    const headline = this.timedOut ? "⏱ Waktu habis" : ok ? `✓ ${san}` : this.guess === e.played_uci?.slice(0, 4)
      ? `✗ ${san}: langkah yang dulu lo mainin` : this.guess ? `✗ ${san}` : "Jawaban";
    lines.push(h_flex().flex_wrap().gap(5).items_center().text_size(13)
      .child(div().font_semibold().text_color(this.timedOut || (this.guess && !ok) ? t.blocked : this.guess ? t.done : t.foreground).child(headline))
      .when(!ok, (el) => el.child(div().text_color(t.muted).child("· terbaik")).child(div().font_semibold().text_color(t.done).child(e.best || "-"))));
    if (this.mode !== "rush") {
      lines.push(div().text_size(11).text_color(t.muted).child(`Dulu: ${e.played} (${e.win_before}% → ${e.win_after}%)${e.reply_line.length ? ` · lawan bisa ${e.reply_line.join(" ")}` : ""}`));
      lines.push(div().text_size(11).text_color(t.muted).child(`${q.c.name}: ${q.c.why}`));
    }
    return v_flex().gap(4).children(lines);
  }

  header(t, title, sub, right) {
    return h_flex().gap(8).items_center()
      .child(v_flex().flex_1().min_w(0)
        .child(div().text_size(13).font_semibold().truncate().child(title))
        .when(!!sub, (el) => el.child(div().text_size(11).text_color(t.muted).truncate().child(sub))))
      .child(right || div());
  }

  clock(t, secs, warn) {
    return div().flex_none().px(8).py(2).rounded(5).text_size(13).font_semibold()
      .bg(secs <= warn ? t.blocked : t.raised).text_color(secs <= warn ? t.accent_foreground : t.foreground)
      .child(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
  }

  topBar(t) {
    const d = this.db.days, cards = Object.values(this.db.cards), t0 = day();
    const streak = d.last === t0 || d.last === day(-1) ? d.streak : 0;
    const mastered = cards.filter((c) => c.box >= MASTERED).length;
    const chip = (id, label, mode, go) => {
      const on = this.mode === mode || (this.mode === "result" && this.result?.kind === mode);
      return div().id(id).flex_none().px(9).py(3).rounded(12).text_size(11).cursor_pointer()
        .bg(on ? t.selected : t.background).border(1).border_color(on ? t.accent : t.border)
        .text_color(on ? t.foreground : t.muted).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { go(); this.h.focus(); cx.notify(); }).child(label);
    };
    const stats = [d.last === t0 ? `✓ hari ini · 🔥${streak}` : streak ? `🔥${streak}` : null, `${this.dueCount()} jatuh tempo`, `${mastered} dikuasai`].filter(Boolean).join(" · ");
    return h_flex().flex_wrap().gap(6).items_center()
      .child(chip("m-daily", "Harian", "daily", () => this.startDaily()))
      .child(chip("m-rush", `Rush · ${this.db.rushBest}`, "rush", () => this.startRush()))
      .child(chip("m-explore", "Jelajahi", "explore", () => this.startExplore()))
      .child(div().flex_1().min_w(0).text_size(10).text_color(t.dim).truncate().child(stats))
      .child(div().id("mute").flex_none().cursor_pointer().text_size(12).text_color(t.muted)
        .on_click((_e, cx) => { this.db.mute = !this.db.mute; this.persist(); cx.notify(); }).child(this.db.mute ? "🔇" : "🔊"));
  }

  resultView(t) {
    const r = this.result;
    if (r.kind === "rush") {
      return v_flex().gap(10)
        .child(div().text_size(16).font_semibold().child(r.best ? "Rekor baru!" : "Rush selesai"))
        .child(div().text_size(32).font_semibold().child(String(r.score)))
        .child(div().text_size(12).text_color(t.muted).child(`${r.lives > 0 ? "Waktu habis" : "Nyawa habis"} · rekor ${r.record}`))
        .child(h_flex().gap(6).child(this.button(t, "again", "Main lagi (enter)", () => this.startRush(), true)).child(this.button(t, "back", "Jelajahi (3)", () => this.startExplore())));
    }
    const right = r.results.filter((x) => x.ok).length;
    const per = {};
    for (const x of r.results) { per[x.concept] ||= { ok: 0, n: 0 }; per[x.concept].n++; if (x.ok) per[x.concept].ok++; }
    const name = (id) => this.report.concepts.find((c) => c.id === id)?.name || id;
    return v_flex().gap(10)
      .child(div().text_size(16).font_semibold().child("Sesi selesai"))
      .child(h_flex().gap(8)
        .children([[`${right}/${r.results.length}`, "benar"], [`${r.bestStreak}`, "streak terbaik"], [`${this.db.days.streak}`, "hari beruntun"]]
          .map(([n, label]) => v_flex().flex_1().p(8).rounded(6).bg(t.surface).border(1).border_color(t.border)
            .child(div().text_size(18).font_semibold().child(n)).child(div().text_size(10).text_color(t.muted).child(label)))))
      .child(v_flex().gap(3).children(Object.entries(per).map(([id, s]) => h_flex().justify_between().text_size(12)
        .child(div().truncate().child(name(id)))
        .child(div().flex_none().text_color(s.ok === s.n ? t.done : s.ok === 0 ? t.blocked : t.muted).child(`${s.ok}/${s.n}`)))))
      .child(div().text_size(11).text_color(t.muted).child(`Besok: ${r.tomorrow} posisi jatuh tempo.`))
      .child(h_flex().gap(6).child(this.button(t, "again", "Sesi lagi (enter)", () => this.startDaily(), true)).child(this.button(t, "back", "Jelajahi (3)", () => this.startExplore())));
  }

  playView(t) {
    const q = this.current();
    if (!q) return div().text_size(12).text_color(t.muted).child("Nggak ada posisi.");
    if (this.mode === "daily") {
      const d = this.daily, review = this.qi < d.reviews;
      return v_flex().gap(8)
        .child(this.header(t, `Sesi harian · ${this.qi + 1}/${this.queue.length}`, `${review ? "Ulangan" : "Baru"} · ${q.c.name}${d.streak > 1 ? ` · 🔥 ${d.streak}` : ""}`, this.clock(t, this.left ?? DAILY_SECONDS, 10)))
        .child(this.board(q.e, this.boardSize(230)))
        .child(this.feedback(t, q))
        .child(h_flex().flex_wrap().gap(5)
          .when(this.shown(), (el) => el.child(this.button(t, "next", this.qi + 1 < this.queue.length ? "Lanjut (enter)" : "Lihat hasil (enter)", () => this.nextDaily(), true)))
          .when(!this.shown(), (el) => el.child(this.button(t, "reveal", "Nyerah (spasi)", () => { this.revealed = true; this.record(q, false); })))
          .when(this.shown(), (el) => el.child(this.button(t, "ask", "Tanya agent (a)", (cx) => cx.spawn(async () => this.ask())))));
    }
    if (this.mode === "rush") {
      const r = this.rush;
      return v_flex().gap(8)
        .child(this.header(t, `Rush · ${r.score} benar`, `${"♥".repeat(r.lives)}${"♡".repeat(RUSH_LIVES - r.lives)} · rekor ${this.db.rushBest}`, this.clock(t, this.left ?? RUSH_SECONDS, 20)))
        .child(this.board(q.e, this.boardSize(150)))
        .child(this.feedback(t, q));
    }
    // explore
    const c = q.c, n = this.report.concepts.length;
    const head = h_flex().gap(6).items_center()
      .child(this.button(t, "cprev", "▲", () => this.browse(-1, 0)))
      .child(this.button(t, "cnext", "▼", () => this.browse(1, 0)))
      .child(v_flex().id("title").flex_1().min_w(0).cursor_pointer()
        .on_click((_e, cx) => { this.listOpen = !this.listOpen; cx.notify(); })
        .child(div().text_size(13).font_semibold().truncate().child(c.name))
        .child(div().text_size(11).text_color(t.muted).truncate().child(`${c.name_id} · ${c.games} game${c.mechanical ? "" : " · tafsiran"}`)))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(`${this.ci + 1}/${n}`));
    if (this.listOpen) {
      return v_flex().gap(8).size_full().child(head).child(v_flex().id("concepts").flex_1().min_h(0).overflow_y_scrollbar()
        .children(this.report.concepts.map((x, i) => h_flex().id(`c-${i}`).px(8).py(5).gap(8).rounded(5).items_center().cursor_pointer()
          .bg(i === this.ci ? t.selected : t.background).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { this.ci = i; this.ei = 0; this.resetQuestion(); this.listOpen = false; this.h.focus(); cx.notify(); })
          .child(div().w(18).flex_none().text_size(11).text_color(t.dim).child(`${i + 1}`))
          .child(div().flex_1().min_w(0).text_size(12).truncate().child(x.name))
          .child(div().flex_none().text_size(11).text_color(t.muted).child(`${x.games}${x.mechanical ? "" : "~"}`)))));
    }
    return v_flex().gap(8)
      .child(head)
      .child(this.board(q.e, this.boardSize(210)))
      .child(h_flex().flex_wrap().gap(5).items_center()
        .child(this.button(t, "prev", "◀", () => this.browse(0, -1)))
        .child(div().text_size(11).text_color(t.muted).child(`${this.ei + 1}/${c.examples.length}`))
        .child(this.button(t, "nextex", "▶", () => this.browse(0, 1)))
        .child(this.guess || this.timedOut
          ? this.button(t, "retry", "Ulang", () => this.resetQuestion())
          : this.button(t, "reveal", this.revealed ? "Tutup" : "Jawaban", () => { this.revealed = !this.revealed; this.pick = null; }))
        .child(this.button(t, "ask", "Tanya", (cx) => cx.spawn(async () => this.ask())))
        .child(this.button(t, "game", "Game", (cx) => cx.open_url(q.e.link)))
        .child(this.button(t, "practice", "Latihan", (cx) => cx.open_url(c.practice))))
      .child(this.feedback(t, q));
  }

  render(cx) {
    const t = theme();
    const root = v_flex().id("root").size_full().p(12).gap(8).bg(t.background).text_color(t.foreground)
      .overflow_y_scrollbar()
      .track_focus(this.h).on_key_down((e, cx) => this.key(e, cx))
      .on_mouse_down("left", () => this.h.focus())
      .on_size_change((size, cx) => { this.size = size; cx.notify(); });
    if (this.error || !this.report || !this.all) return root.child(div().text_size(12).text_color(t.muted).child(this.error || "Memuat…"));
    root.child(this.topBar(t));
    if (this.mode === "result") return root.child(this.resultView(t));
    return root.child(this.playView(t));
  }
}
