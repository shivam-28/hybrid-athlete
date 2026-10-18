/** Sample payload used by the setup guide's test command. Kept valid by a unit test. */
export const EXAMPLE_PAYLOAD = {
  daily: [
    { date: "2026-06-14", steps: 8234 },
    { date: "2026-06-14", resting_hr_bpm: 52 },
    { date: "2026-06-14", sleep_minutes: 431 },
  ],
  workouts: [
    {
      sport: "running",
      start: "2026-06-14T07:00:00+02:00",
      end: "2026-06-14T07:52:30+02:00",
      duration_s: 3150,
      distance_m: 10000,
      avg_hr: 152,
      source_name: "Garmin Connect",
    },
  ],
};

export function curlTestCommand(ingestUrl: string): string {
  return [
    `curl -X POST '${ingestUrl}' \\`,
    `  -H 'Authorization: Bearer YOUR_INGEST_TOKEN' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${JSON.stringify(EXAMPLE_PAYLOAD)}'`,
  ].join("\n");
}
