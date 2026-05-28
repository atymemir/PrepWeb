'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

export type DesmosSessionState = string | null;

export type DesktopWindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FloatingDesmosCalculatorProps = {
  active: boolean;
  open: boolean;
  minimized: boolean;
  topicHint?: string | null;
  desktopRect: DesktopWindowRect;
  onDesktopRectChange: (next: DesktopWindowRect) => void;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  sessionState: DesmosSessionState;
  onSessionStateChange: (next: DesmosSessionState) => void;
};

type DesmosGraphingCalculator = {
  setExpressions: (expressions: Array<{ id?: string; latex?: string }>) => void;
  getState: () => unknown;
  setState: (state: unknown, options?: { allowUndo?: boolean }) => void;
  resize?: () => void;
  observeEvent: (
    event: "change",
    callback: (eventName: string, event: { isUserInitiated?: boolean }) => void
  ) => void;
  unobserveEvent: (event: "change") => void;
  destroy?: () => void;
};

type DesmosGlobal = {
  GraphingCalculator: (
    element: HTMLElement,
    options?: Record<string, unknown>
  ) => DesmosGraphingCalculator;
};

type WindowWithDesmos = Window &
  typeof globalThis & {
    Desmos?: DesmosGlobal;
    __algaDesmosScriptPromise?: Promise<void>;
  };

type ApiMode = "pending" | "ready" | "fallback";

function clampRectToViewport(rect: DesktopWindowRect): DesktopWindowRect {
  if (typeof window === "undefined") return rect;

  const maxWidth = Math.max(420, window.innerWidth - 24);
  const maxHeight = Math.max(300, window.innerHeight - 120);
  const width = Math.min(Math.max(rect.width, 420), maxWidth);
  const height = Math.min(Math.max(rect.height, 300), maxHeight);

  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(80, window.innerHeight - height - 12);

  return {
    x: Math.min(Math.max(rect.x, 12), maxX),
    y: Math.min(Math.max(rect.y, 80), maxY),
    width,
    height,
  };
}

function topicStarterExpressions(topicHint?: string | null): string[] {
  const t = (topicHint || "").toLowerCase();
  if (/(linear|system|slope|line|intercept)/.test(t)) return ["y = mx + b", "y = ax + c"];
  if (/(quadratic|polynomial|parabola|roots?)/.test(t)) return ["y = ax^2 + bx + c", "y = 0"];
  if (/(circle|radius)/.test(t)) return ["(x - h)^2 + (y - k)^2 = r^2"];
  if (/(geometry|triangle|trig|angle)/.test(t)) return ["y = tan(theta)x", "x^2 + y^2 = r^2"];
  if (/(percent|ratio|probability|data|statistics|rate)/.test(t)) return ["y = kx", "y = a(1 + r)^x"];
  return ["y = f(x)", "y = g(x)"];
}

async function copyToClipboard(raw: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(raw);
    return true;
  } catch {
    return false;
  }
}

function loadDesmosScript(apiKey: string): Promise<void> {
  const w = window as WindowWithDesmos;
  if (w.Desmos) return Promise.resolve();
  if (w.__algaDesmosScriptPromise) return w.__algaDesmosScriptPromise;

  const src = `https://www.desmos.com/api/v1.12/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;

  w.__algaDesmosScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Desmos script failed to load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Desmos script failed to load."));
    document.head.appendChild(script);
  });

  return w.__algaDesmosScriptPromise;
}

export default function FloatingDesmosCalculator({
  active,
  open,
  minimized,
  topicHint,
  desktopRect,
  onDesktopRectChange,
  onClose,
  onMinimize,
  onRestore,
  sessionState,
  onSessionStateChange,
}: FloatingDesmosCalculatorProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const calculatorRef = useRef<DesmosGraphingCalculator | null>(null);
  const activeResizeObserverRef = useRef<ResizeObserver | null>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const latestRectRef = useRef<DesktopWindowRect>(desktopRect);
  const lastStarterSignatureRef = useRef<string>("");

  const [portalReady, setPortalReady] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailure, setScriptFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [expressionDrafts, setExpressionDrafts] = useState<string[]>(() =>
    topicStarterExpressions(topicHint)
  );

  const apiKey = process.env.NEXT_PUBLIC_DESMOS_API_KEY || "";
  const starterExpressions = useMemo(() => topicStarterExpressions(topicHint), [topicHint]);
  const starterSignature = starterExpressions.join("|");
  const fallbackHref = "https://www.desmos.com/calculator?embed&showGrid=true&showXAxis=true&showYAxis=true";

  const apiMode: ApiMode =
    !apiKey || scriptFailure ? "fallback" : scriptReady ? "ready" : "pending";
  const fallbackReason = !apiKey
    ? "Missing NEXT_PUBLIC_DESMOS_API_KEY. Using embedded calculator fallback."
    : scriptFailure;

  const visiblePanel = active && open && !minimized;
  const showMinimizedPill = active && open && minimized;
  const showMobileSheet = visiblePanel && !isDesktop;

  useEffect(() => {
    setPortalReady(true);
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    latestRectRef.current = desktopRect;
  }, [desktopRect]);

  useEffect(() => {
    if (sessionState) return;
    if (lastStarterSignatureRef.current === starterSignature) return;
    setExpressionDrafts(starterExpressions);
    lastStarterSignatureRef.current = starterSignature;
  }, [sessionState, starterExpressions, starterSignature]);

  const persistCalculatorState = useCallback(() => {
    const calculator = calculatorRef.current;
    if (!calculator) return;
    try {
      const raw = JSON.stringify(calculator.getState());
      onSessionStateChange(raw);
    } catch {
      // keep study flow resilient
    }
  }, [onSessionStateChange]);

  const applyExpressionDrafts = useCallback(
    (target: string[]) => {
      const calculator = calculatorRef.current;
      if (!calculator) return;
      const payload = target
        .map((latex, index) => ({ id: `starter-${index + 1}`, latex: latex.trim() }))
        .filter((row) => row.latex.length > 0);
      if (!payload.length) return;
      calculator.setExpressions(payload);
      persistCalculatorState();
    },
    [persistCalculatorState]
  );

  const teardownCalculator = useCallback(() => {
    const calculator = calculatorRef.current;
    if (!calculator) return;
    try {
      persistCalculatorState();
      calculator.unobserveEvent("change");
    } catch {
      // keep cleanup safe
    }
    try {
      calculator.destroy?.();
    } catch {
      // keep cleanup safe
    }
    calculatorRef.current = null;
  }, [persistCalculatorState]);

  useEffect(() => {
    if (!active || !apiKey || scriptReady) return;

    let cancelled = false;
    void loadDesmosScript(apiKey)
      .then(() => {
        if (cancelled) return;
        setScriptReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setScriptFailure(
          err instanceof Error ? err.message : "Could not initialize Desmos API."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [active, apiKey, scriptReady]);

  useEffect(() => {
    if (!active) return;
    if (apiMode !== "ready") return;
    if (!graphRef.current) return;
    if (calculatorRef.current) return;

    const w = window as WindowWithDesmos;
    if (!w.Desmos) return;

    const calculator = w.Desmos.GraphingCalculator(graphRef.current, {
      expressions: true,
      keypad: true,
      settingsMenu: false,
      zoomButtons: true,
    });
    calculatorRef.current = calculator;

    try {
      if (sessionState) {
        calculator.setState(JSON.parse(sessionState), { allowUndo: true });
      } else {
        const initialPayload = expressionDrafts
          .map((latex, index) => ({ id: `starter-${index + 1}`, latex: latex.trim() }))
          .filter((row) => row.latex.length > 0);
        if (initialPayload.length) {
          calculator.setExpressions(initialPayload);
        }
        persistCalculatorState();
      }
    } catch {
      const initialPayload = expressionDrafts
        .map((latex, index) => ({ id: `starter-${index + 1}`, latex: latex.trim() }))
        .filter((row) => row.latex.length > 0);
      if (initialPayload.length) {
        calculator.setExpressions(initialPayload);
      }
      persistCalculatorState();
    }

    calculator.observeEvent("change", (_eventName, event) => {
      if (event?.isUserInitiated === false) return;
      persistCalculatorState();
    });

  }, [active, apiMode, expressionDrafts, persistCalculatorState, sessionState]);

  useEffect(() => {
    if (active) return;
    teardownCalculator();
  }, [active, teardownCalculator]);

  useEffect(
    () => () => {
      teardownCalculator();
    },
    [teardownCalculator]
  );

  useEffect(() => {
    if (!active) return;
    if (!visiblePanel) return;
    const calculator = calculatorRef.current;
    if (!calculator || !calculator.resize) return;
    const timer = window.setTimeout(() => {
      calculator.resize?.();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [active, visiblePanel, isDesktop]);

  useEffect(() => {
    if (!active || !isDesktop || !panelRef.current) return;
    const node = panelRef.current;
    if (activeResizeObserverRef.current) {
      activeResizeObserverRef.current.disconnect();
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const roundedWidth = Math.round(width);
      const roundedHeight = Math.round(height);
      const prev = latestRectRef.current;
      if (prev.width === roundedWidth && prev.height === roundedHeight) return;

      const next = clampRectToViewport({
        ...prev,
        width: roundedWidth,
        height: roundedHeight,
      });
      onDesktopRectChange(next);
      calculatorRef.current?.resize?.();
    });

    observer.observe(node);
    activeResizeObserverRef.current = observer;
    return () => observer.disconnect();
  }, [active, isDesktop, onDesktopRectChange]);

  useEffect(() => {
    if (!active || !isDesktop) return;
    const next = clampRectToViewport(desktopRect);
    if (
      next.x !== desktopRect.x ||
      next.y !== desktopRect.y ||
      next.width !== desktopRect.width ||
      next.height !== desktopRect.height
    ) {
      onDesktopRectChange(next);
    }
  }, [active, desktopRect, isDesktop, onDesktopRectChange]);

  useEffect(() => {
    if (!active || !isDesktop) return;
    const onWindowResize = () => {
      onDesktopRectChange(clampRectToViewport(latestRectRef.current));
      calculatorRef.current?.resize?.();
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [active, isDesktop, onDesktopRectChange]);

  useEffect(() => {
    if (!showMobileSheet) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
    };
  }, [showMobileSheet]);

  const handleDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDesktop || !visiblePanel) return;
      dragRef.current = {
        offsetX: event.clientX - latestRectRef.current.x,
        offsetY: event.clientY - latestRectRef.current.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [isDesktop, visiblePanel]
  );

  const handleDragMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDesktop || !visiblePanel) return;
      if (!dragRef.current) return;

      const next = clampRectToViewport({
        ...latestRectRef.current,
        x: event.clientX - dragRef.current.offsetX,
        y: event.clientY - dragRef.current.offsetY,
      });
      onDesktopRectChange(next);
    },
    [isDesktop, onDesktopRectChange, visiblePanel]
  );

  const handleDragEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }
    },
    [isDesktop]
  );

  if (!portalReady || !active) return null;

  const shell = (
    <>
      <div
        className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 py-2"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#004aad]">
            Calculator
          </div>
          <div className="text-xs text-gray-600">Bluebook-style utility</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMinimize}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
          >
            Min
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid gap-2 border-b border-gray-200 bg-[#f8fbff] px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
          Starter expressions
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {starterExpressions.map((expr) => (
            <button
              key={expr}
              type="button"
              onClick={() =>
                setExpressionDrafts((prev) =>
                  [expr, ...prev.filter((item) => item !== expr)].slice(0, 4)
                )
              }
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {expr}
            </button>
          ))}
        </div>
      </div>

      {apiMode === "ready" ? (
        <div className="grid h-[calc(100%-132px)] min-h-[280px]">
          <div ref={graphRef} className="h-full w-full" />
        </div>
      ) : (
        <div className="grid gap-3 px-3 py-3">
          <div className="rounded-lg border border-[#c7dbff] bg-[#f6faff] px-3 py-2 text-xs text-[#0f1b33]">
            {fallbackReason || "Desmos API is unavailable. Embedded calculator fallback active."}
          </div>
          <div className="grid gap-2">
            {expressionDrafts.slice(0, 4).map((expr, index) => (
              <input
                key={index}
                value={expr}
                onChange={(event) =>
                  setExpressionDrafts((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item
                    )
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#0f172a]"
                aria-label={`Expression ${index + 1}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(expressionDrafts.join("\n"));
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1200);
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
            >
              {copied ? "Copied" : "Copy expressions"}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <iframe
              title="Desmos graphing calculator"
              src={fallbackHref}
              className="h-[340px] w-full"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {apiMode === "ready" && (
        <div className="border-t border-gray-200 bg-[#f8fbff] px-3 py-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <button
              type="button"
              onClick={() => applyExpressionDrafts(expressionDrafts)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
            >
              Load starters
            </button>
            <button
              type="button"
              onClick={persistCalculatorState}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
            >
              Save memory
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(expressionDrafts.join("\n"));
                setCopied(ok);
                window.setTimeout(() => setCopied(false), 1200);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
            >
              {copied ? "Copied" : "Copy starters"}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(
    <>
      {showMinimizedPill && (
        <div className="fixed bottom-20 right-4 z-[65] md:bottom-6 md:right-6">
          <div className="rounded-full border border-[#0e1b34] bg-[#0e1b34] px-3 py-2 text-xs font-semibold text-white shadow-xl">
            <button type="button" onClick={onRestore} className="mr-2 underline">
              Restore calculator
            </button>
            <button type="button" onClick={onClose} className="text-[#cfdcf6]">
              Close
            </button>
          </div>
        </div>
      )}

      {!isDesktop && (
        <div
          className={[
            "fixed inset-0 z-[65]",
            showMobileSheet ? "" : "pointer-events-none",
          ].join(" ")}
        >
          <button
            type="button"
            aria-label="Close calculator"
            className={[
              "absolute inset-0 transition",
              showMobileSheet ? "bg-black/30 opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
            onClick={onClose}
          />
          <aside
            className={[
              "absolute bottom-0 left-0 right-0 h-[76vh] overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl transition",
              showMobileSheet
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-full opacity-0",
            ].join(" ")}
          >
            {shell}
          </aside>
        </div>
      )}

      {isDesktop && (
        <div
          ref={panelRef}
          className={[
            "fixed z-[65] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition",
            visiblePanel ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          style={{
            left: desktopRect.x,
            top: desktopRect.y,
            width: desktopRect.width,
            height: desktopRect.height,
            resize: "both",
            minWidth: 420,
            minHeight: 300,
          }}
        >
          {shell}
        </div>
      )}
    </>,
    document.body
  );
}
