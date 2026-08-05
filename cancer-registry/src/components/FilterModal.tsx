"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  ColumnType,
  FilterCombinator,
  FilterOperator,
  FilterRule,
  OPERATORS_BY_TYPE,
  defaultOperatorForType,
} from "@/lib/columnFilters";

const fieldClass =
  "h-10 rounded-lg bg-white px-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent-500";

function makeRule(id: string, column: string, type: ColumnType): FilterRule {
  return { id, column, type, operator: defaultOperatorForType(type), value: "" };
}

export function FilterModal({
  headers,
  columnTypes,
  rules,
  combinator,
  onApply,
  onClose,
}: {
  headers: string[];
  columnTypes: Record<string, ColumnType>;
  rules: FilterRule[];
  combinator: FilterCombinator;
  onApply: (rules: FilterRule[], combinator: FilterCombinator) => void;
  onClose: () => void;
}) {
  const idRef = React.useRef(0);
  function nextId() {
    idRef.current += 1;
    return `f${idRef.current}`;
  }

  const [draftRules, setDraftRules] = React.useState<FilterRule[]>(() => {
    if (rules.length) return rules;
    if (!headers.length) return [];
    // Seed with a literal id (not the ref-backed counter, which must not be read during render).
    return [makeRule("f0", headers[0], columnTypes[headers[0]] ?? "text")];
  });
  const [draftCombinator, setDraftCombinator] = React.useState<FilterCombinator>(combinator);

  function addRule() {
    if (!headers.length) return;
    const column = headers[0];
    setDraftRules((prev) => [...prev, makeRule(nextId(), column, columnTypes[column] ?? "text")]);
  }

  function updateColumn(id: string, column: string) {
    const type = columnTypes[column] ?? "text";
    setDraftRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, column, type, operator: defaultOperatorForType(type), value: "" } : r,
      ),
    );
  }

  function updateOperator(id: string, operator: FilterOperator) {
    setDraftRules((prev) => prev.map((r) => (r.id === id ? { ...r, operator } : r)));
  }

  function updateValue(id: string, value: string) {
    setDraftRules((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  }

  function removeRule(id: string) {
    setDraftRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div
      className="fixed inset-0 z-20 bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Filter records</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              Build one or more conditions to narrow down the table.
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 p-6">
          {draftRules.length > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-600">Match</span>
              <div className="inline-flex rounded-lg p-0.5 ring-1 ring-inset ring-zinc-200">
                <button
                  type="button"
                  onClick={() => setDraftCombinator("AND")}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    draftCombinator === "AND"
                      ? "bg-primary-700 text-white"
                      : "text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  All (AND)
                </button>
                <button
                  type="button"
                  onClick={() => setDraftCombinator("OR")}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    draftCombinator === "OR"
                      ? "bg-primary-700 text-white"
                      : "text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  Any (OR)
                </button>
              </div>
              <span className="text-zinc-600">of the following</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5">
            {draftRules.map((rule, idx) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-semibold uppercase text-zinc-400">
                  {idx === 0 ? "Where" : draftCombinator}
                </span>
                <select
                  value={rule.column}
                  onChange={(e) => updateColumn(rule.id, e.target.value)}
                  className={cn(fieldClass, "min-w-[140px] flex-1")}
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateOperator(rule.id, e.target.value as FilterOperator)}
                  className={cn(fieldClass, "w-40 shrink-0")}
                >
                  {OPERATORS_BY_TYPE[rule.type].map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <input
                  type={rule.type === "number" ? "number" : rule.type === "date" ? "date" : "text"}
                  value={rule.value}
                  onChange={(e) => updateValue(rule.id, e.target.value)}
                  placeholder="Value"
                  className={cn(fieldClass, "min-w-[120px] flex-1")}
                />
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  className="shrink-0 text-zinc-400 hover:text-zinc-600"
                  aria-label="Remove condition"
                >
                  &times;
                </button>
              </div>
            ))}
            {draftRules.length === 0 ? (
              <p className="text-sm text-zinc-500">No conditions yet.</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={addRule}
            disabled={!headers.length}
            className="text-sm font-medium text-primary-700 hover:text-primary-600 disabled:text-zinc-400"
          >
            + Add condition
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={() => setDraftRules([])}
            className="mr-auto text-xs font-medium text-zinc-500 hover:text-zinc-700"
          >
            Clear all
          </button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(draftRules, draftCombinator);
              onClose();
            }}
          >
            Apply filters
          </Button>
        </div>
      </div>
    </div>
  );
}
