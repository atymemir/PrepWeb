'use client';

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useStudyFxPrefs } from "../lib/useStudyFxPrefs";

type StudyFeedbackFXProps = {
  active: boolean;
  variant?: "complete" | "recovery" | "correct";
  intensity?: "subtle" | "standard";
};

const COLORS = ["#8fc1ff", "#0e1b34", "#2a9b67", "#ff89a3", "#d8e7ff"];

function playTone(variant: StudyFeedbackFXProps["variant"]) {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(variant === "correct" ? 0.035 : 0.055, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    gain.connect(ctx.destination);

    const notes =
      variant === "recovery"
        ? [392, 523.25]
        : variant === "correct"
        ? [523.25]
        : [392, 493.88, 659.25];

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.055);
      osc.connect(gain);
      osc.start(now + index * 0.055);
      osc.stop(now + 0.24 + index * 0.055);
    });

    window.setTimeout(() => {
      void ctx.close();
    }, 520);
  } catch {
    // Audio is opportunistic; blocked autoplay should never affect studying.
  }
}

export default function StudyFeedbackFX({
  active,
  variant = "complete",
  intensity = "standard",
}: StudyFeedbackFXProps) {
  const prefs = useStudyFxPrefs();
  const [visible, setVisible] = useState(false);
  const pieces = useMemo(
    () =>
      Array.from({ length: intensity === "subtle" ? 18 : 30 }, (_, index) => ({
        id: index,
        left: 12 + ((index * 19) % 76),
        delay: (index % 7) * 42,
        color: COLORS[index % COLORS.length],
        rotate: (index * 37) % 180,
        drift: (index % 2 === 0 ? 1 : -1) * (18 + (index % 5) * 8),
      })),
    [intensity]
  );

  useEffect(() => {
    if (!active) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefs.soundEnabled) {
      playTone(variant);
    }
    if (!reducedMotion && prefs.motionEnabled) {
      const startTimer = window.setTimeout(() => {
        setVisible(true);
      }, 0);
      const endTimer = window.setTimeout(() => setVisible(false), 1100);
      return () => {
        window.clearTimeout(startTimer);
        window.clearTimeout(endTimer);
      };
    }
  }, [active, prefs.motionEnabled, prefs.soundEnabled, variant]);

  if (!visible) return null;

  return (
    <div className="study-fx-layer" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="study-fx-piece"
          style={
            {
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}ms`,
              transform: `rotate(${piece.rotate}deg)`,
              "--study-fx-drift": `${piece.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
