export type CancerType = {
  id: string;
  label: string;
  description?: string;
};

export const CANCER_TYPES: CancerType[] = [
  { id: "HL", label: "HL", description: "Hodgkin Lymphoma" },
  { id: "NHL", label: "NHL", description: "Non-Hodgkin Lymphoma" },
];

