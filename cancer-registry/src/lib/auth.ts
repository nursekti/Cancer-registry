import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/storage";

const LS_KEY = "cr_demo_auth";

export type DemoUser = {
  username: string;
};

export function getDemoUser(): DemoUser | null {
  const raw = getLocalStorageItem(LS_KEY);
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
}

export function signInDemo(username: string): void {
  setLocalStorageItem(LS_KEY, JSON.stringify({ username }));
}

export function signOutDemo(): void {
  removeLocalStorageItem(LS_KEY);
  removeLocalStorageItem("cr_selected_cancer_type");
}

