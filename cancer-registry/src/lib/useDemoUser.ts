"use client";

import * as React from "react";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";

const LS_KEY = "cr_demo_auth";

export type DemoUser = { username: string };

export function useDemoUser(): DemoUser | null {
  const raw = useLocalStorageValue(LS_KEY);
  return React.useMemo(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "username" in parsed &&
        typeof (parsed as { username?: unknown }).username === "string"
      ) {
        return { username: (parsed as { username: string }).username };
      }
      return null;
    } catch {
      return null;
    }
  }, [raw]);
}

