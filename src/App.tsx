import React, { useMemo, useState } from "react";

/**
 * Rally Timing Planner (with Kingshot messages)
 * - Target arrival time (H:M:S) in UTC
 * - Multiple march times (M:S only) with Rally Leader name
 * - Manual arrival ordering (top-to-bottom order controls arrival sequence)
 * - Fixed 2s gap between arrivals
 * - Kingshot rallies are 5 minutes long: we subtract 5m from the SEND time
 */
export default function RallyTimingPlanner() {
  // --- Types ---
  type March = { id: string; name: string; m: string; s: string };
  type PlanRow = {
    id: string;
    seq: number; // 1-based arrival sequence (current list order)
    name: string;
    durationSec: number; // march duration
    durationHMS: string;
    arrivalTime: string; // H:M:S absolute (UTC) — impact time
    sendTime: string; // H:M:S absolute (UTC) — when to send march
    rallyStartTime: string; // H:M:S absolute (UTC) — when to START the 5m rally (sendTime - 5m)
    offsetSec: number; // (seq-1) * GAP_SECONDS
  };

  // --- Target arrival time (when the first rally should hit) ---
  const [targetH, setTargetH] = useState("0");
  const [targetM, setTargetM] = useState("0");
  const [targetS, setTargetS] = useState("0");

  // --- Marches list; order of array = arrival order ---
  const [marches, setMarches] = useState<March[]>([
    { id: cryptoRandomId(), name: "", m: "0", s: "0" },
  ]);

  // Gap seconds between arrivals
  const GAP_SECONDS = 2;
  // Kingshot rally prep (rally duration before auto-launch)
  const RALLY_PREP_SECONDS = 5 * 60; // 5 minutes

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
  const toSecTarget = (h: string, m: string, s: string) =>
    normalizeInt(h) * 3600 + normalizeInt(m) * 60 + normalizeInt(s);
  const toSecMarch = (m: string, s: string) => normalizeInt(m) * 60 + normalizeInt(s);

  // Derived totals
  const targetArrivalSec = useMemo(
    () => toSecTarget(targetH, targetM, targetS),
    [targetH, targetM, targetS]
  );

  const marchesWithSec = useMemo(
    () => marches.map((r) => ({ ...r, totalSec: toSecMarch(r.m, r.s) })),
    [marches]
  );

  const hasAtLeastOneMarch = marchesWithSec.some((m) => m.totalSec > 0);
  const isCalculateDisabled = targetArrivalSec === 0 || !hasAtLeastOneMarch;

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
    setTargetH("0");
    setTargetM("0");
    setTargetS("0");
    setMarches([{ id: cryptoRandomId(), name: "", m: "0", s: "0" }]);
    setPlan(null);
    setNote("");
  };

  const onCalculate = () => {
    // Validate target arrival is at least 7 minutes from *current UTC time*
    const now = new Date();
    const nowEpoch = Math.floor(now.getTime() / 1000);
    const targetEpochToday = Math.floor(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        normalizeInt(targetH),
        normalizeInt(targetM),
        normalizeInt(targetS)
      ) / 1000
    );
    const MIN_LEAD = 7 * 60; // 7 minutes in seconds

    // choose the *next* occurrence of the target time (today or tomorrow)
    let targetEpoch = targetEpochToday;
    if (targetEpoch < nowEpoch) {
      // move to tomorrow same time
      targetEpoch += 24 * 3600;
    }

    if (targetEpoch - nowEpoch < MIN_LEAD) {
      const earliest = new Date((nowEpoch + MIN_LEAD) * 1000);
      const hh = String(earliest.getUTCHours()).padStart(2, "0");
      const mm = String(earliest.getUTCMinutes()).padStart(2, "0");
      const ss = String(earliest.getUTCSeconds()).padStart(2, "0");
      setPlan(null);
      setNote(
        `Target arrival must be at least 7 minutes in the future. Earliest allowed: ${hh}:${mm}:${ss} UTC.`
      );
      return;
    }

    // Use current list order for arrival sequencing (no auto-sort)
    const active = marchesWithSec.filter((m) => m.totalSec > 0);

    const rows: PlanRow[] = active.map((m, idx) => {
      const offsetSec = idx * GAP_SECONDS; // arrivals spaced by gap, in your chosen order

      // Arrival/send should be based on the validated absolute targetEpoch
      const arrivalAbsEpoch = targetEpoch + offsetSec;
      const sendAbsEpoch = arrivalAbsEpoch - m.totalSec; // when to SEND the march
      const rallyStartAbsEpoch = sendAbsEpoch - RALLY_PREP_SECONDS; // when to START the 5m rally

      const arrivalDate = new Date(arrivalAbsEpoch * 1000);
      const sendDate = new Date(sendAbsEpoch * 1000);
      const rallyStartDate = new Date(rallyStartAbsEpoch * 1000);

      const fmt = (d: Date) =>
        `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;

      return {
        id: m.id,
        seq: idx + 1,
        name: m.name || `Leader ${idx + 1}`,
        durationSec: m.totalSec,
        durationHMS: hms(m.totalSec),
        arrivalTime: fmt(arrivalDate),
        sendTime: fmt(sendDate),
        rallyStartTime: fmt(rallyStartDate),
        offsetSec,
      };
    });

    setPlan(rows);
    setNote(
      rows.length > 0
        ? `Planned ${rows.length} rallies at ${GAP_SECONDS}s spacing using your chosen order (top to bottom).`
        : ""
    );
  };

  // --- Kingshot message helpers ---

  function buildMessages(rows: PlanRow[]) {
  return rows.map((r) => `• ${messageFor(r)}`).join("\n");
}

  function messageFor(r: PlanRow) {
    // Kingshot fixed rally duration is 5 minutes; players should START the rally at rallyStartTime.
    return `${r.name} start your 5 minutes rally at ${r.rallyStartTime} UTC`;
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
          Set a target arrival time and add multiple marches with a <strong>Rally Leader</strong> name. Arrange their order; we schedule arrivals at fixed <strong>{GAP_SECONDS}s</strong> gaps following your order. Times are in H:M:S (target) and M:S (march). All times are <strong>UTC</strong>.
        </p>

        {/* Target time */}
        <section className="space-y-3 mb-6">
          <h2 className="font-medium text-slate-800">Target Arrival Time (UTC)</h2>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-slate-600">Hours</span>
              <input
                inputMode="numeric"
                aria-label="Target hours"
                className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={targetH}
                onChange={(e) => setTargetH(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-slate-600">Minutes</span>
              <input
                inputMode="numeric"
                aria-label="Target minutes"
                className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={targetM}
                onChange={(e) => setTargetM(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-slate-600">Seconds</span>
              <input
                inputMode="numeric"
                aria-label="Target seconds"
                className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={targetS}
                onChange={(e) => setTargetS(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
        </section>

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
                      <td className="px-3 py-2 border-b">{r.offsetSec}s</td>
                      <td className="px-3 py-2 border-b font-mono">{r.arrivalTime}</td>
                      <td className="px-3 py-2 border-b font-mono">{r.sendTime}</td>
                      <td className="px-3 py-2 border-b font-mono">{r.rallyStartTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-400 mt-2">No plan yet. Set a target time and at least one non-zero march, then click Calculate. Use ↑/↓ to change arrival order.</div>
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
                Arrange marches top-to-bottom to set arrival order. Each arrival is spaced by {GAP_SECONDS}s. Send time = arrival − march duration. Start rally time = send time − 5 minutes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

