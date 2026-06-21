export type CancerType = {
  id: string;
  label: string;
  description?: string;
};

export const CANCER_TYPES: CancerType[] = [
  { id: "NHL", label: "NHL", description: "Non-Hodgkin Lymphoma" },
  { id: "HL", label: "HL", description: "Hodgkin Lymphoma" },
  { id: "BC", label: "Breast Cancer" },
  { id: "CC", label: "Cervical Cancer" },
  { id: "CRC", label: "Colorectal Cancer" },
  { id: "LC", label: "Lung Cancer" },
];

