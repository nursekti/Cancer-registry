import { getLocalStorageItem, setLocalStorageItem } from "@/lib/storage";

export type CancerTypeConfig = {
  id: string;
  label: string;
  description?: string;
  csvUrl: string;
};

export const LS_CANCER_TYPES = "cr_cancer_types";

const SPREADSHEET_ID = "10tlI23LbJ4hiAZpeSygoxqtCu-XQrfxVLhgp7iqwkZc";
const sheetUrl = (gid: number) =>
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=${gid}#gid=${gid}`;
// The tidied "Data NHL/HL - Post Processing" tabs the web app reads and writes.
const POST_PROCESSING_URL: Record<string, string> = {
  NHL: sheetUrl(803887597),
  HL: sheetUrl(374219075),
};
// The original tabs they were built from (DATA NHL, DATA HL).
const ORIGINAL_GID: Record<string, number> = { NHL: 0, HL: 188215245 };

const DEFAULT_CANCER_TYPES: CancerTypeConfig[] = [
  {
    id: "HL",
    label: "HL",
    description: "Hodgkin Lymphoma",
    csvUrl: POST_PROCESSING_URL.HL,
  },
  {
    id: "NHL",
    label: "NHL",
    description: "Non-Hodgkin Lymphoma",
    csvUrl: POST_PROCESSING_URL.NHL,
  },
];

// NHL and HL now read and write their Post Processing tabs instead of DATA
// NHL / DATA HL; saved module lists still pointing at the original tabs are
// moved over.
function migrateToPostProcessing(list: CancerTypeConfig[]): CancerTypeConfig[] {
  return list.map((t) => {
    const gid = ORIGINAL_GID[t.id];
    const pointsAtOriginal =
      gid !== undefined &&
      t.csvUrl.includes(SPREADSHEET_ID) &&
      new RegExp(`[?#&]gid=${gid}\\b`).test(t.csvUrl);
    return pointsAtOriginal ? { ...t, csvUrl: POST_PROCESSING_URL[t.id] } : t;
  });
}

export function loadCancerTypes(): CancerTypeConfig[] {
  const raw = getLocalStorageItem(LS_CANCER_TYPES);
  if (!raw) return DEFAULT_CANCER_TYPES;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? migrateToPostProcessing(parsed as CancerTypeConfig[]) : DEFAULT_CANCER_TYPES;
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
