import type { MealType } from "./draft";
import { resolveTimezone } from "@/lib/time";

/** HH:MM of an instant in the user's timezone. */
export function localClock(instant: Date, tz: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: resolveTimezone(tz), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

/** Before 10:30 breakfast, 10:30–15:00 lunch, 17:00–21:30 dinner, otherwise snack. */
export function inferMealType(clock: string): MealType {
  if (clock < "10:30") return "breakfast";
  if (clock < "15:00") return "lunch";
  if (clock >= "17:00" && clock < "21:30") return "dinner";
  return "snack";
}

/** Meal slots still ahead at this local time; main meals already logged today are skipped. */
export function remainingSlots(clock: string, loggedToday: readonly MealType[]): MealType[] {
  const ahead: MealType[] =
    clock < "10:30"
      ? ["breakfast", "lunch", "snack", "dinner"]
      : clock < "15:00"
        ? ["lunch", "snack", "dinner"]
        : clock < "17:00"
          ? ["snack", "dinner"]
          : clock < "21:30"
            ? ["dinner"]
            : ["snack"];
  return ahead.filter((slot) => slot === "snack" || !loggedToday.includes(slot));
}
