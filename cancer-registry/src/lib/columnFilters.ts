export type ColumnType = "text" | "number" | "date";

export type FilterOperator =
  | "contains"
  | "not_contains"
  | "is"
  | "is_not"
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "on"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after";

export type ColumnFilter = {
  type: ColumnType;
  operator: FilterOperator;
  value: string;
};

export const OPERATORS_BY_TYPE: Record<
  ColumnType,
  Array<{ value: FilterOperator; label: string }>
> = {
  text: [
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Does not contain" },
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
  ],
  date: [
    { value: "on", label: "On" },
    { value: "before", label: "Before" },
    { value: "after", label: "After" },
    { value: "on_or_before", label: "On or before" },
    { value: "on_or_after", label: "On or after" },
  ],
};

const NUMBER_RE = /^-?\d+([.,]\d+)?$/;

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!NUMBER_RE.test(trimmed)) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const DATE_PATTERNS: Array<{
  re: RegExp;
  toTimestamp: (m: RegExpMatchArray) => number | null;
}> = [
  {
    // yyyy-mm-dd
    re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    toTimestamp: (m) => Date.UTC(+m[1], +m[2] - 1, +m[3]),
  },
  {
    // dd/mm/yyyy or dd-mm-yyyy
    re: /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
    toTimestamp: (m) => Date.UTC(+m[3], +m[2] - 1, +m[1]),
  },
];

function parseDate(raw: string): number | null {
  const trimmed = raw.trim();
  for (const { re, toTimestamp } of DATE_PATTERNS) {
    const m = trimmed.match(re);
    if (m) {
      const ts = toTimestamp(m);
      return ts !== null && Number.isFinite(ts) ? ts : null;
    }
  }
  return null;
}

/** Samples non-empty values to guess whether a column is numeric, a date, or free text. */
export function inferColumnType(values: string[]): ColumnType {
  const sample = values.filter((v) => v.trim() !== "").slice(0, 50);
  if (sample.length === 0) return "text";

  const numberRatio = sample.filter((v) => parseNumber(v) !== null).length / sample.length;
  const dateRatio = sample.filter((v) => parseDate(v) !== null).length / sample.length;

  if (dateRatio >= 0.8) return "date";
  if (numberRatio >= 0.8) return "number";
  return "text";
}

export function matchesColumnFilter(cellValue: string, filter: ColumnFilter): boolean {
  const cell = cellValue ?? "";
  const target = filter.value.trim();
  if (!target) return true;

  if (filter.type === "text") {
    const hay = cell.toLowerCase();
    const needle = target.toLowerCase();
    switch (filter.operator) {
      case "contains":
        return hay.includes(needle);
      case "not_contains":
        return !hay.includes(needle);
      case "is":
        return hay === needle;
      case "is_not":
        return hay !== needle;
      default:
        return true;
    }
  }

  if (filter.type === "number") {
    const cellNum = parseNumber(cell);
    const targetNum = parseNumber(target);
    if (cellNum === null || targetNum === null) return false;
    switch (filter.operator) {
      case "eq":
        return cellNum === targetNum;
      case "neq":
        return cellNum !== targetNum;
      case "lt":
        return cellNum < targetNum;
      case "lte":
        return cellNum <= targetNum;
      case "gt":
        return cellNum > targetNum;
      case "gte":
        return cellNum >= targetNum;
      default:
        return true;
    }
  }

  // date
  const cellTs = parseDate(cell);
  const targetTs = parseDate(target);
  if (cellTs === null || targetTs === null) return false;
  switch (filter.operator) {
    case "on":
      return cellTs === targetTs;
    case "before":
      return cellTs < targetTs;
    case "after":
      return cellTs > targetTs;
    case "on_or_before":
      return cellTs <= targetTs;
    case "on_or_after":
      return cellTs >= targetTs;
    default:
      return true;
  }
}

export function defaultOperatorForType(type: ColumnType): FilterOperator {
  return OPERATORS_BY_TYPE[type][0].value;
}

export function operatorLabel(filter: ColumnFilter): string {
  return (
    OPERATORS_BY_TYPE[filter.type].find((o) => o.value === filter.operator)?.label ??
    filter.operator
  );
}

export type FilterRule = ColumnFilter & { id: string; column: string };

export type FilterCombinator = "AND" | "OR";

/** Rules with no value are treated as not-yet-configured and ignored. */
export function activeRules(rules: FilterRule[]): FilterRule[] {
  return rules.filter((r) => r.value.trim() !== "");
}

export function matchesRules(
  row: Record<string, string>,
  rules: FilterRule[],
  combinator: FilterCombinator,
): boolean {
  const active = activeRules(rules);
  if (active.length === 0) return true;
  const results = active.map((r) => matchesColumnFilter(row[r.column] ?? "", r));
  return combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
}
