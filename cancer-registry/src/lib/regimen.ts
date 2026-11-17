import { DrugRow, newId } from "@/lib/rowOverrides";

const DOSE_PATTERN = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|gr|ml|cc|iu|unit)\b/i;

// Real regimen entries embed the dose in the drug text itself (e.g.
// "Doxorubicin 35 mg selesai"). Pull the dose out into its own field and
// leave the rest (drug name plus any trailing notes) as the name.
function parseDrugDose(text: string): { nama: string; dosis: string } {
  const match = text.match(DOSE_PATTERN);
  if (!match || match.index === undefined) {
    return { nama: text.trim(), dosis: "" };
  }
  const dosis = match[0].replace(/\s+/g, " ").trim();
  const nama = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .trim();
  return { nama, dosis };
}

// The free-text "Regimen Kemoterapi" cell of the older sheets.
export function splitRegimen(regimen: string): DrugRow[] {
  const trimmed = regimen.trim();
  if (!trimmed) return [];

  // Real regimen text tends to look like "Doxorubicin 34mg (H1)Vincristin 1,5mg
  // (H1)..." — one entry per drug, each ending in a "(H..)" cycle marker and no
  // separator before the next drug name. Splitting on ")" keeps each drug's
  // name/dose/cycle together without breaking decimal commas (e.g. "1,5mg").
  const parts = /\)/.test(trimmed)
    ? trimmed
        .split(/\)(?!\s*$)/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (p.endsWith(")") ? p : `${p})`))
    : trimmed
        .split(/[\n;]+|\s+\+\s+/)
        .map((p) => p.trim())
        .filter(Boolean);

  if (!parts.length) return [];
  return parts.map((part) => ({ id: newId(), ...parseDrugDose(part) }));
}

// The sheet's Siklus column is a free-text blurb ("LINI I (16 Siklus),"
// or "...Lini 1 Siklus 12 dengan..."). Pull out just the cycle count so the
// field reads as a plain "Siklus N".
export function parseSiklusCount(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const after = trimmed.match(/siklus\s*(\d+)/i);
  if (after) return `Siklus ${after[1]}`;
  const before = trimmed.match(/(\d+)\s*siklus/i);
  if (before) return `Siklus ${before[1]}`;
  return trimmed;
}

const TRAILING_DOSE = /^(.*\S)\s+(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|gr|ml|cc|iu|unit))$/i;

// The tidied sheets keep one drug per line. Only a dose at the very end of a
// line is split off, so writing the list back gives the same text.
export function drugsFromLines(text: string): DrugRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(TRAILING_DOSE);
      return { id: newId(), nama: m ? m[1] : line, dosis: m ? m[2] : "" };
    });
}

export function drugsToLines(drugs: DrugRow[]): string {
  return drugs
    .map((d) => [d.nama.trim(), d.dosis.trim()].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n");
}
