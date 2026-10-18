// Writes synthetic FIT/zip fixtures to tests/fixtures/fit/. Re-run: pnpm exec tsx scripts/generate-fit-fixtures.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { Encoder, Profile } from "@garmin/fitsdk";
import { zipSync, strToU8 } from "fflate";

const DIR = "tests/fixtures/fit";
const MESG = Profile.MesgNum as Record<"FILE_ID" | "RECORD" | "SESSION" | "ACTIVITY", number>;

type Options = {
  start: Date;
  sport: string;
  subSport?: string;
  durationS: number;
  distanceM: number;
  /** Heart rate at second i, or null for no HR data. */
  hr: ((i: number) => number) | null;
  intervalS?: number;
};

function activity({ start, sport, subSport = "generic", durationS, distanceM, hr, intervalS = 5 }: Options): Uint8Array {
  const enc = new Encoder();
  const at = (s: number) => new Date(start.getTime() + s * 1000);
  enc.writeMesg({ mesgNum: MESG.FILE_ID, type: "activity", manufacturer: "development", product: 0, timeCreated: start, serialNumber: 42 } as never);
  const heartRates: number[] = [];
  for (let s = 0; s <= durationS; s += intervalS) {
    const record: Record<string, unknown> = {
      mesgNum: MESG.RECORD,
      timestamp: at(s),
      altitude: 20 + 10 * Math.sin(s / 600),
    };
    if (distanceM > 0) record.distance = (distanceM * s) / durationS;
    if (hr) {
      record.heartRate = hr(s);
      heartRates.push(hr(s));
    }
    enc.writeMesg(record as never);
  }
  const session: Record<string, unknown> = {
    mesgNum: MESG.SESSION,
    timestamp: at(durationS),
    startTime: start,
    sport,
    subSport,
    totalElapsedTime: durationS,
    totalTimerTime: durationS,
    totalAscent: 18,
    totalCalories: Math.round(durationS / 6),
  };
  if (distanceM > 0) session.totalDistance = distanceM;
  if (hr) {
    session.avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
    session.maxHeartRate = Math.max(...heartRates);
  }
  enc.writeMesg(session as never);
  enc.writeMesg({ mesgNum: MESG.ACTIVITY, timestamp: at(durationS), numSessions: 1, type: "manual", event: "activity", eventType: "stop" } as never);
  return enc.close();
}

mkdirSync(DIR, { recursive: true });

// 10.00 km in 52:30 → 5:15 /km; HR 140 for the first half, 165 for the second.
const run10k = activity({
  start: new Date("2026-06-14T05:00:00Z"),
  sport: "running",
  durationS: 3150,
  distanceM: 10000,
  hr: (s) => (s < 1575 ? 140 : 165),
});
// 5.4 km easy run, steady HR 145.
const run54 = activity({ start: new Date("2026-06-16T16:00:00Z"), sport: "running", durationS: 1890, distanceM: 5400, hr: () => 145 });
const runNoHr = activity({ start: new Date("2026-06-18T06:30:00Z"), sport: "running", durationS: 1500, distanceM: 4000, hr: null });
const strength = activity({ start: new Date("2026-06-19T17:00:00Z"), sport: "training", subSport: "strengthTraining", durationS: 2700, distanceM: 0, hr: () => 120, intervalS: 10 });

writeFileSync(`${DIR}/run-10k-hr.fit`, run10k);
writeFileSync(`${DIR}/run-5_4k.fit`, run54);
writeFileSync(`${DIR}/run-no-hr.fit`, runNoHr);
writeFileSync(`${DIR}/strength.fit`, strength);
writeFileSync(`${DIR}/corrupt.fit`, run54.slice(0, Math.floor(run54.length / 2)));
writeFileSync(`${DIR}/garmin-export.zip`, zipSync({ "21987654321_ACTIVITY.fit": run54 }));
writeFileSync(`${DIR}/no-fit.zip`, zipSync({ "readme.txt": strToU8("not an activity") }));
writeFileSync(`${DIR}/two-fit.zip`, zipSync({ "a.fit": run54, "b.fit": runNoHr }));
console.log("fixtures written to", DIR);
