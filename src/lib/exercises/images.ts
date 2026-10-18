/** Same pinned commit as scripts/seed-exercises.ts; images are referenced, not re-hosted. */
const FREE_EXERCISE_DB_SHA = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
export const EXERCISE_IMAGE_BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FREE_EXERCISE_DB_SHA}/exercises`;

export const exerciseImageUrl = (path: string) => `${EXERCISE_IMAGE_BASE}/${path}`;
