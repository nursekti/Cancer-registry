import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/storage";

type Row = Record<string, string>;
export type CancerTypeId = string;

export function addedRowsStorageKey(cancerType: CancerTypeId): string {
  return `cr_added_rows_${cancerType}`;
}

export function loadAddedRows(cancerType: CancerTypeId): Row[] {
  const raw = getLocalStorageItem(addedRowsStorageKey(cancerType));
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
  rows.unshift(row);
  setLocalStorageItem(addedRowsStorageKey(cancerType), JSON.stringify(rows));
}
