import { useMemo, useState } from "react";

/**
 * Simple Time Deduction UI
 * - Enter an initial time: Hours, Minutes, Seconds
 * - Enter a deduction: Minutes, Seconds (as requested)
 * - Click Calculate to see H:M:S result
 *
 * Styling: TailwindCSS classes (works fine even if Tailwind isn't present; it just renders unstyled)
 */
export default function TimeDeductionApp() {
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [seconds, setSeconds] = useState("0");

  const [deductMinutes, setDeductMinutes] = useState("0");
  const [deductSeconds, setDeductSeconds] = useState("0");

  const [result, setResult] = useState<{ h: number; m: number; s: number } | null>(null);
  const [note, setNote] = useState<string>("");

  const normalizeInt = (v: string) => {
    if (v.trim() === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };

  const zeroPad = (n: number) => String(n).padStart(2, "0");

  const totalInitialSeconds = useMemo(() => {
    const h = normalizeInt(hours);
    const m = normalizeInt(minutes);
    const s = normalizeInt(seconds);
    return h * 3600 + m * 60 + s;
  }, [hours, minutes, seconds]);

  const totalDeductSeconds = useMemo(() => {
    const dm = normalizeInt(deductMinutes);
    const ds = normalizeInt(deductSeconds);
    return dm * 60 + ds;
  }, [deductMinutes, deductSeconds]);

  const onCalculate = () => {
    let diff = totalInitialSeconds - totalDeductSeconds;
    let msg = "";

    if (diff < 0) {
      diff = 0; // Clamp to zero when deduction exceeds initial time
      msg = "Deduction exceeded initial time — clamped to 0:00:00.";
    }

    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;

    setResult({ h, m, s });
    setNote(msg);
  };

  const onReset = () => {
    setHours("0");
    setMinutes("0");
    setSeconds("0");
    setDeductMinutes("0");
    setDeductSeconds("0");
    setResult(null);
    setNote("");
  };

  const isCalculateDisabled = totalInitialSeconds === 0 || totalDeductSeconds === 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Rally timing</h1>
        <p className="text-slate-600 mb-6">Enter the rally target time, then a march time in minutes and seconds. Click Calculate to see the exact time you need to start your rally.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Initial Time Inputs */}
          <section className="space-y-3">
            <h2 className="font-medium text-slate-800">Target rally time</h2>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-slate-600">Hours</span>
                <input
                  inputMode="numeric"
                  aria-label="Initial hours"
                  className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-slate-600">Minutes</span>
                <input
                  inputMode="numeric"
                  aria-label="Initial minutes"
                  className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-slate-600">Seconds</span>
                <input
                  inputMode="numeric"
                  aria-label="Initial seconds"
                  className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
          </section>

          {/* Deduction Inputs */}
          <section className="space-y-3">
            <h2 className="font-medium text-slate-800">March time</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-slate-600">Minutes</span>
                <input
                  inputMode="numeric"
                  aria-label="Deduct minutes"
                  className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={deductMinutes}
                  onChange={(e) => setDeductMinutes(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-slate-600">Seconds</span>
                <input
                  inputMode="numeric"
                  aria-label="Deduct seconds"
                  className="border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={deductSeconds}
                  onChange={(e) => setDeductSeconds(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onCalculate}
            disabled={isCalculateDisabled}
            className={`px-4 py-2 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isCalculateDisabled ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
          >
            Calculate
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Reset
          </button>
        </div>

        {/* Result */}
        <div className="mt-6">
          <h3 className="text-sm uppercase tracking-wider text-slate-500">Start your rally at (H:M:S)</h3>
          <div className="text-3xl font-semibold mt-1">
            {result ? (
              <span>
                {result.h}:{zeroPad(result.m)}:{zeroPad(result.s)}
              </span>
            ) : (
              <span className="text-slate-400">--:--:--</span>
            )}
          </div>
          {note && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3 text-sm">{note}</p>
          )}
        </div>

        {/* Helper summary */}
        
        {result && (
        <div className="mt-6 text-xs text-slate-500 space-y-3">
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <p className="mb-2 font-medium text-slate-700">How to use:</p>
            <img
              src="/rally_time.jpg"
              alt="Guide showing how to enter time and click calculate"
              className="rounded-lg shadow-sm w-full max-w-md mx-auto"
            />
            <p className="mt-2 text-slate-600 text-[0.8rem] text-center">
              Click deploy when the above time shows <strong>{result ? (
              <span>
                {result.h}:{zeroPad(result.m)}:{zeroPad(result.s)}
              </span>
            ) : (
              <span className="text-slate-400">--:--:--</span>
            )}</strong>.
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

