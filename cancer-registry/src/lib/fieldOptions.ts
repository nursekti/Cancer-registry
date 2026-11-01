// Dropdown options, copied from the dropdowns defined in the sheet itself
// (DATA NHL / DATA HL). Kept verbatim — including stray leading spaces — so
// a value picked here is exactly what the sheet's dropdown expects.

type TypeOptions = { leader: string[]; subtipe: string[] };

const OPTIONS_BY_TYPE: Record<string, TypeOptions> = {
  NHL: {
    leader: ["BEDAH", "INTERNA", "ANAK", "THT", "SARAF", "PARU", "KULIT", "MATA"],
    subtipe: [
      "NHL - Diffuse Large B-Cell Lymphoma (DLBCL)",
      "NHL - Mantle cell lymphoma",
      "NHL - Lymphoblastic lymphoma",
      "NHL - Burkitt lymphoma",
      "NHL - Primary mediastinal (thymic) large B-cell lymphoma (PMBCL)",
      "NHL - Transformed follicular and transformed MALT lymphomas",
      "NHL - High-grade B-cell lymphoma with double or triple hits (HBL)",
      "NHL - Primary cutaneous DLBCL",
      "NHL - PCNSL",
      "NHL - Follicular lymphoma",
      "NHL - Marginal zone lymphoma (MZL)",
      "NHL - CLL/SLL",
      "NHL - mucosa-associated lymphoid tissue (MALT) lymphoma",
      "NHL - Lymphoplasmacytic lymphoma",
      "NHL - Waldenström macroglobulinemia",
      "NHL - Nodal marginal zone lymphoma (NMZL)",
      "NHL - Splenic marginal zone lymphoma (SMZL)",
      "NHL - Peripheral T-cell lymphoma",
      "not otherwise specified (PTCL-NOS)",
      "NHL - Systemic anaplastic large-cell lymphoma (ALCL)",
      "NHL - Hepatosplenic T-cell lymphoma",
      "NHL - Mycosis fungoides (MF)",
      "NHL - Enteropathy-associated intestinal T-cell lymphoma",
      "NHL - Angioimmunoblastic T-cell lymphoma (AITL)",
      "NHL - Extranodal natural killer (NK)/T-cell lymphoma (ENK/TCL) nasal type",
      " NHL - Primary cutaneous anaplastic large-cell lymphoma (pcALCL)",
      " NHL - Subcutaneous panniculitis-like T-cell lymphoma (SPTCL)",
      "NHL - T cell type unspecified",
      "NHL - B cell type unspecified",
      "NHL - unspecified",
      "NHL - extranodal marginal-zone B-cell NHL",
    ],
  },
  HL: {
    leader: ["ANAK", "BEDAH", "BEDAH MULUT", "INTERNA", "INTERNA - ANAK", "PARU", "THT"],
    subtipe: [
      "HL - Nodular Sclerosis",
      "HL - Mixed Cellularity",
      "HL - Lymphocyte-rich",
      "HL - Lymphocyte-depleted",
      "HL - nodular lymphocyte-predominant B-cell lymphoma (NLPBL)",
      "HL - unspecified",
    ],
  },
};

// Other (user-added) modules have no sheet dropdowns to copy; their fields
// fall back to free text.
export function optionsForType(cancerType: string): TypeOptions {
  return OPTIONS_BY_TYPE[cancerType] ?? { leader: [], subtipe: [] };
}

export const NODAL_TYPE_OPTIONS = ["nodal", "extranodal"];

export const METASTASIS_OPTIONS = [
  "tidak ada",
  "pulmo",
  "bone",
  "brain",
  "lien",
  "hepar",
  "thyroid",
  "duodenum",
  "pleura",
  "peritoneum",
];

export const RESPON_KEMOTERAPI_OPTIONS = [
  "CR",
  "PR",
  "SD",
  "PD",
  "tidak dievaluasi",
  "tidak dikemo",
  "kemo tidak lengkap",
  "eval dg USG, thorax",
  "on going chemo",
  "CT scan sebelum tidak ada",
  "masih dalam evaluasi",
  "MD sebelum sls kemo",
  "loss to fu",
];

const REJIMEN_LINI_1 = [
  "CHOP",
  "R-CHOP",
  "R-CTX/R-CVP",
  "Rituximab",
  "CYP",
  "Chlorambucil",
  "Non-specific",
  "Others",
  " R-COEP",
  "COEP",
  "5-FU/LV",
  "CHEOP",
];

const REJIMEN_LINI_2 = [
  "CHOP",
  "R-CHOP",
  "R-CTX/R-CVP",
  "Rituximab",
  "CYP",
  "Chlorambucil",
  "mini R-CEOP",
  "HD-MTX",
  "ICE-Mesna",
];

// The sheet has dropdowns for lini 1 and 2 only; later lines offer both.
export function rejimenOptions(liniIndex: number): string[] {
  if (liniIndex === 0) return REJIMEN_LINI_1;
  if (liniIndex === 1) return REJIMEN_LINI_2;
  return [...new Set([...REJIMEN_LINI_1, ...REJIMEN_LINI_2])];
}

export const RADIOTERAPI_OPTIONS = ["Ya", "Tidak"];

export const DOSIS_RADIOTERAPI_OPTIONS = [
  "<30 Gy",
  "30-35 Gy",
  "36-40 Gy",
  "41-45 Gy",
  "46-50 Gy",
  "> 50 Gy",
  "Not Specified",
];

export const ECOG_OPTIONS = ["0", "1", "2", "3", "4"];
export const STADIUM_OPTIONS = ["I", "II", "III", "IV"];
export const JK_OPTIONS = ["Laki - Laki", "Perempuan"];
export const PENDIDIKAN_OPTIONS = ["SD", "SLTP", "SMP", "SLTA", "SMA", "Diploma", "S1", "S2", "S3"];
