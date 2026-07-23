import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/storage";

type Row = Record<string, string>;
export type CancerTypeId = "HL" | "NHL";

function storageKey(cancerType: CancerTypeId): string {
  return `cr_added_rows_${cancerType}`;
}

export function loadAddedRows(cancerType: CancerTypeId): Row[] {
  const raw = getLocalStorageItem(storageKey(cancerType));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Row[]) : [];
  } catch {
    return [];
  }
}

export function addRow(cancerType: CancerTypeId, row: Row): void {
  const rows = loadAddedRows(cancerType);
  rows.push(row);
  setLocalStorageItem(storageKey(cancerType), JSON.stringify(rows));
}

export const ADDED_ROWS_STORAGE_KEYS: Record<CancerTypeId, string> = {
  HL: storageKey("HL"),
  NHL: storageKey("NHL"),
};
