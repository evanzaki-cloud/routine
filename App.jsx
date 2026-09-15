import { useState, useEffect, useMemo } from "react";
import { Check, Settings, X, BookOpen } from "lucide-react";
import { storage } from "./storage.js";

/* ---------- dates (day rolls over at 4 a.m., not midnight) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return fmt(d); };
function nowShifted() { const d = new Date(); d.setHours(d.getHours() - 4); return d; }
const todayKey = () => fmt(nowShifted());
const autoTab = () => (nowShifted().getHours() < 15 ? "morning" : "night");
const longDate = (k) => parseKey(k).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (k) => parseKey(k).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const weekday = (k) => parseKey(k).toLocaleDateString("en-GB", { weekday: "long" });
const ago = (n) => (n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);

/* ---------- program ---------- */
const SESSIONS = {
  upperA: { name: "Upper A", ex: [
    { id: "flatpress", name: "Flat dumbbell press", sets: 4, lo: 6, hi: 10 },
    { id: "onearmrow", name: "One-arm dumbbell row", sets: 4, lo: 8, hi: 12, each: true },
    { id: "shoulderpress", name: "Seated shoulder press", sets: 3, lo: 8, hi: 12 },
    { id: "inclinefly", name: "Incline fly", sets: 3, lo: 10, hi: 15 },
    { id: "lateral", name: "Lateral raise", sets: 3, lo: 12, hi: 20 },
    { id: "ohext", name: "Overhead triceps extension", sets: 3, lo: 10, hi: 15 },
    { id: "curl", name: "Dumbbell curl", sets: 3, lo: 10, hi: 15 },
  ] },
  lowerA: { name: "Lower A", ex: [
    { id: "goblet", name: "Goblet squat, heels raised", sets: 4, lo: 8, hi: 12 },
    { id: "rdl", name: "Romanian deadlift", sets: 4, lo: 8, hi: 12 },
    { id: "bss", name: "Bulgarian split squat", sets: 3, lo: 8, hi: 12, each: true },
    { id: "hipthrust", name: "Hip thrust, back on bench", sets: 3, lo: 10, hi: 15 },
    { id: "calf", name: "Standing calf raise", sets: 3, lo: 15, hi: 20 },
    { id: "wcrunch", name: "Weighted crunch, dumbbell on chest", sets: 3, lo: 10, hi: 15 },
    { id: "legraise", name: "Lying leg raise", sets: 3, lo: 10, hi: 15 },
    { id: "plank", name: "Plank (seconds)", sets: 3, lo: 30, hi: 60, time: true },
  ] },
  upperB: { name: "Upper B", ex: [
    { id: "inclinepress", name: "Incline dumbbell press", sets: 4, lo: 6, hi: 10 },
    { id: "csrow", name: "Chest-supported row", sets: 4, lo: 8, hi: 12 },
    { id: "arnold", name: "Arnold press", sets: 3, lo: 8, hi: 12 },
    { id: "reardelt", name: "Rear-delt fly", sets: 3, lo: 12, hi: 20 },
    { id: "pullover", name: "Dumbbell pullover", sets: 3, lo: 10, hi: 15 },
    { id: "hammer", name: "Hammer curl", sets: 3, lo: 10, hi: 15 },
    { id: "skull", name: "Skull crusher", sets: 3, lo: 10, hi: 15 },
  ] },
  lowerB: { name: "Lower B", ex: [
    { id: "bssheavy", name: "Bulgarian split squat, heavy", sets: 4, lo: 8, hi: 12, each: true },
    { id: "stepup", name: "Step-ups onto bench", sets: 3, lo: 10, hi: 12, each: true },
    { id: "slrdl", name: "Single-leg Romanian deadlift", sets: 3, lo: 10, hi: 12, each: true },
    { id: "sumo", name: "Sumo squat", sets: 3, lo: 10, hi: 15 },
    { id: "calf", name: "Standing calf raise", sets: 3, lo: 15, hi: 20 },
    { id: "wcrunch", name: "Weighted crunch, dumbbell on chest", sets: 3, lo: 10, hi: 15 },
    { id: "revcrunch", name: "Reverse crunch", sets: 3, lo: 10, hi: 15 },
    { id: "plank", name: "Plank (seconds)", sets: 3, lo: 30, hi: 60, time: true },
  ] },
};
const ROTATION = ["upperA", "lowerA", "upperB", "lowerB"];

function nextSessionId(state) {
  const last = state.workouts[state.workouts.length - 1];
  if (!last) return ROTATION[0];
  return ROTATION[(ROTATION.indexOf(last.session) + 1) % ROTATION.length];
}
function lastEntry(state, exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const e = state.workouts[i].ex.find((x) => x.id === exId);
    if (e) return { ...e, date: state.workouts[i].date };
  }
  return null;
}
function suggest(ex, last, units) {
  if (ex.time) {
    if (!last) return { w: "", text: `First time. Hold each set as long as you can with good form; ${ex.lo}–${ex.hi} seconds is the target.` };
    const reps = last.reps.slice(0, ex.sets);
    const hitAll = reps.length >= ex.sets && reps.every((r) => r >= ex.hi);
    if (hitAll) return { w: last.w || "", add: true, text: `You held ${ex.hi} s on every set. Add weight on your back or aim for ${ex.hi + 10} s.` };
    return { w: last.w || "", text: `Last time: ${last.reps.join(", ")} s. Beat it.` };
  }
  if (!last) return { w: "", text: `First time. Pick a weight you can do for ${ex.lo} with a rep or two left in the tank.` };
  const reps = last.reps.slice(0, ex.sets);
  const hitAll = reps.length >= ex.sets && reps.every((r) => r >= ex.hi);
  const inc = units === "lb" ? 5 : 2.5;
  if (hitAll) return { w: last.w + inc, add: true, text: `You hit ${ex.hi} on every set at ${last.w} ${units}. Add weight: try ${last.w + inc}.` };
  return { w: last.w, text: `Last time: ${last.w} ${units} for ${last.reps.join(", ")}. Beat it.` };
}

/* ---------- routine rules ---------- */
const STORAGE_KEY = "routine-tracker-v1";
const defaultState = () => ({ v: 3, adapaleneStart: todayKey(), seeds: {}, threadingDone: false, dermDone: false, days: {}, trainingStart: null, units: "kg", workouts: [], active: null });
const migrate = (s) => ({ ...defaultState(), ...s, seeds: s.seeds || {}, days: s.days || {}, workouts: s.workouts || [], v: 3 });

function lastDone(state, id, before) {
  let best = null;
  for (const k of Object.keys(state.days)) {
    if (k < before && state.days[k][id] && (!best || k > best)) best = k;
  }
  const seed = state.seeds && state.seeds[id];
  if (seed && seed < before && (!best || seed > best)) best = seed;
  return best;
}
const since = (state, id, date) => { const l = lastDone(state, id, date); return l === null ? Infinity : diffDays(l, date); };

function adapalene(start, date) {
  const d = diffDays(start, date);
  if (d < 0) return { week: 0, phase: "not started", tonight: false, d };
  const week = Math.floor(d / 7) + 1;
  if (week <= 2) return { week, phase: "twice a week", tonight: d % 7 === 0 || d % 7 === 3, d };
  if (week <= 4) return { week, phase: "every other night", tonight: (d - 14) % 2 === 0, d };
  return { week, phase: "every night", tonight: true, d };
}
function nextAdapalene(start, date) {
  for (let i = 1; i <= 8; i++) { const k = addDays(date, i); if (adapalene(start, k).tonight) return k; }
  return null;
}

const UPKEEP = [
  { id: "stubble", title: "Stubble", every: "Every 2–3 days", due: 2, over: 4, hint: "2–4 mm. Neckline just above the Adam's apple; leave the cheek line alone." },
  { id: "am-keto", title: "Antifungal wash", every: "Twice a week", due: 3, over: 5, hint: "Ketoconazole 2% shampoo on the scalp, forehead and between the brows, left 3–5 minutes. It appears in the shower list when due." },
  { id: "am-deep", title: "Deep conditioner", every: "Weekly", due: 7, over: 10, hint: "Instead of regular conditioner on a shampoo day. Leave it in five minutes." },
  { id: "pillowcase", title: "Fresh pillowcase", every: "Every 3–4 days", due: 3, over: 5, hint: "Adapalene and skin oils end up on it." },
  { id: "brows", title: "Brow tidy", every: "Every 2–3 weeks", due: 14, over: 21, hint: "Only the bridge and strays under the arch. Spoolie up, trim anything long. Never thin them." },
  { id: "haircut", title: "Haircut", every: "Every 4–6 weeks", due: 28, over: 42, hint: "Someone who cuts curls. Length on top, tapered sides, cut dry." },
];

function buildDay(state, date) {
  const sinceWash = Math.min(since(state, "am-shampoo", date), since(state, "am-keto", date));
  const ketoDue = since(state, "am-keto", date) >= 3;
  const shampooDue = sinceWash >= 2;
  const deepDue = since(state, "am-deep", date) >= 7;
  const stubbleDue = since(state, "stubble", date) >= 2;
  const pillowDue = since(state, "pillowcase", date) >= 3;
  const ramp = adapalene(state.adapaleneStart, date);

  const morning = [
    { id: "weigh", title: "Weigh in, log it in MacroFactor", hint: "After the bathroom, before food or water." },
    ketoDue
      ? { id: "am-keto", title: "Ketoconazole 2% wash", hint: "Scalp, forehead and between the brows. Lather, leave 3–5 minutes, rinse. Counts as today's shampoo." }
      : shampooDue
        ? { id: "am-shampoo", title: "Shampoo", hint: "Sulfate-free. Next one in 2–3 days." }
        : { id: "am-rinse", title: "Rinse hair with water only", hint: `No shampoo today; last wash was ${ago(sinceWash)}.` },
    ((ketoDue || shampooDue) && deepDue)
      ? { id: "am-deep", title: "Deep conditioner", hint: "Instead of regular conditioner. Leave in five minutes, detangle with fingers while it's in." }
      : { id: "am-condition", title: "Condition", hint: "Detangle with fingers or a wide comb while it's in." },
    { id: "am-squeeze", title: "Squeeze, don't rub", hint: "Microfiber towel or an old t-shirt." },
    { id: "am-cream", title: "Curl cream on soaking-wet hair", hint: "Scrunch, optional pea of gel, hands off until dry. Keep it off the forehead; rinse the hairline after." },
    { id: "am-face", title: "Rinse face", hint: "Lukewarm, never hot. Gentle cleanser only if you trained or feel oily." },
    { id: "am-vitc", title: "Vitamin C serum", hint: "Face and under the eyes, for the pigment. Let it sink in for a minute." },
    { id: "am-azelaic", title: "Azelaic acid 10%", hint: "Redness, forehead, between the brows, and up to the lower lid." },
    { id: "am-moist", title: "Light gel moisturizer", hint: "Nothing oily on the forehead." },
    { id: "am-spf", title: "SPF 30–50", hint: "Two finger-lengths, face and neck, mineral up to the lash line. Sunglasses outside." },
  ];
  if (stubbleDue) morning.push({ id: "stubble", title: "Trim stubble to 2–4 mm", hint: "Neckline just above the Adam's apple; leave the cheek line." });

  const night = [{ id: "pm-cleanse", title: "Cleanse", hint: "Twice if SPF or sweat won't come off. Lukewarm water." }];
  if (ramp.tonight) night.push({ id: "pm-adapalene", title: "Adapalene 0.1%", hint: "Pea-sized for the whole face, on dry skin. Forehead and between the brows only when calm, every third time, with moisturizer underneath. Never on a red patch. Avoid eyelids, lip corners and nostril creases." });
  night.push({ id: "pm-moist", title: "Richer moisturizer", hint: ramp.tonight ? "Once the adapalene has sunk in. Still gel-type on the forehead." : "Still gel-type on the forehead." });
  if (ramp.week >= 5) night.push({ id: "pm-eye", title: "Retinal eye cream", hint: "Half a grain of rice per side, on the orbital bone, never the lid." });
  if (pillowDue) night.push({ id: "pillowcase", title: "Fresh pillowcase", hint: "Every 3–4 days." });

  const started = !!state.trainingStart && state.trainingStart <= date;
  const startsIn = state.trainingStart && state.trainingStart > date ? diffDays(date, state.trainingStart) : 0;
  const lifted = state.workouts.find((w) => w.date === date);
  let train;
  if (!started) train = { id: "train", title: "Walk 30–45 min", hint: startsIn ? `Lifting starts in ${startsIn} day${startsIn === 1 ? "" : "s"}. Walks count until then.` : "Lifting starts when you press start in the Gym tab. Walks count until then." };
  else if (lifted) train = { id: "train", title: `Lifted: ${SESSIONS[lifted.session].name}`, hint: "Logged in the Gym tab." };
  else train = { id: "train", title: `Lift: ${SESSIONS[nextSessionId(state)].name}`, hint: "Lift if you can, walk if you can't. Log lifts in the Gym tab." };

  const body = [
    { id: "creatine", title: "Creatine 5 g", hint: "Any time, with anything." },
    { id: "protein", title: "Hit protein", hint: "Roughly 170–200 g. MacroFactor has the exact number." },
    { id: "steps", title: "8–10k steps", hint: "" },
    train,
    { id: "sleep", title: "Slept 7 hours or more", hint: "For last night. A missed session costs nothing; a week of bad sleep stalls everything." },
  ];

  return { morning, night, body, ramp, started, startsIn };
}

/* ---------- storage ---------- */
async function loadState() {
  try {
    const r = await storage.get(STORAGE_KEY);
    return r && r.value ? JSON.parse(r.value) : null;
  } catch (e) {
    return null; // key doesn't exist yet: first run
  }
}
async function saveState(s) {
  const r = await storage.set(STORAGE_KEY, JSON.stringify(s));
  if (!r) throw new Error("save failed");
}

/* ---------- UI pieces ---------- */
function StepRow({ n, item, done, last, onToggle }) {
  return (
    <button className="step" onClick={onToggle} aria-pressed={done}>
      <div className="railcol">
        <span className={"bubble" + (done ? " on" : "")}>{done ? <Check size={16} strokeWidth={3} /> : n}</span>
        {!last && <span className={"rail" + (done ? " on" : "")} />}
      </div>
      <div className="steptext">
        <div className={"steptitle" + (done ? " done" : "")}>{item.title}</div>
        {item.hint && <div className="hint">{item.hint}</div>}
      </div>
    </button>
  );
}

function NoteRow({ children }) {
  return (
    <div className="step note">
      <div className="railcol"><span className="bubble ghost" /><span className="rail" /></div>
      <div className="steptext"><div className="hint">{children}</div></div>
    </div>
  );
}

function PlainRow({ item, done, onToggle }) {
  return (
    <button className="plain" onClick={onToggle} aria-pressed={done}>
      <span className={"box" + (done ? " on" : "")}>{done && <Check size={15} strokeWidth={3} />}</span>
      <span className="steptext">
        <span className={"steptitle" + (done ? " done" : "")}>{item.title}</span>
        {item.hint && <span className="hint">{item.hint}</span>}
      </span>
    </button>
  );
}

function WeekStrip({ state, today }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(today, -i);
    const d = buildDay(state, k);
    const all = [...d.morning, ...d.night, ...d.body];
    const log = state.days[k] || {};
    const done = all.filter((it) => log[it.id]).length;
    days.push({ k, pct: all.length ? done / all.length : 0, label: weekday(k)[0] });
  }
  return (
    <div className="week" aria-label="Last seven days">
      {days.map((d) => (
        <div key={d.k} className={"day" + (d.k === today ? " today" : "")}>
          <div className="bar"><div className={"fill" + (d.pct >= 0.999 ? " full" : "")} style={{ height: `${Math.max(6, d.pct * 100)}%` }} /></div>
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function SettingsSheet({ state, onSave, onReset, onClose, onImport }) {
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `routine-backup-${todayKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { onImport(JSON.parse(String(r.result))); }
      catch (err) { window.alert("That file isn't a valid backup."); }
    };
    r.readAsText(f);
  };
  const [start, setStart] = useState(state.adapaleneStart || "");
  const [haircut, setHaircut] = useState((state.seeds && state.seeds.haircut) || "");
  const [brows, setBrows] = useState((state.seeds && state.seeds.brows) || "");
  const [threading, setThreading] = useState(!!state.threadingDone);
  const [tStart, setTStart] = useState(state.trainingStart || "");
  const [units, setUnits] = useState(state.units || "kg");
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="sheetwrap">
      <div className="sheetbg" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Settings">
        <div className="sheethead">
          <h2>Settings</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <label className="field">Lifting start date
          <input type="date" value={tStart} onChange={(e) => setTStart(e.target.value)} />
          <span className="hint">Leave blank until the dumbbells arrive, or set the day they land. Walks count until then.</span>
        </label>
        <div className="field">Weight units
          <div className="pills" style={{ margin: "2px 0 0" }}>
            {["kg", "lb"].map((u) => <button key={u} className={"pill" + (units === u ? " on" : "")} onClick={() => setUnits(u)}>{u}</button>)}
          </div>
        </div>
        <label className="field">Adapalene start date
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="hint">Set this to the day the forehead has been calm for two weeks. The ramp counts from here: twice a week for two weeks, every other night for two, then nightly.</span>
        </label>
        <label className="field">Last haircut
          <input type="date" value={haircut} onChange={(e) => setHaircut(e.target.value)} />
        </label>
        <label className="field">Last brow tidy
          <input type="date" value={brows} onChange={(e) => setBrows(e.target.value)} />
        </label>
        <label className="field check">
          <input type="checkbox" checked={threading} onChange={(e) => setThreading(e.target.checked)} />
          Professional threading done once
        </label>
        <button className="primary" onClick={() => onSave({ adapaleneStart: start || todayKey(), seeds: { haircut: haircut || undefined, brows: brows || undefined }, threadingDone: threading, trainingStart: tStart || null, units })}>Save</button>
        <div className="field">Backup
          <div className="pills" style={{ margin: "2px 0 0" }}>
            <button className="pill" onClick={exportBackup}>Export JSON</button>
            <label className="pill" style={{ cursor: "pointer" }}>Import JSON<input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={importBackup} /></label>
          </div>
          <span className="hint">Everything lives in this browser only. Export a copy now and then, and after a new phone import it here.</span>
        </div>
        <button className="danger" onClick={() => { if (confirm) onReset(); else setConfirm(true); }}>
          {confirm ? "Tap again to erase everything" : "Reset all data"}
        </button>
      </div>
    </div>
  );
}

function ProgramPreview() {
  return (
    <div className="preview">
      {ROTATION.map((id) => (
        <div key={id}>
          <h3>{SESSIONS[id].name}</h3>
          <p>{SESSIONS[id].ex.map((e) => `${e.name} ${e.sets}×${e.lo}–${e.hi}${e.time ? " s" : ""}${e.each ? " each side" : ""}`).join(". ")}.</p>
        </div>
      ))}
      <p style={{ marginTop: 12 }}>Rotation: Upper A, Lower A, Upper B, Lower B, with a walk on the days between. Rest 2 minutes on the first two lifts, 60–90 seconds on the rest.</p>
    </div>
  );
}

/* ---------- guide ---------- */
const GUIDE = [
  { t: "The plan on a calendar", items: [
    "Phase 1, cut: now to late January 2027. MacroFactor on lose at 0.75%/week until about 192 lb (late November), one week at maintenance, then 0.5%/week. Stop at about 183–186 lb when the upper abs show, roughly 14%.",
    "February 2027: two weeks at maintenance. Photos.",
    "Phase 2, build: mid-February 2027 to end of February 2028. MacroFactor on gain at 0.25%/week (about 2 lb a month). Gym by summer. One 4-week mini-cut at 0.75% when you look 17–18%, probably August. Ends around 205 lb at 17%.",
    "Phase 3, cut: March to early June 2028 at 0.5%/week. Land at 195–200 lb and 11–12% for PGY3 on July 1.",
    "Every phase: 180–200 g protein, creatine daily, 8–10k steps, 7+ hours of sleep. Bad-week floor: protein, two lifts, a walk, sleep. Nothing else has to happen.",
  ] },
  { t: "Morning shower, in order", items: [
    "Weigh in first: after the bathroom, before food or water, then log it. Only the trend line in MacroFactor matters.",
    "Hair wash: ketoconazole 2% shampoo twice a week on the scalp, forehead and between the brows, left 3–5 minutes (this is the seb derm control and counts as a shampoo). Sulfate-free shampoo on the other wash days, so about every 2–3 days in total. Water-only rinse on the rest.",
    "Condition every wash; detangle with fingers while it's in. Deep conditioner replaces regular conditioner once a week on a wash day.",
    "Squeeze with a microfiber towel or t-shirt, never rub. Curl cream on soaking-wet hair, scrunch, optional pea of gel, then hands off until dry. Keep product off the forehead and rinse the hairline.",
    "Face: lukewarm rinse (hot water feeds the redness). Vitamin C serum, then azelaic acid 10% over the redness, forehead, glabella and up to the lower lid. Light gel moisturizer. SPF 30–50, two finger-lengths, mineral up to the lash line. Sunglasses outdoors.",
    "Stubble every 2–3 days at 2–4 mm (3 mm is the look). Neckline just above the Adam's apple; leave the cheek line natural.",
  ] },
  { t: "Night", items: [
    "Cleanse with a gentle cleanser, twice if SPF or sweat won't come off. Lukewarm.",
    "Adapalene 0.1% on the ramp nights the app shows: twice a week for two weeks, every other night for two, then nightly. Pea-sized for the whole face on dry skin. Avoid eyelids, lip corners and nostril creases. If it stings or peels, moisturizer first, then adapalene.",
    "Seb derm rule: start the ramp only once the forehead has been calm for two weeks (set the date in settings). On the forehead and between the brows use it only every third adapalene night, with moisturizer underneath, and never on a red patch.",
    "Richer moisturizer after, still gel-type on the forehead. From ramp week 5, retinal eye cream: half a grain of rice per side on the orbital bone, never the lid.",
    "Fresh pillowcase every 3–4 days. Rinse your face straight after any evening training.",
  ] },
  { t: "Seb derm", items: [
    "Control, not cure. Goal is invisible-with-maintenance.",
    "Attack phase: ketoconazole 2% wash on the patches and scalp 2–3 times a week for four weeks. Then maintenance 1–2 times a week for good.",
    "Flare: hydrocortisone 1% for a week at most, or pimecrolimus 1% (Elidel) from a colleague for longer use on the face. Ketoconazole or ciclopirox cream are the prescription washes.",
    "Triggers: short sleep, stress, sweat left on the skin, and oils. Malassezia eats most plant oils and esters, so no coconut or heavy creams on the forehead; gel moisturizers, squalane or mineral oil are the safe bases.",
    "Expect flares on nights and post-call. That is the schedule, not the routine failing. Skip the retinoid on any red patch until it settles.",
  ] },
  { t: "Under-eyes and pigment", items: [
    "It's mostly pigment (stays with the skin stretched, wraps onto the upper lid) plus some tear-trough shadow. Pigment fades by roughly a third to a half; it doesn't fully leave, and the orbit is naturally darker than the cheek anyway.",
    "Biggest lever is sun: mineral SPF to the lash line every morning, sunglasses outside. Second is not rubbing: treat itch or congestion instead.",
    "Topicals: vitamin C and azelaic in the morning, retinal eye cream at night (Avène RetrinAL Eyes or Medik8 Crystal Retinal 3). Judge at 4–6 months.",
    "Derm options if you want more: tretinoin 0.025% under the eyes, an 8–12 week hydroquinone course (then stop), tranexamic acid, light peels, or a Q-switched laser with care for your skin tone.",
    "Shadow: the cut reduces cheek fullness that deepens the trough. If it still bothers you when lean, tear-trough filler is the only fix. Wait until you're lean.",
    "Vascular bit everyone has: sleep, cold compress in the morning, less alcohol. Concealer for photos is normal.",
  ] },
  { t: "Derm visit checklist", items: [
    "Lower-lid bumps: milia (hard, pearly, extracted with a needle) or syringomas (soft, flat, flesh-coloured, removed with electrocautery or laser). They'll tell you in seconds.",
    "Under-eye pigment: ask about tretinoin 0.025% for the area, a hydroquinone course, or tranexamic acid.",
    "Prescriptions to leave with: adapalene 0.1% gel (or tretinoin 0.025% cream), pimecrolimus 1% for seb derm flares, ketoconazole cream.",
    "Go soon rather than in three months: the pigment plan and the retinoid ramp both go better with this sorted.",
  ] },
  { t: "Retinoids, which and how", items: [
    "Face: adapalene 0.1% gel first. If pigment hasn't moved by month 4, tretinoin 0.025% cream, then 0.05% later. Skip tazarotene.",
    "Under-eyes: retinaldehyde (retinal) products, gentler than tretinoin and faster than retinol. Prescription route later is tretinoin 0.025% used sparingly.",
    "Rules: retinoid at night only, nothing exfoliating the same night, SPF every day or the pigment gets worse. A few flaky weeks early on are normal. Results at 4–6 months, not weeks.",
  ] },
  { t: "Hair", items: [
    "Products: sulfate-free shampoo (SheaMoisture, Not Your Mother's Curl Talk), conditioner every wash, curl cream or leave-in (Cantu, As I Am), a microfiber towel, a weekly mask.",
    "Haircut every 4–6 weeks with someone who cuts curls. Ask for length on top, tapered sides, cut dry so they can see the curl pattern.",
    "Don't touch it while it dries; that's where frizz comes from.",
  ] },
  { t: "Brows and stubble", items: [
    "Brows are a strong feature; never thin them. One professional threading (ask for clean-up only, keep the shape), then every 2–3 weeks tweeze just the bridge and strays under the arch. Spoolie up daily, trim long hairs.",
    "Stubble at 3 mm reads sharpest on the jaw. Trimmer every 2–3 days; clean neckline just above the Adam's apple.",
  ] },
  { t: "Lifting", items: [
    "Program: Upper A, Lower A, Upper B, Lower B on rotation; a walk on the days between. Four lifts a week is the target, two is the floor.",
    "Progression: when every set hits the top of its rep range, add weight next time (the Gym tab tells you). Otherwise beat last time's reps at the same weight.",
    "Rest 2 minutes on the first two lifts of a session, 60–90 seconds after. Log every set as you finish it.",
    "Dumbbells cap on legs first: slow the lowering to 3 seconds, pause at the bottom, or push reps to 15–20. Move to a gym around summer 2027 for barbells, pull-ups and leg press. Home dumbbells stay the call-week floor.",
    "Abs: a ten-minute finisher on both lower days (weighted crunch, leg raises or reverse crunches, plank). Visible abs need low fat and a thick rectus, so build it now. Keep heavy oblique work minimal to keep the waist narrow. Add hanging leg raises once you're in a gym.",
    "Deload every 6–8 weeks: same lifts, half the sets. Sleep is part of the program.",
  ] },
  { t: "Nutrition and MacroFactor", items: [
    "Let the app set calories. Log everything, including the bad days; the expenditure estimate is only as good as the logging.",
    "Protein 1.8–2.2 g/kg (about 180–200 g). Fat no lower than 0.7 g/kg. Carbs fill the rest.",
    "Weigh daily, same conditions, and ignore the daily number; the trend is the signal. Two weeks to calibrate before judging anything.",
    "Cutting: diet break of 1–2 weeks at maintenance every 8 weeks. Gaining: if body fat drifts past 17–18%, a 4-week mini-cut, then back.",
    "Supplements that matter: creatine 5 g daily, whey for convenience, vitamin D through the winter. That's the list.",
    "Hospital logistics: batch cook twice a week, whey and Greek yogurt in the locker, fixed meal times on nights instead of grazing.",
  ] },
  { t: "Progress photos", items: [
    "First of every month. Rear camera on a timer, propped at eye level, 1–1.5 m away, window light, same spot, same time of day. Front, both sides, relaxed face.",
    "Front-camera selfies at arm's length widen the face and enlarge the nose; they are not data. Neither is a lamp-lit bedroom shot.",
    "Also track waist at the navel monthly. Judge the cut by photos, waist and trend weight, never body-fat guesses.",
  ] },
];

function GuideSheet({ onClose }) {
  return (
    <div className="sheetwrap">
      <div className="sheetbg" onClick={onClose} />
      <div className="sheet guide" role="dialog" aria-label="Guide">
        <div className="sheethead">
          <h2>Guide</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <p className="hint" style={{ margin: "-6px 0 4px" }}>Everything the checklists assume. Open a section.</p>
        <div>
          {GUIDE.map((g) => (
            <details key={g.t}>
              <summary>{g.t}</summary>
              <div className="gbody"><ul>{g.items.map((it, i) => <li key={i}>{it}</li>)}</ul></div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- app ---------- */
export default function RoutineTracker() {
  const [state, setState] = useState(null);
  const [today, setToday] = useState(todayKey());
  const [tab, setTab] = useState(autoTab());
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [restEnd, setRestEnd] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [cancelArmed, setCancelArmed] = useState(false);

  useEffect(() => {
    (async () => {
      try { const s = await loadState(); setState(s ? migrate(s) : defaultState()); }
      catch (e) { setState(defaultState()); setSaveError(true); }
      finally { setLoaded(true); }
    })();
    const t = setInterval(() => setToday(todayKey()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!loaded || !state) return;
    saveState(state).then(() => setSaveError(false)).catch(() => setSaveError(true));
  }, [state, loaded]);

  useEffect(() => {
    if (!restEnd) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [restEnd]);
  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : null;
  useEffect(() => {
    if (restEnd && restLeft === 0) {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      const t = setTimeout(() => setRestEnd(null), 4000);
      return () => clearTimeout(t);
    }
  }, [restLeft, restEnd]);

  const day = useMemo(() => (state ? buildDay(state, today) : null), [state, today]);
  const log = (state && state.days[today]) || {};

  const toggle = (id) => setState((s) => {
    const d = { ...(s.days[today] || {}) };
    if (d[id]) delete d[id]; else d[id] = true;
    return { ...s, days: { ...s.days, [today]: d } };
  });

  if (!state || !day) return <div className="app"><style>{CSS}</style><p className="hint" style={{ padding: 24 }}>Loading your routine…</p></div>;

  const count = (list) => list.filter((it) => log[it.id]).length;
  const ramp = day.ramp;
  const next = nextAdapalene(state.adapaleneStart, today);
  const rampLine = ramp.week === 0
    ? `Adapalene starts ${shortDate(state.adapaleneStart)}.`
    : `Ramp week ${ramp.week}, ${ramp.phase}. ${ramp.tonight ? "Adapalene tonight." : next ? `Next adapalene ${diffDays(today, next) === 1 ? "tomorrow" : weekday(next)}.` : ""}`;
  const seedsMissing = !(state.seeds && state.seeds.haircut && state.seeds.brows);

  /* gym helpers */
  const units = state.units || "kg";
  const nextId = nextSessionId(state);
  const active = state.active;
  const startWorkout = (sessionId) => {
    const ex = {};
    SESSIONS[sessionId].ex.forEach((e) => {
      const sug = suggest(e, lastEntry(state, e.id), units);
      ex[e.id] = { w: sug.w === "" ? "" : String(sug.w), reps: Array(e.sets).fill("") };
    });
    setCancelArmed(false);
    setState((s) => ({ ...s, active: { session: sessionId, date: today, ex } }));
  };
  const setW = (exId, v) => setState((s) => ({ ...s, active: { ...s.active, ex: { ...s.active.ex, [exId]: { ...s.active.ex[exId], w: v } } } }));
  const setRep = (exId, i, v) => setState((s) => {
    const reps = [...s.active.ex[exId].reps]; reps[i] = v;
    return { ...s, active: { ...s.active, ex: { ...s.active.ex, [exId]: { ...s.active.ex[exId], reps } } } };
  });
  const finishWorkout = () => setState((s) => {
    const a = s.active;
    const ex = SESSIONS[a.session].ex.map((e) => {
      const rec = a.ex[e.id];
      const reps = rec.reps.map((r) => parseInt(r, 10)).filter((r) => !isNaN(r) && r > 0);
      const w = parseFloat(rec.w);
      return reps.length ? { id: e.id, w: isNaN(w) ? 0 : w, reps } : null;
    }).filter(Boolean);
    const workouts = ex.length ? [...s.workouts, { date: a.date, session: a.session, ex }] : s.workouts;
    const d = { ...(s.days[a.date] || {}) }; if (ex.length) d.train = true;
    return { ...s, workouts, active: null, days: { ...s.days, [a.date]: d } };
  });
  const cancelWorkout = () => { setCancelArmed(false); setState((s) => ({ ...s, active: null })); };
  const gymLabel = active ? "Live" : !day.started ? "Soon" : SESSIONS[nextId].name;
  const lastLift = state.workouts[state.workouts.length - 1];

  return (
    <div className="app" style={{ paddingBottom: restEnd ? 110 : 48 }}>
      <style>{CSS}</style>

      <header className="head">
        <div>
          <h1>{longDate(today)}</h1>
          <p className="sub">{rampLine}</p>
        </div>
        <div className="headbtns">
          <button className="iconbtn" onClick={() => setShowGuide(true)} aria-label="Guide"><BookOpen size={20} /></button>
          <button className="iconbtn" onClick={() => setShowSettings(true)} aria-label="Settings"><Settings size={20} /></button>
        </div>
      </header>

      <WeekStrip state={state} today={today} />

      {saveError && <div className="notice">Couldn't save to this browser's storage. Export a backup from settings.</div>}

      <nav className="tabs" aria-label="Sections">
        {[["morning", "Morning", `${count(day.morning)}/${day.morning.length}`],
          ["night", "Night", `${count(day.night)}/${day.night.length}`],
          ["body", "Body", `${count(day.body)}/${day.body.length}`],
          ["gym", "Gym", gymLabel],
          ["upkeep", "Upkeep", ""]].map(([id, label, c]) => (
          <button key={id} className={"tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)} aria-current={tab === id}>
            {label}<small>{c || "\u00a0"}</small>
          </button>
        ))}
      </nav>

      {tab === "morning" && (
        <section>
          <p className="lead">In the shower, in this order.</p>
          {day.morning.map((it, i) => (
            <StepRow key={it.id} n={i + 1} item={it} done={!!log[it.id]} last={i === day.morning.length - 1} onToggle={() => toggle(it.id)} />
          ))}
        </section>
      )}

      {tab === "night" && (
        <section>
          <p className="lead">Before bed.</p>
          {day.night.map((it, i) => {
            const rows = [<StepRow key={it.id} n={i + 1} item={it} done={!!log[it.id]} last={i === day.night.length - 1} onToggle={() => toggle(it.id)} />];
            if (i === 0 && !ramp.tonight) rows.push(
              <NoteRow key="no-adapalene">
                {ramp.week === 0 ? `Adapalene starts ${shortDate(state.adapaleneStart)}.` : `No adapalene tonight (week ${ramp.week} of the ramp, ${ramp.phase}). ${next ? `Next: ${diffDays(today, next) === 1 ? "tomorrow" : weekday(next)}.` : ""}`}
              </NoteRow>
            );
            return rows;
          })}
        </section>
      )}

      {tab === "body" && (
        <section>
          <p className="lead">Any time today.</p>
          {day.body.map((it) => <PlainRow key={it.id} item={it} done={!!log[it.id]} onToggle={() => toggle(it.id)} />)}
          <p className="hint foot">Bad week? The floor is protein, two lifts, a walk and sleep. Everything else can slide.</p>
        </section>
      )}

      {tab === "gym" && !day.started && (
        <section>
          <div className="card">
            <div className="steptitle">{day.startsIn ? `Lifting starts in ${day.startsIn} day${day.startsIn === 1 ? "" : "s"}` : "Dumbbells not here yet"}</div>
            <p className="hint" style={{ margin: "6px 0 14px" }}>Nothing here nags you until you start. Walks and steps count in the meantime. Press start the day the dumbbells land, or set the date in settings.</p>
            <button className="primary" onClick={() => setState((s) => ({ ...s, trainingStart: today }))}>Start lifting today</button>
          </div>
          <p className="lead">What's waiting.</p>
          <ProgramPreview />
        </section>
      )}

      {tab === "gym" && day.started && !active && (
        <section>
          <div className="gymhead">
            <div>
              <div className="big">Next: {SESSIONS[nextId].name}</div>
              <div className="hint">{lastLift ? `Last lift: ${SESSIONS[lastLift.session].name}, ${ago(diffDays(lastLift.date, today))}.` : "First session of the program."}</div>
            </div>
          </div>
          <button className="primary" onClick={() => startWorkout(nextId)}>Start {SESSIONS[nextId].name}</button>
          <div className="pills">
            <span className="hint" style={{ alignSelf: "center", marginTop: 0 }}>Or start:</span>
            {ROTATION.filter((id) => id !== nextId).map((id) => <button key={id} className="pill" onClick={() => startWorkout(id)}>{SESSIONS[id].name}</button>)}
          </div>
          {state.workouts.length > 0 && (
            <div className="history">
              <p className="lead">Recent lifts.</p>
              {[...state.workouts].reverse().slice(0, 8).map((w, i) => (
                <div key={i} className="hrow">
                  <span>{SESSIONS[w.session].name}</span>
                  <span>{shortDate(w.date)}, {w.ex.reduce((n, e) => n + e.reps.length, 0)} sets</span>
                </div>
              ))}
            </div>
          )}
          {state.workouts.length === 0 && <ProgramPreview />}
        </section>
      )}

      {tab === "gym" && day.started && active && (
        <section>
          <div className="gymhead">
            <div>
              <div className="big">{SESSIONS[active.session].name}</div>
              <div className="hint">Type reps as you finish each set. Weight is per dumbbell.</div>
            </div>
            <button className="danger" style={{ padding: "6px 8px" }} onClick={() => (cancelArmed ? cancelWorkout() : setCancelArmed(true))}>
              {cancelArmed ? "Tap again to discard" : "Discard"}
            </button>
          </div>
          {SESSIONS[active.session].ex.map((e, idx) => {
            const rec = active.ex[e.id];
            const sug = suggest(e, lastEntry(state, e.id), units);
            const restSec = idx < 2 ? 120 : 90;
            return (
              <div key={e.id} className="exercise">
                <div className="exhead">
                  <div className="steptitle">{e.name}</div>
                  <div className="target">{e.sets} × {e.lo}–{e.hi}{e.time ? " s" : ""}{e.each ? " each" : ""}</div>
                </div>
                <div className={"suggest" + (sug.add ? " add" : "")}>{sug.text}</div>
                <div className="inputs">
                  <input className="winput" type="number" inputMode="decimal" step="0.5" placeholder="0" value={rec.w} onChange={(ev) => setW(e.id, ev.target.value)} aria-label={`${e.name} weight`} />
                  <span className="unit">{units}</span>
                  <div className="sets">
                    {rec.reps.map((r, i) => (
                      <input key={i} className={"rinput" + (r ? " on" : "")} type="number" inputMode="numeric" placeholder={String(e.lo)} value={r} onChange={(ev) => setRep(e.id, i, ev.target.value)} aria-label={`${e.name} set ${i + 1} reps`} />
                    ))}
                  </div>
                </div>
                <div className="restbtns">
                  <button className="pill" onClick={() => { setNow(Date.now()); setRestEnd(Date.now() + restSec * 1000); }}>Rest {restSec === 120 ? "2 min" : "90 s"}</button>
                </div>
              </div>
            );
          })}
          <button className="primary" style={{ marginTop: 18, width: "100%" }} onClick={finishWorkout}>Finish workout</button>
          <p className="hint" style={{ marginTop: 10 }}>Progression: when every set reaches the top of its range, the app tells you to add weight next time.</p>
        </section>
      )}

      {tab === "upkeep" && (
        <section>
          <p className="lead">Things on a cadence.</p>
          {seedsMissing && <div className="notice soft">Set your last haircut and brow tidy in settings so these are accurate.</div>}

          <div className="uprow">
            <div className="uptext">
              <div className="steptitle">Adapalene ramp</div>
              <div className="hint">{ramp.week === 0 ? `Starts ${shortDate(state.adapaleneStart)}.` : `Started ${shortDate(state.adapaleneStart)}. Week ${ramp.week}: ${ramp.phase}.${ramp.week >= 5 ? " Eye cream is in the night list now." : ""}`}</div>
              <div className="dots" aria-label="Next seven nights">
                {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((k) => (
                  <span key={k} className={"dot" + (adapalene(state.adapaleneStart, k).tonight ? " on" : "")}>{weekday(k)[0]}</span>
                ))}
              </div>
            </div>
          </div>

          {UPKEEP.map((u) => {
            const s = since(state, u.id, today);
            const doneToday = !!log[u.id];
            let level = "fine", text;
            if (doneToday) text = "Done today";
            else if (s === Infinity) { level = "due"; text = "Not logged yet"; }
            else if (s >= u.over) { level = "over"; text = `Overdue, ${s} days ago`; }
            else if (s >= u.due) { level = "due"; text = `Due, ${s} days ago`; }
            else text = ago(s);
            return (
              <div key={u.id} className="uprow">
                <div className="uptext">
                  <div className="steptitle">{u.title} <span className="every">{u.every}</span></div>
                  <div className="hint">{u.hint}</div>
                  <div className={"status " + level}>{text}</div>
                </div>
                <button className={"upbtn" + (doneToday ? " on" : "")} onClick={() => toggle(u.id)} aria-pressed={doneToday}>
                  {doneToday ? <Check size={16} strokeWidth={3} /> : "Done today"}
                </button>
              </div>
            );
          })}

          <div className="uprow">
            <div className="uptext">
              <div className="steptitle">Professional threading <span className="every">Once</span></div>
              <div className="hint">Ask for clean-up only, keep the shape. After that you maintain it yourself.</div>
              <div className={"status " + (state.threadingDone ? "fine" : "due")}>{state.threadingDone ? "Done" : "Book it"}</div>
            </div>
            <button className={"upbtn" + (state.threadingDone ? " on" : "")} onClick={() => setState((s) => ({ ...s, threadingDone: !s.threadingDone }))} aria-pressed={state.threadingDone}>
              {state.threadingDone ? <Check size={16} strokeWidth={3} /> : "Done"}
            </button>
          </div>
          <div className="uprow">
            <div className="uptext">
              <div className="steptitle">Derm visit <span className="every">Once, soon</span></div>
              <div className="hint">The lower-lid bumps (milia or syringomas), the under-eye pigment, and prescriptions: adapalene or tretinoin, pimecrolimus for flares. Checklist is in the guide.</div>
              <div className={"status " + (state.dermDone ? "fine" : "due")}>{state.dermDone ? "Done" : "Book it"}</div>
            </div>
            <button className={"upbtn" + (state.dermDone ? " on" : "")} onClick={() => setState((s) => ({ ...s, dermDone: !s.dermDone }))} aria-pressed={state.dermDone}>
              {state.dermDone ? <Check size={16} strokeWidth={3} /> : "Done"}
            </button>
          </div>
        </section>
      )}

      {restEnd && (
        <div className="timerbar">
          <div className="timer" role="timer" aria-live="polite">
            <span>{restLeft === 0 ? "Go." : `Rest ${Math.floor(restLeft / 60)}:${pad(restLeft % 60)}`}</span>
            <button onClick={() => setRestEnd(null)}>{restLeft === 0 ? "Done" : "Skip"}</button>
          </div>
        </div>
      )}

      {showGuide && <GuideSheet onClose={() => setShowGuide(false)} />}

      {showSettings && (
        <SettingsSheet
          state={state}
          onClose={() => setShowSettings(false)}
          onSave={(patch) => { setState((s) => ({ ...s, ...patch })); setShowSettings(false); }}
          onReset={() => { setState(defaultState()); setShowSettings(false); }}
          onImport={(s) => { setState(migrate(s)); setShowSettings(false); }}
        />
      )}
    </div>
  );
}

/* ---------- styles ---------- */
const CSS = `
:root{--bg:#E8EDEA;--tile:#F6F8F7;--ink:#10221D;--green:#1F4A3C;--mint:#A9CCBE;--rule:#CCD8D2;--muted:#5F7069;--warn:#9E4A3A;}
html,body{background:var(--bg);margin:0;}
.app{min-height:100vh;max-width:480px;margin:0 auto;padding:18px 16px 48px;background:var(--bg);color:var(--ink);
  font-family:"Avenir Next","Avenir","Helvetica Neue",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.app *{box-sizing:border-box;}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;}
h1{font-size:24px;font-weight:600;letter-spacing:-0.01em;margin:0;line-height:1.15;}
h2{font-size:20px;font-weight:600;margin:0;}
.sub{margin:4px 0 0;font-size:14px;color:var(--muted);line-height:1.35;}
.iconbtn{border:0;background:var(--tile);color:var(--green);width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;}
.week{display:flex;gap:6px;align-items:flex-end;margin:0 0 16px;}
.day{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--muted);}
.day.today{color:var(--green);font-weight:600;}
.bar{width:100%;height:26px;background:var(--tile);border-radius:6px;overflow:hidden;display:flex;align-items:flex-end;}
.fill{width:100%;background:var(--mint);border-radius:6px 6px 0 0;transition:height .3s;}
.fill.full{background:var(--green);}
.day.today .bar{outline:2px solid var(--mint);outline-offset:-2px;}
.notice{background:#F3DED6;color:var(--warn);font-size:13.5px;padding:10px 12px;border-radius:10px;margin:0 0 12px;line-height:1.35;}
.notice.soft{background:var(--tile);color:var(--muted);}
.tabs{display:flex;gap:3px;background:var(--tile);border-radius:14px;padding:4px;margin-bottom:18px;}
.tab{flex:1;border:0;background:none;padding:7px 0;border-radius:10px;font:inherit;font-weight:600;font-size:13.5px;color:var(--muted);cursor:pointer;line-height:1.2;min-width:0;}
.tab.on{background:var(--green);color:#fff;}
.tab small{display:block;font-weight:500;font-size:10.5px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lead{margin:0 0 14px;font-size:15px;color:var(--muted);}
.step{display:flex;gap:14px;width:100%;text-align:left;background:none;border:0;padding:0;cursor:pointer;align-items:stretch;font:inherit;color:inherit;}
.step.note{cursor:default;}
.railcol{display:flex;flex-direction:column;align-items:center;width:30px;flex:none;}
.bubble{width:30px;height:30px;border-radius:50%;border:2px solid var(--mint);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px;color:var(--green);background:var(--tile);flex:none;transition:background .18s,border-color .18s;}
.bubble.on{background:var(--green);border-color:var(--green);color:#fff;}
.bubble.ghost{width:10px;height:10px;border-width:2px;margin:10px 0;}
.rail{width:2px;flex:1;background:var(--mint);min-height:18px;margin:4px 0;transition:background .25s;}
.rail.on{background:var(--green);}
.steptext{display:flex;flex-direction:column;padding:5px 0 20px;min-width:0;}
.note .steptext{padding:0 0 14px;}
.steptitle{font-size:17px;font-weight:600;line-height:1.25;color:var(--ink);}
.steptitle.done{color:var(--muted);}
.hint{font-size:13.5px;color:var(--muted);line-height:1.4;margin-top:3px;}
.hint.foot{margin-top:10px;padding-top:12px;border-top:1px solid var(--rule);}
.plain{display:flex;gap:14px;width:100%;text-align:left;background:none;border:0;padding:0 0 4px;cursor:pointer;align-items:flex-start;font:inherit;color:inherit;border-bottom:1px solid var(--rule);margin-bottom:14px;}
.plain .steptext{padding:2px 0 12px;}
.box{width:28px;height:28px;border-radius:8px;border:2px solid var(--mint);background:var(--tile);display:flex;align-items:center;justify-content:center;color:#fff;flex:none;margin-top:1px;transition:background .18s,border-color .18s;}
.box.on{background:var(--green);border-color:var(--green);}
.uprow{display:flex;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid var(--rule);}
.uptext{flex:1;min-width:0;}
.every{font-size:12.5px;font-weight:500;color:var(--muted);margin-left:6px;}
.status{font-size:13px;font-weight:600;margin-top:6px;color:var(--muted);}
.status.due{color:var(--green);}
.status.over{color:var(--warn);}
.upbtn{border:2px solid var(--green);background:none;color:var(--green);font:inherit;font-weight:600;font-size:13px;padding:8px 10px;border-radius:10px;cursor:pointer;flex:none;min-width:84px;display:flex;justify-content:center;transition:background .18s;}
.upbtn.on{background:var(--green);color:#fff;}
.dots{display:flex;gap:6px;margin-top:8px;}
.dot{width:26px;height:26px;border-radius:50%;border:2px solid var(--mint);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--muted);}
.dot.on{background:var(--green);border-color:var(--green);color:#fff;}
.card{background:var(--tile);border-radius:16px;padding:16px;margin-bottom:18px;}
.card .primary{width:100%;}
.gymhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;}
.big{font-size:22px;font-weight:600;line-height:1.15;}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 18px;}
.pill{border:1.5px solid var(--rule);background:var(--tile);color:var(--green);font:inherit;font-weight:600;font-size:13px;padding:7px 11px;border-radius:999px;cursor:pointer;}
.pill.on{background:var(--green);border-color:var(--green);color:#fff;}
.exercise{padding:14px 0;border-bottom:1px solid var(--rule);}
.exhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.target{font-size:13px;color:var(--muted);font-weight:500;white-space:nowrap;}
.suggest{font-size:13.5px;color:var(--muted);margin-top:4px;line-height:1.4;}
.suggest.add{color:var(--green);font-weight:600;}
.inputs{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;}
.winput{width:78px;font:inherit;font-weight:600;font-size:16px;padding:9px 10px;border:2px solid var(--rule);border-radius:10px;background:#fff;color:var(--ink);}
.unit{font-size:13px;color:var(--muted);font-weight:600;}
.sets{display:flex;gap:6px;flex:1;min-width:0;}
.rinput{flex:1;min-width:0;width:48px;font:inherit;font-weight:600;font-size:16px;padding:9px 4px;border:2px solid var(--rule);border-radius:10px;background:#fff;color:var(--ink);text-align:center;}
.rinput.on{border-color:var(--green);background:#E9F1ED;}
.restbtns{display:flex;gap:6px;margin-top:10px;}
input[type=number]{-moz-appearance:textfield;}
input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.history{margin-top:22px;}
.hrow{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--rule);font-size:14px;font-weight:600;}
.hrow span:last-child{color:var(--muted);font-weight:500;}
.preview h3{font-size:16px;font-weight:600;margin:14px 0 4px;}
.preview p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.45;}
.timerbar{position:fixed;left:0;right:0;bottom:0;z-index:9;display:flex;justify-content:center;pointer-events:none;}
.timer{pointer-events:auto;background:var(--green);color:#fff;border-radius:16px 16px 0 0;padding:14px 18px;display:flex;align-items:center;font-weight:600;font-size:20px;width:100%;max-width:480px;justify-content:space-between;}
.timer button{border:0;background:rgba(255,255,255,.18);color:#fff;font:inherit;font-weight:600;font-size:14px;padding:8px 14px;border-radius:10px;cursor:pointer;}
.headbtns{display:flex;gap:8px;flex:none;}
.guide{max-height:94vh;}
.guide details{border-bottom:1px solid var(--rule);padding:4px 0;}
.guide summary{cursor:pointer;font-size:16px;font-weight:600;padding:10px 0;list-style:none;display:flex;justify-content:space-between;align-items:center;}
.guide summary::-webkit-details-marker{display:none;}
.guide summary::after{content:"+";color:var(--muted);font-weight:500;font-size:18px;}
.guide details[open] summary::after{content:"\\2013";}
.guide .gbody{padding:0 0 12px;}
.guide .gbody p{margin:0 0 8px;font-size:14px;line-height:1.45;color:var(--ink);}
.guide .gbody p.sub{color:var(--muted);}
.guide .gbody ul{margin:0 0 8px;padding-left:18px;}
.guide .gbody li{font-size:14px;line-height:1.45;margin-bottom:5px;}
.sheetwrap{position:fixed;inset:0;z-index:10;display:flex;align-items:flex-end;}
.sheetbg{position:absolute;inset:0;background:rgba(16,34,29,.45);}
.sheet{position:relative;width:100%;max-width:480px;margin:0 auto;background:var(--tile);border-radius:18px 18px 0 0;padding:18px 18px 28px;display:flex;flex-direction:column;gap:14px;max-height:92vh;overflow-y:auto;}
.sheethead{display:flex;justify-content:space-between;align-items:center;}
.field{display:flex;flex-direction:column;gap:6px;font-size:15px;font-weight:600;}
.field input[type=date]{font:inherit;font-weight:500;padding:10px 12px;border:2px solid var(--rule);border-radius:10px;background:#fff;color:var(--ink);}
.field.check{flex-direction:row;align-items:center;gap:10px;}
.field.check input{width:20px;height:20px;accent-color:var(--green);}
.primary{border:0;background:var(--green);color:#fff;font:inherit;font-weight:600;font-size:16px;padding:13px;border-radius:12px;cursor:pointer;}
.danger{border:0;background:none;color:var(--warn);font:inherit;font-weight:600;font-size:14px;padding:8px;cursor:pointer;}
button:focus-visible{outline:3px solid var(--mint);outline-offset:2px;border-radius:12px;}
@media (prefers-reduced-motion:reduce){.app *{transition:none !important;}}
`;
