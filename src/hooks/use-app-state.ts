"use client";
import { useCallback, useEffect, useState } from "react";
import type { AppState } from "@/lib/types";

async function loadState(signal?: AbortSignal) {
  const response = await fetch("/api/state", { cache: "no-store", signal });
  if (!response.ok) throw new Error("load failed");
  return response.json() as Promise<AppState>;
}

export function useAppState() {
  const [data, setData] = useState<AppState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadState()); }
    catch { setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadState(controller.signal)
      .then(setData)
      .catch((reason: unknown) => { if ((reason as { name?: string }).name !== "AbortError") setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return { data, error, loading, refresh };
}
