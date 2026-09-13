export type WeightUnit = "kg" | "lb";

export type WeightEntry = {
  id: string;
  localDate: string; // local YYYY-MM-DD
  weightGrams: number; // canonical integer grams
  createdAt: string; // UTC ISO
  updatedAt: string; // UTC ISO
};
