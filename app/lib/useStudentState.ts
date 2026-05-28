'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStudentState, type StudentState, type StudentStateFetchOptions } from "./studentState";

export type UseStudentStateResult = {
  state: StudentState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  ready: boolean;
};

export function useStudentState(options: StudentStateFetchOptions = {}): UseStudentStateResult {
  const [state, setState] = useState<StudentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stableOptions = useMemo(
    () => ({
      dueLimit: options.dueLimit,
      historyLimit: options.historyLimit,
    }),
    [options.dueLimit, options.historyLimit]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchStudentState(stableOptions);
      setState(next);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load student state.";
      setError(message);
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [stableOptions]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchStudentState(stableOptions);
        if (cancelled) return;
        setState(next);
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to load student state.";
        setError(message);
        setState(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [stableOptions]);

  return {
    state,
    loading,
    error,
    refresh,
    ready: !loading,
  };
}
