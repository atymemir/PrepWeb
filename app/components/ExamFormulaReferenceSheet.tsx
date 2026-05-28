'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SAT_FORMULAS } from "../data/satMathTools";

type ExamFormulaReferenceSheetProps = {
  open: boolean;
  onClose: () => void;
};

export default function ExamFormulaReferenceSheet({
  open,
  onClose,
}: ExamFormulaReferenceSheetProps) {
  const [portalReady, setPortalReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setPortalReady(true);
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || isDesktop) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open, isDesktop]);

  if (!portalReady) return null;

  const panel = (
    <>
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#004aad]">
              Reference
            </div>
            <div className="mt-1 text-sm font-semibold text-black">SAT Math Formulas</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid gap-2 p-4">
        {SAT_FORMULAS.map((item) => (
          <div key={item.name} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#334155]">
              {item.name}
            </div>
            <div className="mt-1 text-sm font-semibold text-[#0f172a]">{item.formula}</div>
          </div>
        ))}
      </div>
    </>
  );

  return createPortal(
    <>
      {!isDesktop && (
        <div className="pointer-events-none fixed inset-0 z-[64]">
          <button
            type="button"
            aria-label="Close formula reference"
            className={[
              "absolute inset-0 transition",
              open ? "pointer-events-auto bg-black/30 opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={onClose}
          />
          <aside
            className={[
              "absolute bottom-0 left-0 right-0 h-[72vh] overflow-y-auto rounded-t-3xl border border-gray-200 bg-white shadow-2xl transition",
              open
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "translate-y-full opacity-0",
            ].join(" ")}
            aria-hidden={!open}
          >
            {panel}
          </aside>
        </div>
      )}

      {isDesktop && (
        <aside
          className={[
            "fixed right-5 top-[5.25rem] z-[64] max-h-[76vh] w-[23rem] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl transition",
            open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
          ].join(" ")}
          aria-hidden={!open}
        >
          {panel}
        </aside>
      )}
    </>,
    document.body
  );
}
