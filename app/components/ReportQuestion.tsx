'use client';

import { useState } from "react";
import { getSupabase } from "@/app/lib/supabase";

const REASONS = [
  "Wrong Answer",
  "Bad Explanation",
  "Ambiguous",
  "Formatting",
  "Missing Graph",
  "Duplicate",
  "Other",
] as const;

type Reason = (typeof REASONS)[number];

export default function ReportQuestion({
  questionId,
  source,
  subject,
  subskill,
}: {
  questionId: string;
  source: "PracticeWeb" | "ReviewWeb";
  subject?: string;
  subskill?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("Wrong Answer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submitReport() {
    setBusy(true);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);
      if (!sessionData.session) throw new Error("You need to sign in.");

      const userId = sessionData.session.user.id;

      const detailsParts = [
        `Reported from ${source}`,
        subject ? `Subject: ${subject}` : null,
        subskill ? `Subskill: ${subskill}` : null,
        note.trim() ? `Note: ${note.trim()}` : null,
      ].filter(Boolean);

      const { error } = await supabase.from("question_reports").insert({
        user_id: userId,
        question_id: questionId,
        reason,
        details: detailsParts.join(" | "),
      });

      if (error) throw new Error(error.message);

      setMsg("Report submitted.");
      setNote("");

      setTimeout(() => {
        setOpen(false);
        setMsg(null);
      }, 900);
    } catch (e: any) {
      setMsg(e?.message || "Failed to submit report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-gray-500 underline hover:text-black"
        >
          Report question
        </button>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-black">Report question</div>

          <div className="mt-3 grid gap-2">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name={`reason-${questionId}`}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                <span>{r}</span>
              </label>
            ))}
          </div>

          <textarea
            className="mt-3 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#004aad]"
            rows={3}
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {msg && (
            <div
              className={`mt-3 text-sm ${
                msg === "Report submitted." ? "text-green-700" : "text-red-600"
              }`}
            >
              {msg}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={submitReport}
              disabled={busy}
              className="rounded-lg bg-[#004aad] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003b88] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Submit"}
            </button>

            <button
              onClick={() => {
                setOpen(false);
                setMsg(null);
              }}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-black hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}