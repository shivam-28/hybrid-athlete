import { kgToLb, type UnitSystem } from "@/lib/units";

export const weightUnit = (units: UnitSystem) => (units === "metric" ? "kg" : "lb");
export const lengthUnit = (units: UnitSystem) => (units === "metric" ? "cm" : "in");

/** Kilograms → the user's display unit, as a number (1 decimal). */
export function displayWeight(kg: number, units: UnitSystem): number {
  return Math.round((units === "metric" ? kg : kgToLb(kg)) * 10) / 10;
}

export function displayLength(cm: number, units: UnitSystem): number {
  return Math.round((units === "metric" ? cm : cm / 2.54) * 10) / 10;
}

const signed = (n: number, decimals: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(decimals)}`;

export function formatRate(kgPerWeek: number, pctPerWeek: number, units: UnitSystem): string {
  const value = units === "metric" ? kgPerWeek : kgToLb(Math.abs(kgPerWeek)) * Math.sign(kgPerWeek);
  return `${signed(value, 2)} ${weightUnit(units)}/week (${signed(pctPerWeek, 2)} %/week)`;
}

export function formatSignedLength(cm: number, units: UnitSystem): string {
  return `${signed(displayLength(cm, units), 1)} ${lengthUnit(units)}`;
}

export function formatDay(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
