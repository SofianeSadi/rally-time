import React, { useMemo, useState } from "react";

/**
 * App.tsx – Setup + Rally Planner + Reinforcement Tool
 * - Setup page defines a single target and a list of members (name + march time).
 * - Rally Planner uses these members as rally leaders with preset march times.
 * - Reinforcement Tool uses the same members (auto-fills march time on select).
 * - Reinforcement timing is ALWAYS "after impact" + offset seconds.
 */

// =========================
// Utilities (shared)
// =========================
const zeroPad2 = (n: number) => String(n).padStart(2, "0");

const hms = (total: number) => {
  if (total < 0) total = 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${zeroPad2(m)}:${zeroPad2(s)}`;
};

const normalizeInt = (v?: string) => {
  if (!v || v.trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

const toSec = (m?: string, s?: string) =>
  normalizeInt(m) * 60 + normalizeInt(s);

const hmsToSec = (str: string) => {
  const [hh, mm, ss] = str.split(":").map(Number);
  return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
};

const mmss = (sec: number) => {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${zeroPad2(m)}:${zeroPad2(s)}`;
};

const ordinal = (n: number) => {
  const words = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
  ];
  return words[n - 1] ?? `${n}th`;
};

function cryptoRandomId() {
  return (
    Math.random().toString(36).slice(2, 9) +
    Math.random().toString(36).slice(2, 5)
  );
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

// =========================
// Shared Setup Types
// =========================
type Member = {
  id: string;
  name: string;
  m: string;      // minutes as string
  s: string;      // seconds as string
  marchSec: number; // derived total seconds
};

type SetupData = {
  targetLabel: string;
  members: Member[];
};

// =========================
// Setup Page
// =========================
function SetupPage({
  setup,
  setSetup,
}: {
  setup: SetupData;
  setSetup: (v: SetupData) => void;
}) {
  const addMember = () => {
  setSetup({
    ...setup,
    members: [
      ...setup.members,
      { id: cryptoRandomId(), name: "", m: "0", s: "0", marchSec: 0 },
    ],
  });
};

const updateMember = (
  id: string,
  field: "name" | "m" | "s",
  value: string
) => {
  setSetup({
    ...setup,
    members: setup.members.map((m) => {
      if (m.id !== id) return m;

      if (field === "name") {
        return { ...m, name: value };
      }

      if (field === "m") {
        const newM = value;
        return {
          ...m,
          m: newM,
          marchSec: toSec(newM, m.s),
        };
      }

      // field === "s"
      const newS = value;
      return {
        ...m,
        s: newS,
        marchSec: toSec(m.m, newS),
      };
    }),
  });
};

  const removeMember = (id: string) => {
    setSetup({
      ...setup,
      members: setup.members.filter((m) => m.id !== id),
    });
  };

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Setup</h1>
      <p className="text-slate-600 mb-4">
        Define your <strong>Target</strong> and the list of{" "}
        <strong>joiners</strong>. Their march times will be used in both the
        Rally Planner and Reinforcement Tool.
      </p>

      {/* Target label */}
      <section className="mb-6 border rounded-2xl p-4 bg-slate-50">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-slate-600">Target name</span>
          <input
            className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Sanctuary, Castle, etc."
            value={setup.targetLabel}
            onChange={(e) =>
              setSetup({ ...setup, targetLabel: e.target.value })
            }
          />
          <span className="mt-1 text-xs text-slate-500">
            This label will be shown in messages, e.g. “start rally for{" "}
            {setup.targetLabel || "TARGET"} at 12:34:56 UTC”.
          </span>
        </label>
      </section>

      {/* Members */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-800">Players</h2>
          <button
            onClick={addMember}
            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200"
          >
            + Add Member
          </button>
        </div>

        {setup.members.length === 0 && (
          <div className="text-sm text-slate-500">
            No members yet. Add players and give them a march time.
          </div>
        )}

        
        {setup.members.map((m, idx) => (
  <div
    key={m.id}
    className="border rounded-xl p-3 grid grid-cols-12 gap-3 items-center"
  >
    <div className="col-span-12 sm:col-span-4">
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-slate-600">
          Member #{idx + 1} – Name
        </span>
        <input
          placeholder="e.g. Jins"
          className="border rounded-xl px-3 py-2 w-full"
          value={m.name}
          onChange={(e) =>
            updateMember(m.id, "name", e.target.value ?? "")
          }
        />
      </label>
    </div>

    <div className="col-span-12 sm:col-span-5">
      <label className="flex flex-col text-sm">
        <span className="mb-1 text-slate-600">March Time (MM:SS)</span>
        <div className="flex gap-2 items-center">
          <input
            placeholder="MM"
            className="border rounded-xl px-3 py-2 w-20 text-center"
            value={m.m}
            onChange={(e) => updateMember(m.id, "m", e.target.value)}
          />
          <span>:</span>
          <input
            placeholder="SS"
            className="border rounded-xl px-3 py-2 w-20 text-center"
            value={m.s}
            onChange={(e) => updateMember(m.id, "s", e.target.value)}
          />
          <span className="text-xs text-slate-500 ml-2">
            Stored: {mmss(m.marchSec)}
          </span>
        </div>
      </label>
    </div>

    <div className="col-span-12 sm:col-span-3 flex justify-end">
      <button
        onClick={() => removeMember(m.id)}
        className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100"
      >
        Remove
      </button>
    </div>
  </div>
))}

      </section>
    </div>
  );
}

// =========================
// Rally Timing Planner Page
// (now uses setup.members + setup.targetLabel)
// =========================
function RallyTimingPlannerPage({ setup }: { setup: SetupData }) {
  type March = {
    id: string;
    leader: string;
    editing?: boolean;
    customM?: string; // edited minutes
    customS?: string; // edited seconds
  };

  type PlanRow = {
    id: string;
    seq: number;
    name: string;
    target: string;
    durationSec: number;
    durationHMS: string;
    arrivalTime: string;
    sendTime: string;
    rallyStartTime: string;
    offsetSec: number;
    startDeltaSec: number;
  };

  const GAP_SECONDS = 2;
  const RALLY_PREP_SECONDS = 5 * 60;
  const READINESS_SECONDS = 40;

  const LEADERS = setup.members.map((m) => m.name);


  const [marches, setMarches] = useState<March[]>([
    { id: cryptoRandomId(), leader: "" },
  ]);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [note, setNote] = useState("");

  const getPresetSec = (leader: string) =>
    setup.members.find((m) => m.name === leader)?.marchSec ?? 0;

  const getEffectiveSec = (row: March) => {
    const custom = toSec(row.customM, row.customS);
    if (custom > 0) return custom;
    return getPresetSec(row.leader);
  };

  const marchesWithSec = useMemo(
    () =>
      marches.map((r) => ({
        ...r,
        totalSec: getEffectiveSec(r),
      })),
    [marches, setup]
  );

  const hasAtLeastOneMarch = marchesWithSec.some((m) => m.totalSec > 0);
  const isCalculateDisabled =
    !hasAtLeastOneMarch || !setup.targetLabel || setup.members.length === 0;

  const addMarch = () =>
    setMarches((prev) => [...prev, { id: cryptoRandomId(), leader: "" }]);
  const removeMarch = (id: string) =>
    setMarches((prev) =>
      prev.length > 1 ? prev.filter((x) => x.id !== id) : prev
    );
  const updateLeader = (id: string, leader: string) =>
    setMarches((prev) =>
      prev.map((x) => (x.id === id ? { ...x, leader } : x))
    );
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

  const toggleEdit = (id: string, on?: boolean) =>
    setMarches((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, editing: on ?? !x.editing } : x
      )
    );
  const setCustom = (id: string, field: "customM" | "customS", val: string) =>
    setMarches((prev) =>
      prev.map((x) => (x.id === id ? { ...x, [field]: val } : x))
    );
  const clearCustom = (id: string) =>
    setMarches((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, customM: undefined, customS: undefined } : x
      )
    );

  const onReset = () => {
    setMarches([{ id: cryptoRandomId(), leader: "" }]);
    setPlan(null);
    setNote("");
  };

  const onCalculate = () => {
    if (!setup.targetLabel) {
      setPlan(null);
      setNote("Define a target in the Setup page first.");
      return;
    }
    if (setup.members.length === 0) {
      setPlan(null);
      setNote("Add at least one member in the Setup page.");
      return;
    }

    const now = new Date();
    const nowEpoch = Math.floor(now.getTime() / 1000);

    const active = marchesWithSec.filter((m) => m.totalSec > 0);
    if (active.length === 0) {
      setPlan(null);
      setNote("Choose at least one leader with a non-zero duration.");
      return;
    }

    const maxSkew = active.reduce(
      (acc, m, idx) => Math.max(acc, m.totalSec - idx * GAP_SECONDS),
      0
    );
    const firstArrivalAbs =
      nowEpoch + READINESS_SECONDS + RALLY_PREP_SECONDS + maxSkew;

    const firstDuration = active[0].totalSec;

    const rows: PlanRow[] = active.map((m, idx) => {
      const arrivalAbs = firstArrivalAbs + idx * GAP_SECONDS;
      const sendAbs = arrivalAbs - m.totalSec;
      const startAbs = sendAbs - RALLY_PREP_SECONDS;

      const fmt = (d: Date) =>
        `${String(d.getUTCHours()).padStart(2, "0")}:${String(
          d.getUTCMinutes()
        ).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;

      const arrivalDate = new Date(arrivalAbs * 1000);
      const sendDate = new Date(sendAbs * 1000);
      const startDate = new Date(startAbs * 1000);

      const startDeltaSec = idx * GAP_SECONDS - (m.totalSec - firstDuration);

      return {
        id: m.id,
        seq: idx + 1,
        name: m.leader || `Leader ${idx + 1}`,
        target: setup.targetLabel,
        durationSec: m.totalSec,
        durationHMS: hms(m.totalSec),
        arrivalTime: fmt(arrivalDate),
        sendTime: fmt(sendDate),
        rallyStartTime: fmt(startDate),
        offsetSec: idx * GAP_SECONDS,
        startDeltaSec,
      };
    });

    setPlan(rows);
    setNote(
      rows.length > 0
        ? `Arrivals are evenly spaced by ${GAP_SECONDS}s. All rally starts are ≥${READINESS_SECONDS}s from now. Target: ${setup.targetLabel}.`
        : ""
    );
  };

  function summary(rows: PlanRow[]) {
    if (!rows || rows.length === 0) return "";
    const byAppear = [...rows].sort(
      (a, b) => hmsToSec(a.rallyStartTime) - hmsToSec(b.rallyStartTime)
    );
    const byHit = [...rows].sort(
      (a, b) => hmsToSec(a.arrivalTime) - hmsToSec(b.arrivalTime)
    );
    const hitRank = new Map<string, number>();
    byHit.forEach((r, i) => hitRank.set(r.id, i + 1));

    const lines: string[] = [];
    for (let i = 0; i < byAppear.length; i++) {
      const r = byAppear[i];
      const appearOrd = ordinal(i + 1);
      if (i === 0) {
        lines.push(`- ${r.name} appear ${appearOrd}.`);
      } else {
        const prev = byAppear[i - 1];
        const delta =
          hmsToSec(r.rallyStartTime) - hmsToSec(prev.rallyStartTime);
        const abs = Math.abs(delta);
        const unit = abs === 1 ? "second" : "seconds";
        const anchor = mmss(5 * 60 - abs);
        lines.push(
          `- ${r.name} appear ${appearOrd}, rally shows ${abs} ${unit} ${
            delta >= 0 ? "more" : "less"
          } than ${prev.name} (should appear when ${prev.name}'s rally at ${anchor})`
        );
      }
    }
    return lines.join("\n");
  }

  function messageFor(r: PlanRow) {
    const targetText = r.target ? ` for ${r.target}` : "";
    return `${r.name}${targetText} start rally at ${r.rallyStartTime} UTC`;
  }
  function buildMessages(rows: PlanRow[]) {
    const messages = rows.map((r) => `• ${messageFor(r)}`).join("\n");
    return `${messages}
----
Verification:
${summary(rows)}`;
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Rally Timing Planner
      </h1>
      <p className="text-slate-600 mb-4">
        Target:{" "}
        <strong>{setup.targetLabel || "No target (set it in Setup tab)"}</strong>
        . Choose leaders in arrival order. Each leader gets at least{" "}
        <strong>40s</strong> to read. Arrivals are spaced by{" "}
        <strong>2s</strong>. Times are <strong>UTC</strong>.
      </p>

      {/* Info when setup not ready */}
      {(!setup.targetLabel || setup.members.length === 0) && (
        <div className="mb-4 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-900">
          Go to <strong>Setup</strong> to define a target and members (with march
          times) before using the planner.
        </div>
      )}

      {/* Rows */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-800">
            Marches (Top to bottom = arrival order)
          </h2>
          <button
            onClick={addMarch}
            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200"
          >
            + Add March
          </button>
        </div>

        <div className="space-y-3">
          {marches.map((row, i) => {
            const effectiveSec = getEffectiveSec(row);
            const presetSec = getPresetSec(row.leader);
            const isUsingCustom =
              toSec(row.customM, row.customS) > 0 && effectiveSec !== presetSec;

            return (
              <div
                key={row.id}
                className="grid grid-cols-12 gap-3 items-stretch border rounded-xl p-3"
              >
                {/* Controls */}
                <div className="col-span-12 sm:col-span-2 flex sm:flex-col gap-2 order-last sm:order-first">
                  <button
                    onClick={() => moveUp(i)}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    disabled={i === 0}
                    aria-label={`Move row ${i + 1} up`}
                  >
                    ↑ Up
                  </button>
                  <button
                    onClick={() => moveDown(i)}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                    disabled={i === marches.length - 1}
                    aria-label={`Move row ${i + 1} down`}
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

                {/* Label */}
                <div className="col-span-12 sm:col-span-2 text-sm text-slate-500 self-center">
                  Arrival #{i + 1}
                </div>

                {/* Inputs */}
                <div className="col-span-12 sm:col-span-8 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-12 lg:col-span-4">
                    <label className="flex flex-col text-sm">
                      <span className="mb-1 text-slate-600">Rally Leader</span>
                      <select
                        className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={row.leader}
                        onChange={(e) =>
                          updateLeader(row.id, (e.target.value as string) || "")
                        }
                      >
                        <option value="">— Select leader —</option>
                        {LEADERS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Duration with inline edit */}
                  <div className="col-span-12 lg:col-span-8">
                    {!row.editing ? (
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          className={`border rounded-xl px-3 py-2 font-mono w-full ${
                            isUsingCustom ? "bg-emerald-50" : "bg-slate-100"
                          }`}
                          value={
                            effectiveSec > 0 ? hms(effectiveSec) : "— (no time)"
                          }
                          title={
                            isUsingCustom
                              ? `Custom overrides preset (${hms(presetSec)})`
                              : `Preset duration from Setup`
                          }
                        />
                        <button
                          onClick={() => toggleEdit(row.id, true)}
                          className="px-2 py-1 rounded-lg hover:bg-slate-100"
                          title="Edit duration"
                          aria-label="Edit duration"
                        >
                          ✎
                        </button>
                        {isUsingCustom && (
                          <button
                            onClick={() => clearCustom(row.id)}
                            className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs"
                            title="Clear custom and use preset"
                          >
                            Reset to preset
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          inputMode="numeric"
                          className="border rounded-xl px-3 py-2 w-20 text-center"
                          value={row.customM ?? "0"}
                          onChange={(e) =>
                            setCustom(row.id, "customM", e.target.value)
                          }
                          aria-label="Custom minutes"
                        />
                        <span>:</span>
                        <input
                          inputMode="numeric"
                          className="border rounded-xl px-3 py-2 w-20 text-center"
                          value={row.customS ?? "0"}
                          onChange={(e) =>
                            setCustom(row.id, "customS", e.target.value)
                          }
                          aria-label="Custom seconds"
                        />
                        <button
                          onClick={() => toggleEdit(row.id, false)}
                          className="px-2 py-1 rounded-lg hover:bg-emerald-100 text-emerald-700"
                          title="Save"
                          aria-label="Save duration"
                        >
                          ✔
                        </button>
                        <button
                          onClick={() => {
                            toggleEdit(row.id, false);
                          }}
                          className="px-2 py-1 rounded-lg hover:bg-slate-100"
                          title="Cancel"
                          aria-label="Cancel editing"
                        >
                          ✕
                        </button>
                        <span className="text-xs text-slate-500 ml-2">
                          Effective: {hms(getEffectiveSec(row))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={onCalculate}
          disabled={isCalculateDisabled}
          className={`px-4 py-2 rounded-xl font-medium ${
            isCalculateDisabled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          Calculate
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-medium hover:bg-slate-200"
        >
          Reset
        </button>
      </div>

      {/* Validation / info */}
      {note && (
        <div className="mt-4 text-sm rounded-xl border px-3 py-2 bg-amber-50 border-amber-200 text-amber-900">
          {note}
        </div>
      )}

      {/* Plan */}
      <div className="mt-6">
        <h3 className="text-sm uppercase tracking-wider text-slate-500">Plan</h3>
        {plan && plan.length > 0 ? (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-left text-sm text-slate-600">
                <tr>
                  <th className="px-3 py-2 border-b">Seq</th>
                  <th className="px-3 py-2 border-b">Rally Leader</th>
                  <th className="px-3 py-2 border-b">Target</th>
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
                    <td className="px-3 py-2 border-b">{r.target}</td>
                    <td className="px-3 py-2 border-b font-mono">
                      {r.durationHMS}
                    </td>
                    <td className="px-3 py-2 border-b">+{r.offsetSec}s</td>
                    <td className="px-3 py-2 border-b">
                      {r.startDeltaSec >= 0
                        ? `+${r.startDeltaSec}s`
                        : `${r.startDeltaSec}s`}
                    </td>
                    <td className="px-3 py-2 border-b font-mono">
                      {r.arrivalTime}
                    </td>
                    <td className="px-3 py-2 border-b font-mono">
                      {r.sendTime}
                    </td>
                    <td className="px-3 py-2 border-b font-mono">
                      {r.rallyStartTime}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-slate-400 mt-2">
            No plan yet. Set up your target & members, choose leaders, then
            click Calculate. Use ↑/↓ to change arrival order.
          </div>
        )}
      </div>

      {/* Messages */}
      {plan && plan.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm uppercase tracking-wider text-slate-500">
            Kingshot Messages
          </h3>
          <p className="text-slate-600 text-sm mt-1">
            Copy & paste these to your rally leaders.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => copyText(buildMessages(plan!))}
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
    </div>
  );
}

// =========================
// Reinforcement Timing Tool
// (Always after impact, uses setup.members march times)
// =========================
function ReinforcementTimingToolPage({ setup }: { setup: SetupData }) {
  // Opponent inputs
  const [oppRallyM, setOppRallyM] = useState("0");
  const [oppRallyS, setOppRallyS] = useState("0");
  const [oppMarchM, setOppMarchM] = useState("0");
  const [oppMarchS, setOppMarchS] = useState("0");

  // Always after impact, by offset seconds
  const [offsetSec, setOffsetSec] = useState(1);

  type Row = {
    id: string;
    leader: string;
    m: string; // our march minutes
    s: string; // our march seconds
  };

  const LEADERS = setup.members.map((m) => m.name);

  const [rows, setRows] = useState<Row[]>([
    { id: cryptoRandomId(), leader: "", m: "0", s: "0" },
  ]);

  type Result = { id: string; name: string; sendUTC: string };
  const [launchUTC, setLaunchUTC] = useState<string>("—");
  const [impactUTC, setImpactUTC] = useState<string>("—");
  const [results, setResults] = useState<Result[] | null>(null);

  const toUTC = (epoch: number) => {
    const d = new Date(epoch * 1000);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
  };

  const toSecLocal = (m: string, s: string) =>
    (Number.isFinite(Number(m)) ? Math.max(0, Math.floor(Number(m))) : 0) *
      60 +
    (Number.isFinite(Number(s)) ? Math.max(0, Math.floor(Number(s))) : 0);

  const addRow = () =>
    setRows((p) => [...p, { id: cryptoRandomId(), leader: "", m: "0", s: "0" }]);
  const removeRow = (id: string) =>
    setRows((p) => (p.length > 1 ? p.filter((x) => x.id !== id) : p));
  const updateField = (id: string, field: "m" | "s", value: string) =>
    setRows((p) =>
      p.map((x) => (x.id === id ? { ...x, [field]: value } : x))
    );
  const moveUp = (idx: number) =>
    idx > 0 &&
    setRows((p) => {
      const c = [...p];
      [c[idx - 1], c[idx]] = [c[idx], c[idx - 1]];
      return c;
    });
  const moveDown = (idx: number) =>
    setRows((p) => {
      if (idx >= p.length - 1) return p;
      const c = [...p];
      [c[idx + 1], c[idx]] = [c[idx], c[idx + 1]];
      return c;
    });

    const onSelectLeader = (id: string, leader: string) => {
        const member = setup.members.find((m) => m.name === leader);
        if (!member) {
            setRows((p) =>
                    p.map((x) => (x.id === id ? { ...x, leader } : x))
                   );
                   return;
        }
        const [mm, ss] = mmss(member.marchSec).split(":");
        setRows((p) =>
                p.map((x) =>
                      x.id === id
                          ? {
                              ...x,
                              leader,
                              m: String(Number(mm)),
                              s: String(Number(ss)),
                          }
                              : x
                     )
               );
    };


  const canCalc = () =>
    toSec(oppRallyM, oppRallyS) > 0 &&
    rows.some((r) => toSecLocal(r.m, r.s) > 0);

  const onCalculate = () => {
    const now = new Date();
    const baseEpoch = Math.floor(now.getTime() / 1000);

    const rallySec = toSec(oppRallyM, oppRallyS);
    const oppMarchSec = toSec(oppMarchM, oppMarchS);

    const launchEpoch = baseEpoch + rallySec;
    const impactEpoch = launchEpoch + oppMarchSec;
    const targetEpoch = impactEpoch; // ALWAYS after impact

    setLaunchUTC(toUTC(launchEpoch));
    setImpactUTC(toUTC(impactEpoch));

    const res: Result[] = rows
      .filter((r) => toSecLocal(r.m, r.s) > 0)
      .map((r) => {
        const ourSec = toSecLocal(r.m, r.s);
        const sendEpoch = targetEpoch + offsetSec - ourSec; // arrive offset AFTER impact
        return {
          id: r.id,
          name: r.leader || "Player",
          sendUTC: toUTC(sendEpoch),
        };
      });
    setResults(res);
  };

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Reinforcement Timing Tool
      </h1>
      <p className="text-slate-600 mb-4">
        We use the current UTC time when you click <strong>Calculate</strong>.
        Enter opponent rally time remaining and march time to you. Your players
        will be instructed to arrive <strong>after impact</strong> by the offset
        you choose (default +1s).
      </p>

      {(!setup.targetLabel || setup.members.length === 0) && (
        <div className="mb-4 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-900">
          Reinforcements will still work without Setup, but if you define
          members there, selecting a leader will auto-fill their march time.
        </div>
      )}

      {/* Opponent */}
      <section className="mb-4 border rounded-2xl p-4 bg-slate-50">
        <h2 className="font-medium text-slate-800 mb-2">Opponent</h2>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-6">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-slate-600">
                Rally time remaining (MM:SS)
              </span>
              <div className="flex gap-2">
                <input
                  className="border rounded-xl px-3 py-2 w-20 text-center"
                  value={oppRallyM}
                  onChange={(e) => setOppRallyM(e.target.value)}
                />
                <span>:</span>
                <input
                  className="border rounded-xl px-3 py-2 w-20 text-center"
                  value={oppRallyS}
                  onChange={(e) => setOppRallyS(e.target.value)}
                />
              </div>
            </label>
          </div>
          <div className="col-span-12 sm:col-span-6">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-slate-600">
                Opponent march time to us (MM:SS)
              </span>
              <div className="flex gap-2">
                <input
                  className="border rounded-xl px-3 py-2 w-20 text-center"
                  value={oppMarchM}
                  onChange={(e) => setOppMarchM(e.target.value)}
                />
                <span>:</span>
                <input
                  className="border rounded-xl px-3 py-2 w-20 text-center"
                  value={oppMarchS}
                  onChange={(e) => setOppMarchS(e.target.value)}
                />
              </div>
            </label>
          </div>
        </div>
      </section>

      {/* Sync rule – always after impact */}
      <section className="mb-4 border rounded-2xl p-4 bg-slate-50">
        <h2 className="font-medium text-slate-800 mb-2">Sync Rule</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div>
            Arrive <strong>after impact</strong> by{" "}
            <input
              inputMode="numeric"
              className="border rounded-xl px-3 py-2 w-16 text-center mx-1"
              value={String(offsetSec)}
              onChange={(e) => setOffsetSec(Number(e.target.value) || 0)}
            />{" "}
            seconds.
          </div>
        </div>
      </section>

      {/* Our players */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-800">
            Players (the garisson including leader)
          </h2>
          <button
            onClick={addRow}
            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200"
          >
            + Add Player
          </button>
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="grid grid-cols-12 gap-3 items-stretch border rounded-xl p-3"
            >
              <div className="col-span-12 sm:col-span-2 flex sm:flex-col gap-2 order-last sm:order-first">
                <button
                  onClick={() => moveUp(i)}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                  disabled={i === 0}
                >
                  ↑ Up
                </button>
                <button
                  onClick={() => moveDown(i)}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                  disabled={i === rows.length - 1}
                >
                  ↓ Down
                </button>
                <button
                  onClick={() => removeRow(row.id)}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  disabled={rows.length === 1}
                >
                  Remove
                </button>
              </div>

              <div className="col-span-12 sm:col-span-3 self-center text-sm text-slate-500">
                Player #{i + 1}
              </div>

              <div className="col-span-12 sm:col-span-7 grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 lg:col-span-6">
                  <label className="flex flex-col text-sm">
                    <span className="mb-1 text-slate-600">Joiner</span>
                    <select
                      className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={row.leader}
                      onChange={(e) =>
                        onSelectLeader(row.id, (e.target.value as string) || "")
                      }
                    >
                      <option value="">— Select joiner —</option>
                      {LEADERS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 text-xs text-slate-500">
                      If defined in Setup, march time auto-fills.
                    </span>
                  </label>
                </div>
                <div className="col-span-12 lg:col-span-6">
                  <label className="flex flex-col text-sm">
                    <span className="mb-1 text-slate-600">Our march (MM:SS)</span>
                    <div className="flex gap-2">
                      <input
                        className="border rounded-xl px-3 py-2 w-20 text-center"
                        value={row.m}
                        onChange={(e) =>
                          updateField(row.id, "m", e.target.value)
                        }
                      />
                      <span>:</span>
                      <input
                        className="border rounded-xl px-3 py-2 w-20 text-center"
                        value={row.s}
                        onChange={(e) =>
                          updateField(row.id, "s", e.target.value)
                        }
                      />
                    </div>
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
          disabled={!canCalc()}
          className={`px-4 py-2 rounded-xl font-medium ${
            !canCalc()
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          Calculate
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="mt-6 border rounded-2xl p-4">
          <div className="text-sm text-slate-700 space-y-1">
            <div>
              <span className="font-medium">Opponent launches:</span>{" "}
              {launchUTC} UTC
            </div>
            <div>
              <span className="font-medium">Opponent hits:</span> {impactUTC} UTC
            </div>
            <div>
              <span className="font-medium">Arrival rule:</span> after impact by{" "}
              {offsetSec}s
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-sm uppercase tracking-wider text-slate-500">
              Send times
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {results.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.name}</span>: send at{" "}
                  <code className="font-mono">{r.sendUTC}</code> UTC
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Formula: <code>launch = now + rally</code>,{" "}
            <code>impact = launch + opponentMarch</code>,{" "}
            <code>send = impact + offset − playerMarch</code>.
          </p>
        </div>
      )}

      {/* Example */}
      <div className="mt-6 text-xs text-slate-500">
        <p className="font-medium">
          Example (after impact, offset +1s, symmetric marches):
        </p>
        <ul className="list-disc ml-5">
          <li>
            Now 19:00:00, rally 3:00, opponent march 0:30, our march 0:30,
            offset +1s → opponent hits <code>19:03:30</code>, send at{" "}
            <code>19:03:01</code>.
          </li>
        </ul>
      </div>
    </div>
  );
}

// =========================
// App container with tabs
// =========================
export default function App() {
  const [tab, setTab] = useState<"setup" | "planner" | "reinforce">("setup");

  const [setup, setSetup] = useState<SetupData>(() => {
    if (typeof window === "undefined") {
      return { targetLabel: "", members: [] };
    }
    try {
      const raw = window.localStorage.getItem("kingshot_setup_v1");
      if (raw) {
        return JSON.parse(raw) as SetupData;
      }
    } catch {
      // ignore parse errors
    }
    return { targetLabel: "", members: [] };
  });

  
  // persist to localStorage on every change
  React.useEffect(() => {
    try {
      window.localStorage.setItem("kingshot_setup_v1", JSON.stringify(setup));
    } catch {
      // ignore write errors
    }
  }, [setup]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("setup")}
            className={`px-4 py-2 rounded-xl ${
              tab === "setup" ? "bg-indigo-600 text-white" : "bg-white"
            }`}
          >
            Setup
          </button>
          <button
            onClick={() => setTab("planner")}
            className={`px-4 py-2 rounded-xl ${
              tab === "planner" ? "bg-indigo-600 text-white" : "bg-white"
            }`}
          >
            Rally Planner
          </button>
          <button
            onClick={() => setTab("reinforce")}
            className={`px-4 py-2 rounded-xl ${
              tab === "reinforce" ? "bg-indigo-600 text-white" : "bg-white"
            }`}
          >
            Reinforcement Tool
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow p-6">
        <div style={{ display: tab === "setup" ? "block" : "none" }}>
        <SetupPage setup={setup} setSetup={setSetup} />
        </div>
        <div style={{ display: tab === "planner" ? "block" : "none" }}>
        <RallyTimingPlannerPage setup={setup} />
        </div>
        <div style={{ display: tab === "reinforce" ? "block" : "none" }}>
        <ReinforcementTimingToolPage setup={setup} />
        </div>
        </div>

      </div>
    </div>
  );
}

