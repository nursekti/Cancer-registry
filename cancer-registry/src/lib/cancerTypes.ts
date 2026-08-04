import { getLocalStorageItem, setLocalStorageItem } from "@/lib/storage";

export type CancerTypeConfig = {
  id: string;
  label: string;
  description?: string;
  csvUrl: string;
};

export const LS_CANCER_TYPES = "cr_cancer_types";

const DEFAULT_CANCER_TYPES: CancerTypeConfig[] = [
  {
    id: "HL",
    label: "HL",
    description: "Hodgkin Lymphoma",
    csvUrl:
      "https://docs.google.com/spreadsheets/d/10tlI23LbJ4hiAZpeSygoxqtCu-XQrfxVLhgp7iqwkZc/edit?gid=188215245#gid=188215245",
  },
  {
    id: "NHL",
    label: "NHL",
    description: "Non-Hodgkin Lymphoma",
    csvUrl:
      "https://docs.google.com/spreadsheets/d/10tlI23LbJ4hiAZpeSygoxqtCu-XQrfxVLhgp7iqwkZc/edit?gid=0#gid=0",
  },
];

export function loadCancerTypes(): CancerTypeConfig[] {
  const raw = getLocalStorageItem(LS_CANCER_TYPES);
  if (!raw) return DEFAULT_CANCER_TYPES;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CancerTypeConfig[]) : DEFAULT_CANCER_TYPES;
  } catch {
    return DEFAULT_CANCER_TYPES;
  }
}

function saveCancerTypes(list: CancerTypeConfig[]): void {
  setLocalStorageItem(LS_CANCER_TYPES, JSON.stringify(list));
}

function slugifyId(label: string): string {
  const base = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "TYPE";
}

export function addCancerType(input: {
  label: string;
  description?: string;
  csvUrl?: string;
}): CancerTypeConfig {
  const list = loadCancerTypes();
  const existingIds = new Set(list.map((t) => t.id));
  let id = slugifyId(input.label);
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${slugifyId(input.label)}_${suffix}`;
    suffix += 1;
  }
  const config: CancerTypeConfig = {
    id,
    label: input.label.trim(),
    description: input.description?.trim() || undefined,
    csvUrl: input.csvUrl?.trim() || "",
  };
  saveCancerTypes([...list, config]);
  return config;
}

export function deleteCancerType(id: string): void {
  saveCancerTypes(loadCancerTypes().filter((t) => t.id !== id));
}

export function updateCancerTypeCsvUrl(id: string, csvUrl: string): void {
  saveCancerTypes(
    loadCancerTypes().map((t) => (t.id === id ? { ...t, csvUrl } : t)),
  );
}
