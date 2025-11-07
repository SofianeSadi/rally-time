import { useMemo, useState } from "react";

/**
    * Rally Timing Planner (Kingshot)
* - No target arrival input: when you click "Calculate", we compute from NOW (UTC).
    * - Each leader gets at least 20s to read before their rally start time.
    * - Arrivals are spaced by a fixed 2s gap (top-to-bottom order).
    * - Kingshot rallies are 5 minutes long: send time - 5m = start rally time.
    * - Shows Start Δ vs P1: how many seconds later/earlier a player should START
*   their 5-minute rally relative to Player 1 (row 1).
    */
export default function RallyTimingPlanner() {
    // --- Types ---
    type March = { id: string; name: string; m: string; s: string };
    type PlanRow = {
        id: string;
        seq: number; // 1-based arrival sequence (current list order)
        name: string;
        durationSec: number; // march duration (seconds)
        durationHMS: string;
        arrivalTime: string; // H:M:S absolute (UTC) — impact time
        sendTime: string; // H:M:S absolute (UTC) — when to send march
        rallyStartTime: string; // H:M:S absolute (UTC) — when to START the 5m rally (sendTime - 5m)
        offsetSec: number; // arrival gap vs Player 1: (seq-1) * GAP_SECONDS
        startDeltaSec: number; // START-rally-time delta vs Player 1: i*G - (d_i - d_0)
    };

    // --- Marches list; order of array = arrival order ---
    const [marches, setMarches] = useState<March[]>([
        { id: cryptoRandomId(), name: "", m: "0", s: "0" },
    ]);

    // Constants
    const GAP_SECONDS = 2;
    const RALLY_PREP_SECONDS = 5 * 60; // 5 minutes
    const READINESS_SECONDS = 40; // min time to read after sending messages (now)

    // Results
    const [plan, setPlan] = useState<PlanRow[] | null>(null);
    const [note, setNote] = useState("");

    // --- Helpers ---
    function cryptoRandomId() {
        return (
            Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5)
        );
    }
    const normalizeInt = (v: string) => {
        if (v.trim() === "") return 0;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    };
    const zeroPad2 = (n: number) => String(n).padStart(2, "0");
    const hms = (total: number) => {
        if (total < 0) total = 0;
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return `${h}:${zeroPad2(m)}:${zeroPad2(s)}`;
    };
    const toSecMarch = (m: string, s: string) => normalizeInt(m) * 60 + normalizeInt(s);

    const marchesWithSec = useMemo(
        () => marches.map((r) => ({ ...r, totalSec: toSecMarch(r.m, r.s) })),
            [marches]
    );

    const hasAtLeastOneMarch = marchesWithSec.some((m) => m.totalSec > 0);
    const isCalculateDisabled = !hasAtLeastOneMarch;

    const addMarch = () => {
        setMarches((prev) => [...prev, { id: cryptoRandomId(), name: "", m: "0", s: "0" }]);
    };
    const removeMarch = (id: string) => {
        setMarches((prev) => (prev.length > 1 ? prev.filter((x) => x.id !== id) : prev));
    };
    const updateMarch = (id: string, field: keyof March, value: string) => {
        setMarches((prev) => prev.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
    };
    const moveUp = (idx: number) => {
        if (idx <= 0) return;
        setMarches((prev) => {
            const copy = [...prev];
            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
            return copy;
        });
    };
    const moveDown = (idx: number) => {
        setMarches((prev) => {
            if (idx >= prev.length - 1) return prev;
            const copy = [...prev];
            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
            return copy;
        });
    };

    const onReset = () => {
        setMarches([{ id: cryptoRandomId(), name: "", m: "0", s: "0" }]);
        setPlan(null);
        setNote("");
    };

    const onCalculate = () => {
        // We assume you're sending the messages *now* (UTC).
        const now = new Date();
        const nowEpoch = Math.floor(now.getTime() / 1000);

        // Active marches in current order
        const active = marchesWithSec.filter((m) => m.totalSec > 0);
        if (active.length === 0) {
            setPlan(null);
            setNote("Add at least one march with non-zero time.");
            return;
        }

        // Keep arrivals exactly spaced by GAP_SECONDS:
        // arrival_i = firstArrival + i*G
        // Choose firstArrival so EVERY leader has ≥READINESS_SECONDS before rally start:
        // rallyStart_i = arrival_i - d_i - 5m  >= now + READINESS
        // => firstArrival >= now + READINESS + 5m + max_i(d_i - i*G)
        const maxSkew = active.reduce(
            (acc, m, idx) => Math.max(acc, m.totalSec - idx * GAP_SECONDS),
                0
        );
        const firstArrivalAbs = nowEpoch + READINESS_SECONDS + RALLY_PREP_SECONDS + maxSkew;

        const firstDuration = active[0].totalSec; // d_0 for Start Δ vs P1

            const rows: PlanRow[] = active.map((m, idx) => {
                const arrivalAbsEpoch = firstArrivalAbs + idx * GAP_SECONDS;
                const sendAbsEpoch = arrivalAbsEpoch - m.totalSec;
                const rallyStartAbsEpoch = sendAbsEpoch - RALLY_PREP_SECONDS;

                const fmt = (d: Date) =>
                `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;

                const arrivalDate = new Date(arrivalAbsEpoch * 1000);
                const sendDate = new Date(sendAbsEpoch * 1000);
                const rallyStartDate = new Date(rallyStartAbsEpoch * 1000);

                // Start Δ vs Player 1 (idx=0): i*G - (d_i - d_0)
                const startDeltaSec = idx * GAP_SECONDS - (m.totalSec - firstDuration);

                return {
                    id: m.id,
                    seq: idx + 1,
                    name: m.name || `Leader ${idx + 1}`,
                    durationSec: m.totalSec,
                    durationHMS: hms(m.totalSec),
                    arrivalTime: fmt(arrivalDate),
                    sendTime: fmt(sendDate),
                    rallyStartTime: fmt(rallyStartDate),
                    offsetSec: idx * GAP_SECONDS,
                    startDeltaSec,
                };
            });

            setPlan(rows);
            setNote(
                rows.length > 0
                    ? `Arrivals are evenly spaced by ${GAP_SECONDS}s. All rally starts are ≥${READINESS_SECONDS}s from now.`
                    : ""
            );
    };

    function ordinal(n: number) {
  const words = ["first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth"];
  return words[n - 1] ?? `${n}th`;
}
function hmsToSec(hms: string) {
  const [hh, mm, ss] = hms.split(":").map(Number);
  return (hh||0)*3600 + (mm||0)*60 + (ss||0);
}
function mmss(sec: number) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function summary(rows: PlanRow[]) {
  if (!rows || rows.length === 0) return "";

  // Appear order = earliest rally start
  const byAppear = [...rows].sort(
    (a, b) => hmsToSec(a.rallyStartTime) - hmsToSec(b.rallyStartTime)
  );

  // Hit ranks by arrival time
  const byHit = [...rows].sort(
    (a, b) => hmsToSec(a.arrivalTime) - hmsToSec(b.arrivalTime)
  );
  const hitRank = new Map<string, number>();
  byHit.forEach((r, i) => hitRank.set(r.id, i + 1));

  const lines: string[] = [];
  for (let i = 0; i < byAppear.length; i++) {
    const r = byAppear[i];
    const name = r.name || `Leader ${i + 1}`;
    const appearOrd = ordinal(i + 1);
    const hitOrd = ordinal(hitRank.get(r.id)!);

    if (i === 0) {
      lines.push(`- ${name} appear ${appearOrd}.`);
    } else {
      const prev = byAppear[i - 1];
      const delta = hmsToSec(r.rallyStartTime) - hmsToSec(prev.rallyStartTime); // >0 => "more"
      const abs = Math.abs(delta);
      const unit = abs === 1 ? "second" : "seconds";
      const moreOrLess = delta >= 0 ? "more" : "less";

      // When should you look at the previous player's timer?
      // Exactly at 05:00 - |delta|
      const anchor = mmss(5*60 - abs);

      lines.push(
        `- ${name} appear ${appearOrd}, ` +
        `rally shows ${abs} ${unit} ${moreOrLess} than ${prev.name} (` +
        `should appear when ${prev.name}'s rally at ${anchor})`
      );
    }
  }

  return lines.join("\n");
}


  function buildMessages(rows: PlanRow[]) {
    const messages = rows.map((r) => `• ${messageFor(r)}`).join("\n");
    return `${messages}\n----\nVerification:\n${summary(rows)}`;
  }

  function messageFor(r: PlanRow) {
    // Players should START the rally at rallyStartTime.
    return `${r.name} start rally at ${r.rallyStartTime} UTC`;
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Rally Timing Planner</h1>
        <p className="text-slate-600 mb-6">
          Click <strong>Calculate</strong> when you’re ready to send messages. Each leader gets at least{" "}
          <strong>40s</strong> to read before their rally start time. Arrivals are spaced by{" "}
          <strong>2s</strong> in your chosen order. March times are in M:S. All times are <strong>UTC</strong>.
        </p>

        {/* Marches list (order = arrival order) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-slate-800">Marches (Top to bottom = arrival order)</h2>
            <button onClick={addMarch} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200">+ Add March</button>
          </div>

          <div className="space-y-3">
            {marches.map((row, i) => (
              <div key={row.id} className="grid grid-cols-12 gap-3 items-stretch border rounded-xl p-3">
                {/* Controls column (vertical stack) */}
                <div className="col-span-12 sm:col-span-2 flex sm:flex-col gap-2 order-last sm:order-first">
                  <button
                    onClick={() => moveUp(i)}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    disabled={i === 0}
                    aria-label={`Move ${row.name || `march ${i + 1}`} up`}
                  >
                    ↑ Up
                  </button>
                  <button
                    onClick={() => moveDown(i)}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    disabled={i === marches.length - 1}
                    aria-label={`Move ${row.name || `march ${i + 1}`} down`}
                  >
                    ↓ Down
                  </button>
                  <button
                    onClick={() => removeMarch(row.id)}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    disabled={marches.length === 1}
                  >
                    Remove
                  </button>
                </div>

                {/* Labels */}
                <div className="col-span-12 sm:col-span-2 text-sm text-slate-500 self-center">Arrival #{i + 1}</div>

                {/* Inputs */}
                <div className="col-span-12 sm:col-span-8 grid grid-cols-12 gap-3">
                  <div className="col-span-12 lg:col-span-4">
                    <label className="flex flex-col text-sm">
                      <span className="mb-1 text-slate-600">Rally Leader</span>
                      <input
                        type="text"
                        placeholder="e.g., Jins"
                        className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={row.name}
                        onChange={(e) => updateMarch(row.id, "name", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="col-span-6 lg:col-span-4">
                    <label className="flex flex-col text-sm">
                      <span className="mb-1 text-slate-600">Minutes</span>
                      <input
                        inputMode="numeric"
                        className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={row.m}
                        onChange={(e) => updateMarch(row.id, "m", e.target.value)}
                        placeholder="0"
                      />
                    </label>
                  </div>
                  <div className="col-span-6 lg:col-span-4">
                    <label className="flex flex-col text-sm">
                      <span className="mb-1 text-slate-600">Seconds</span>
                      <input
                        inputMode="numeric"
                        className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={row.s}
                        onChange={(e) => updateMarch(row.id, "s", e.target.value)}
                        placeholder="0"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onCalculate}
            disabled={isCalculateDisabled}
            className={`px-4 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isCalculateDisabled ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
          >
            Calculate
          </button>
          <button onClick={onReset} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">Reset</button>
        </div>

        {/* Validation / info message */}
        {note && (
          <div className="mt-4 text-sm rounded-xl border px-3 py-2 bg-amber-50 border-amber-200 text-amber-900">
            {note}
          </div>
        )}

        {/* Plan output */}
        <div className="mt-6">
          <h3 className="text-sm uppercase tracking-wider text-slate-500">Plan</h3>
          {plan && plan.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-left text-sm text-slate-600">
                  <tr>
                    <th className="px-3 py-2 border-b">Seq</th>
                    <th className="px-3 py-2 border-b">Rally Leader</th>
                    <th className="px-3 py-2 border-b">Duration (H:M:S)</th>
                    <th className="px-3 py-2 border-b">Offset</th>
                    <th className="px-3 py-2 border-b">Start Δ vs P1</th>
                    <th className="px-3 py-2 border-b">Arrival (UTC)</th>
                    <th className="px-3 py-2 border-b">Send at (UTC)</th>
                    <th className="px-3 py-2 border-b">Start Rally at (UTC)</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {plan.map((r) => (
                    <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                      <td className="px-3 py-2 border-b">{r.seq}</td>
                      <td className="px-3 py-2 border-b">{r.name}</td>
                      <td className="px-3 py-2 border-b font-mono">{r.durationHMS}</td>
                      <td className="px-3 py-2 border-b">+{r.offsetSec}s</td>
                      <td className="px-3 py-2 border-b">
                        {r.startDeltaSec >= 0 ? `+${r.startDeltaSec}s` : `${r.startDeltaSec}s`}
                      </td>
                      <td className="px-3 py-2 border-b font-mono">{r.arrivalTime}</td>
                      <td className="px-3 py-2 border-b font-mono">{r.sendTime}</td>
                      <td className="px-3 py-2 border-b font-mono">{r.rallyStartTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-400 mt-2">
              No plan yet. Add at least one non-zero march, then click Calculate. Use ↑/↓ to change arrival order.
            </div>
          )}
        </div>

        {/* Kingshot copy-paste messages */}
        {plan && plan.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm uppercase tracking-wider text-slate-500">Kingshot Messages</h3>
            <p className="text-slate-600 text-sm mt-1">Copy & paste these to your rally leaders.</p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => copyText(buildMessages(plan))}
                className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Copy all
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {plan.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <code className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm block whitespace-pre-wrap">
                    {messageFor(r)}
                  </code>
                  <button
                    onClick={() => copyText(messageFor(r))}
                    className="shrink-0 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
                    aria-label={`Copy message for ${r.name}`}
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8">
            <div className="text-sm font-medium text-slate-700">Summary</div>
            <pre className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
            {summary(plan)}
            </pre>
            </div>

          </div>
        )}

        {/* Note & Guide (only after plan exists) */}
        {plan && plan.length > 0 && (
          <div className="mt-6 text-xs text-slate-500 space-y-3" aria-live="polite">
            {note && <p className="text-slate-600">{note}</p>}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <p className="mb-2 font-medium text-slate-700">📷 Example — How to use:</p>
              <img
                src="/rally_time.jpg"
                alt="Guide showing how to enter time, set names, and order arrivals"
                className="rounded-lg shadow-sm w-full max-w-md mx-auto"
              />
              <p className="mt-2 text-slate-600 text-[0.8rem] text-center">
                We calculate from now. Each leader gets ≥{READINESS_SECONDS}s before their rally start.
                Arrivals are spaced by {GAP_SECONDS}s. Send time = arrival − march duration. Start rally time = send time − 5 minutes.
                “Start Δ vs P1” tells each leader how many seconds later/earlier to START relative to Player 1.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

