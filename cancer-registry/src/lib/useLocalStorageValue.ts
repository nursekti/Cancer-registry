"use client";

import * as React from "react";

function subscribe(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.storageArea !== window.localStorage) return;
    callback();
  };
  const onCustom = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener("cr:localstorage", onCustom as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("cr:localstorage", onCustom as EventListener);
  };
}

export function useLocalStorageValue(key: string): string | null {
  return React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

