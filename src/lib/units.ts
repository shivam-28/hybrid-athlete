export type UnitSystem = "metric" | "imperial";

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const KM_PER_MILE = 1.609344;

const round = (value: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

export const lbToKg = (lb: number) => round(lb * KG_PER_LB, 2);
export const kgToLb = (kg: number) => round(kg / KG_PER_LB, 2);
export const kmToMiles = (km: number) => km / KM_PER_MILE;
export const milesToKm = (mi: number) => mi * KM_PER_MILE;

export const feetInchesToCm = (feet: number, inches: number) =>
  round((feet * 12 + inches) * CM_PER_INCH, 1);

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function formatWeight(kg: number, system: UnitSystem): string {
  return system === "metric" ? `${round(kg, 1)} kg` : `${round(kg / KG_PER_LB, 1)} lb`;
}

export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === "metric") return `${round(cm, 1)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet} ft ${inches} in`;
}

export function formatDistance(meters: number, system: UnitSystem): string {
  const km = meters / 1000;
  return system === "metric" ? `${round(km, 2)} km` : `${round(kmToMiles(km), 2)} mi`;
}

/** Set weights display rounded to 0.5 kg or 1 lb. */
export function formatSetWeight(kg: number, system: UnitSystem): string {
  return system === "metric" ? `${Math.round(kg * 2) / 2} kg` : `${Math.round(kg / KG_PER_LB)} lb`;
}

/** A weight typed in the user's unit, converted to stored kilograms. */
export const weightInputToKg = (value: number, system: UnitSystem) => (system === "metric" ? value : lbToKg(value));

/** Stored kilograms shown in an input field in the user's unit. */
export const kgToWeightInput = (kg: number, system: UnitSystem) => (system === "metric" ? kg : Math.round(kg / KG_PER_LB));
