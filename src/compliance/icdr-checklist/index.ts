export interface ChecklistRequirement {
  key: string;
  description: string;
}

export const icdrChecklist: ChecklistRequirement[] = [
  { key: "companyName", description: "Full legal name of the company" },
  { key: "cin", description: "Corporate Identification Number (CIN)" },
  { key: "incorporationDate", description: "Date of incorporation" },
  { key: "registeredOffice", description: "Registered office address" },
  { key: "sector", description: "Primary sector of operation" },
  { key: "promoters", description: "Details of promoters" },
  { key: "capitalStructure", description: "Current capital structure" },
  { key: "pan", description: "Permanent Account Number (PAN)" },
  { key: "gstin", description: "GST Identification Number (GSTIN)" },
  { key: "fiscalYearEnd", description: "Fiscal year end month" },
  { key: "litigationHistory", description: "Details of pending litigations involving the company or its promoters" },
  { key: "riskFactors", description: "Key risk factors affecting the business" },
  { key: "useOfProceeds", description: "Detailed breakdown of the objects of the issue / use of proceeds" },
];
