// Chess coach: the concepts to study, ranked from bosbandid's own games
// (analysis/report.json from ~/Development/Projects/chess.com), each shown on a board
// with real positions where the mistake happened.
// Guess mode: the played move stays hidden; click a piece, then a square. The first guess per
// position counts toward the concept's score (localStorage). Only Stockfish's single best move
// counts as right (the report keeps one PV), and legality isn't checked.
// Keys: up/down concept, left/right example, space reveal, o open game, p practice, a ask the agent, c concepts.
import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { readTextFile, home, appHome, theme, settings, panes, agents, focused, props, hc, run, notify, nextCommand } from "herdr";
import * as fs from "fs/promises";

const REPORT = () => props()?.report || `${home()}/Development/Projects/chess.com/analysis/report.json`;
const LIGHT = "#f0d9b5", DARK = "#b58863";
const MARK = { played: ["#f2a08f", "#d0705c"], best: ["#cdd26a", "#aaa23a"], pick: ["#f7ec74", "#dac34b"], guess: ["#a9c8ec", "#7ba3cf"] };
const SCORE_KEY = "chess-coach-score";
const ROLE = { allowed: "dimanfaatkan lawan", missed: "peluang yang lo lewatkan", game: "posisi menang lepas", unexplained: "tanpa pola taktik jelas" };

function parseFen(fen) {
  const rows = fen.split(" ")[0].split("/");
  const at = {};
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else { at[`${"abcdefgh"[f]}${8 - r}`] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase(); f++; }
    }
  });
  return at;
}

export default class ChessCoach extends View {
  init(_props, cx) {
    this.ci = 0; this.ei = 0; this.revealed = false; this.size = { width: 900, height: 700 };
    this.pick = null; this.guess = null;
    try { this.tries = JSON.parse(localStorage.getItem(SCORE_KEY) || "{}"); } catch { this.tries = {}; }
    this.h = cx.focus_handle();
    this.load(cx);
    cx.spawn(async (cx) => { for (;;) { const c = await nextCommand(); if (c === "focus") this.h.focus(); cx.notify(); } });
  }

  load(cx) {
    cx.spawn(async (cx) => {
      try { this.report = JSON.parse(await readTextFile(REPORT())); this.error = null; }
      catch (e) { this.error = `Belum ada laporan di ${REPORT()} (${e})`; }
      this.clamp(); this.save(); cx.notify();
    });
  }

  concept() { return this.report?.concepts?.[this.ci]; }
  example() { return this.concept()?.examples?.[this.ei]; }

  clamp() {
    const cs = this.report?.concepts || [];
    this.ci = Math.max(0, Math.min(this.ci, cs.length - 1));
    this.ei = Math.max(0, Math.min(this.ei, (cs[this.ci]?.examples?.length || 1) - 1));
  }

  go(dc, de) {
    if (dc) { this.ci += dc; this.ei = 0; } else this.ei += de;
    this.revealed = false; this.pick = null; this.guess = null; this.clamp(); this.save();
  }

  shown() { return this.revealed || this.guess !== null; }
  right() { const e = this.example(); return !!(this.guess && e?.best_uci && this.guess === e.best_uci.slice(0, 4)); }

  // tries: { "<game link>#<ply>": { concept, right } }, first guess only.
  score(conceptId) {
    const all = Object.values(this.tries).filter((x) => x.concept === conceptId);
    return { right: all.filter((x) => x.right).length, total: all.length };
  }

  clickSquare(name, at) {
    const e = this.example();
    if (!e || this.shown()) return;
    const mine = at[name]?.[0] === e.me[0];
    if (mine) { this.pick = this.pick === name ? null : name; return; }
    if (!this.pick) return;
    this.guess = this.pick + name;
    this.pick = null;
    const key = `${e.link}#${e.ply}`;
    if (!this.tries[key]) {
      this.tries[key] = { concept: this.concept().id, right: this.right() };
      try { localStorage.setItem(SCORE_KEY, JSON.stringify(this.tries)); } catch {}
    }
  }

  // The agent beside the board reads this to know what's on it.
  save() {
    const c = this.concept(), e = this.example();
    if (!c || !e) return;
    fs.writeFile(`${appHome()}/mods/chess-coach/.current.json`,
      JSON.stringify({ concept: c.name, concept_id: c.name_id, why: c.why, ...e }, null, 1)).catch(() => {});
  }

  prompt() {
    const c = this.concept(), e = this.example();
    return `Gw lagi belajar catur dari game gw sendiri (gw main ${e.me === "white" ? "putih" : "hitam"}). ` +
      `Posisi FEN: ${e.fen} . Langkah ke-${e.move_no} gw main ${e.played}; Stockfish bilang terbaik ${e.best} (${e.best_line.join(" ")}), ` +
      `dan lawan bisa bales ${e.reply_line.join(" ") || "-"}. Peluang menang gw turun ${e.win_before}% -> ${e.win_after}%. ` +
      `Konsepnya: ${c.name} (${c.name_id}). Jelasin pakai bahasa santai: apa yang gw lewatkan, ide di balik langkah terbaik, ` +
      `dan satu kebiasaan berpikir biar nggak ngulang. Singkat aja.`;
  }

  async ask(cx) {
    // As a pane: the agent in our tab. As a layout block: the agent in the shown tab.
    const mine = panes().find((p) => p.pane === props()?.pane) || panes().find((p) => p.mod === "chess-coach");
    const tab = mine?.tab ?? focused()?.tab;
    const agent = agents().find((a) => a.tab === tab);
    if (!agent) {
      run("pane.split", { direction: "down", argv: ["claude"] });
      notify({ title: "Claude dibuka di bawah papan", body: "Tekan 'a' lagi setelah Claude siap.", level: "info" });
      return;
    }
    // "done" = finished while nobody looked; it's as ready as "idle" (hc send --if only knows idle/working).
    if (agent.status === "working" || agent.status === "blocked") {
      notify({ title: "Agent lagi sibuk", body: "Tunggu dia selesai, lalu tekan 'a' lagi.", level: "warning" });
      return;
    }
    const r = await hc(["send", agent.address, this.prompt()]);
    if (r.code !== 0) notify({ title: "Gagal kirim ke agent", body: (r.stderr || r.stdout || `exit ${r.code}`).trim().slice(0, 200), level: "error" });
  }

  key(e, cx) {
    const k = e.keystroke;
    if (k === "up" || k === "k") this.go(-1, 0);
    else if (k === "down" || k === "j") this.go(1, 0);
    else if (k === "left" || k === "h") this.go(0, -1);
    else if (k === "right" || k === "l") this.go(0, 1);
    else if (k === "space") this.revealed = !this.revealed;
    else if (k === "escape" && this.pick) this.pick = null;
    else if (k === "o" && this.example()) cx.open_url(this.example().link);
    else if (k === "p" && this.concept()) cx.open_url(this.concept().practice);
    else if (k === "a" && this.example()) cx.spawn(async (cx) => this.ask(cx));
    else if (k === "c") this.listOpen = !this.listOpen;
    else if (k === "escape" && this.listOpen) this.listOpen = false;
    else if (k === "r") this.load(cx);
    else return;
    cx.stop_propagation();
    cx.notify();
  }

  button(t, id, label, onClick) {
    return div().id(id).flex_none().px(7).py(3).rounded(5).bg(t.raised).text_size(11)
      .cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { onClick(cx); cx.notify(); }).child(label);
  }

  board(e, sq) {
    const at = parseFen(e.fen), flip = e.me === "black";
    const marks = {};
    const mark = (uci, kind) => { if (uci) { marks[uci.slice(0, 2)] = kind; marks[uci.slice(2, 4)] = kind; } };
    if (this.shown()) {
      mark(e.played_uci, "played");
      if (this.guess && !this.right()) mark(this.guess, "guess");
      mark(e.best_uci, "best");
    } else if (this.pick) marks[this.pick] = "pick";
    const rows = [];
    for (let r = 0; r < 8; r++) {
      const cells = [];
      for (let c = 0; c < 8; c++) {
        const file = flip ? 7 - c : c, rank = flip ? r + 1 : 8 - r;
        const name = `${"abcdefgh"[file]}${rank}`, light = (file + rank) % 2 === 1;
        const m = marks[name], bg = m ? MARK[m][light ? 0 : 1] : light ? LIGHT : DARK;
        const ink = light ? DARK : LIGHT;
        let cell = div().id(`sq-${name}`).w(sq).h(sq).bg(bg).relative()
          .when(!this.shown(), (el) => el.cursor_pointer().on_click((_e, cx) => { this.clickSquare(name, at); this.h.focus(); cx.notify(); }));
        if (c === 0) cell = cell.child(div().absolute().top(1).left(3).text_size(Math.max(9, sq / 7)).text_color(ink).child(String(rank)));
        if (r === 7) cell = cell.child(div().absolute().bottom(1).right(3).text_size(Math.max(9, sq / 7)).text_color(ink).child("abcdefgh"[file]));
        if (at[name]) cell = cell.child(image(`mods/chess-coach/pieces/${at[name]}.svg`).w(sq).h(sq));
        cells.push(cell);
      }
      rows.push(h_flex().children(cells));
    }
    return v_flex().flex_none().rounded(3).overflow_hidden().children(rows);
  }

  // The concept picker: replaces the board while open (click the title or press c).
  list(t) {
    const cs = this.report.concepts;
    return v_flex().id("concepts").flex_1().min_h(0).overflow_y_scrollbar()
      .children(cs.map((c, i) => h_flex().id(`c-${i}`).px(8).py(5).gap(8).rounded(5).items_center().cursor_pointer()
        .bg(i === this.ci ? t.selected : t.background).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.ci = i; this.ei = 0; this.revealed = false; this.listOpen = false; this.save(); this.h.focus(); cx.notify(); })
        .child(div().w(18).flex_none().text_size(11).text_color(t.dim).child(`${i + 1}`))
        .child(div().flex_1().min_w(0).text_size(12).truncate().child(c.name))
        .child(div().flex_none().text_size(11).text_color(t.muted).child(`${c.games}${c.mechanical ? "" : "~"}`))));
  }

  detail(t, c, e) {
    const winColor = (w) => (w >= 60 ? t.done : w >= 40 ? t.foreground : t.blocked);
    const clock = e.clock != null ? ` · jam ${Math.floor(e.clock / 60)}:${String(Math.floor(e.clock % 60)).padStart(2, "0")}` : "";
    const sq = (uci) => `${uci.slice(0, 2)}–${uci.slice(2, 4)}`;
    const lines = [];
    if (!this.shown()) {
      lines.push(div().text_size(13).child(`Langkah ${e.move_no}, lo ${e.me === "white" ? "putih" : "hitam"} · peluang menang ${e.win_before}%`));
      lines.push(div().text_size(12).text_color(t.accent).child(this.pick
        ? `${this.pick} dipilih. Klik petak tujuannya (Esc batal).`
        : "Langkah terbaik di sini apa? Klik bidak lo, lalu petak tujuannya."));
    } else {
      if (this.guess) {
        const again = e.played_uci && this.guess === e.played_uci.slice(0, 4);
        lines.push(div().text_size(13).font_semibold().text_color(this.right() ? t.done : t.blocked).child(this.right()
          ? `✓ Benar: ${e.best}`
          : again ? `✗ ${sq(this.guess)}: itu langkah yang dulu lo mainin` : `✗ Tebakan lo ${sq(this.guess)} (biru)`));
      }
      lines.push(h_flex().flex_wrap().gap(5).text_size(13)
        .child(div().text_color(t.muted).child(`${e.move_no}. dulu`))
        .child(div().font_semibold().text_color("#d0705c").child(e.played))
        .child(div().text_color(winColor(e.win_before)).child(`${e.win_before}%`))
        .child(div().text_color(t.muted).child("→"))
        .child(div().text_color(winColor(e.win_after)).child(`${e.win_after}%`))
        .child(div().text_color(t.muted).child("· terbaik"))
        .child(div().font_semibold().text_color(t.done).child(e.best || "-")));
    }
    if (this.shown()) {
      if (e.reply_line.length) lines.push(div().text_size(11).text_color(t.muted).child(`Lawan bisa: ${e.reply_line.join(" ")}`));
      lines.push(div().text_size(11).text_color(t.muted).child(c.why));
    }
    lines.push(div().text_size(11).text_color(t.dim).truncate().child(`${e.date} · vs ${e.me === "white" ? e.black : e.white} · ${e.result === "win" ? "menang" : e.result === "draw" ? "seri" : "kalah"}${clock}`));
    return v_flex().gap(4).children(lines);
  }

  render(cx) {
    const t = theme();
    const root = v_flex().id("root").size_full().p(12).gap(8).bg(t.background).text_color(t.foreground)
      .track_focus(this.h).on_key_down((e, cx) => this.key(e, cx))
      .on_mouse_down("left", () => this.h.focus())
      .on_size_change((size, cx) => { this.size = size; cx.notify(); });
    if (this.error || !this.report) return root.child(div().text_size(12).text_color(t.muted).child(this.error || "Memuat…"));
    const c = this.concept(), e = this.example(), n = this.report.concepts.length;
    root.child(h_flex().gap(6).items_center()
      .child(this.button(t, "cprev", "▲", () => this.go(-1, 0)))
      .child(this.button(t, "cnext", "▼", () => this.go(1, 0)))
      .child(v_flex().id("title").flex_1().min_w(0).cursor_pointer()
        .on_click((_e, cx) => { this.listOpen = !this.listOpen; cx.notify(); })
        .child(div().text_size(13).font_semibold().truncate().child(c.name))
        .child(div().text_size(11).text_color(t.muted).truncate().child((() => {
          const s = this.score(c.id);
          return `${c.name_id} · ${c.games} game${c.mechanical ? "" : " · tafsiran"}${s.total ? ` · tebakan ${s.right}/${s.total}` : ""}`;
        })())))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(`${this.ci + 1}/${n}`)));
    if (this.listOpen) return root.child(this.list(t));
    if (!e) return root;
    // on_size_change reports zoomed pixels while .w()/.h() get zoomed again: undo it.
    const z = settings()?.zoom || 1;
    const sq = Math.max(20, Math.floor(Math.min(this.size.width / z - 24, this.size.height / z - 190) / 8));
    return root
      .child(this.board(e, sq))
      .child(h_flex().flex_wrap().gap(5).items_center()
        .child(this.button(t, "prev", "◀", () => this.go(0, -1)))
        .child(div().text_size(11).text_color(t.muted).child(`${this.ei + 1}/${c.examples.length}`))
        .child(this.button(t, "next", "▶", () => this.go(0, 1)))
        .when(!this.guess, (el) => el.child(this.button(t, "reveal", this.revealed ? "Tutup" : "Jawaban", () => { this.revealed = !this.revealed; this.pick = null; })))
        .when(!!this.guess, (el) => el.child(this.button(t, "retry", "Ulang", () => { this.guess = null; this.revealed = false; })))
        .child(this.button(t, "ask", "Tanya", (cx) => cx.spawn(async (cx) => this.ask(cx))))
        .child(this.button(t, "game", "Game", (cx) => cx.open_url(e.link)))
        .child(this.button(t, "practice", "Latihan", (cx) => cx.open_url(c.practice))))
      .child(this.detail(t, c, e));
  }
}
