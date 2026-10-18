import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { curlTestCommand } from "@/lib/ingest/example";
import { SPORTS } from "@/lib/ingest/payload";
import { requireProfile } from "@/server/auth";
import { getIngestTokenStatus } from "@/server/ingest/tokens";

export const metadata: Metadata = { title: "Apple Health setup" };

export default function AppleHealthGuidePage() {
  return (
    <>
      <div>
        <Link href="/settings#apple-health" className="text-muted-foreground text-sm">
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Sync Garmin via Apple Health</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <GuideContent />
      </Suspense>
    </>
  );
}

async function instanceOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="space-y-2">
      <h3 className="font-medium">
        {n}. {title}
      </h3>
      <div className="text-muted-foreground space-y-2 text-sm">{children}</div>
    </li>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
);

async function GuideContent() {
  const { user } = await requireProfile("/settings/apple-health");
  const [token, origin] = await Promise.all([getIngestTokenStatus(user.id), instanceOrigin()]);
  const ingestUrl = `${origin}/api/ingest/health`;

  return (
    <>
      <p className="text-muted-foreground">
        Garmin Connect copies your watch data into Apple Health. A Shortcut on your iPhone reads it once a day and sends
        it here. Runs with full detail (splits, heart-rate zones) can also be uploaded as FIT files in{" "}
        <Link href="/train/activities" className="text-foreground underline">Activities</Link>.
      </p>

      {!token && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/50 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <span>
            You need an ingest token first.{" "}
            <Link href="/settings#apple-health" className="underline">Generate one in Settings</Link>, copy it, then come back.
          </span>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-mono break-all" aria-label="Ingest URL">{ingestUrl}</p>
          <p className="text-muted-foreground">
            Send a <Code>POST</Code> with header <Code>Authorization: Bearer &lt;your token&gt;</Code> and a JSON body.
            Contract: <a className="underline" href="/api/ingest/health/schema">JSON schema</a>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Before you start</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            In the Garmin Connect app: <strong>More → Settings → Connected Apps → Apple Health</strong>, and allow all
            categories. Then open the Health app once and check that today&apos;s steps appear.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Build the Shortcut</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            <Step n={1} title="Create it">
              <p>Open <strong>Shortcuts</strong> → <strong>+</strong>. Name it <Code>Hybrid Athlete sync</Code>.</p>
            </Step>
            <Step n={2} title="Collect steps per day">
              <p>
                Add <strong>Find Health Samples</strong>: Type <Code>Steps</Code>, Start Date <Code>is in the last 2 days</Code>,
                Group By <Code>Day</Code>.
              </p>
              <p>
                Add <strong>Repeat with Each</strong> on the samples. Inside the loop add:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>Format Date</strong>: Start Date of <em>Repeat Item</em>, Custom format <Code>yyyy-MM-dd</Code>.</li>
                <li><strong>Dictionary</strong> with keys <Code>date</Code> (Text: Formatted Date) and <Code>steps</Code> (Number: Value of <em>Repeat Item</em>).</li>
                <li><strong>Add to Variable</strong>: <Code>daily</Code>.</li>
              </ul>
            </Step>
            <Step n={3} title="Repeat for the other metrics">
              <p>Duplicate step 2 for each metric you want, changing the type and the dictionary key:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Active Energy → <Code>active_energy_kcal</Code> (Group By Day)</li>
                <li>Resting Heart Rate → <Code>resting_hr_bpm</Code></li>
                <li>Heart Rate Variability → <Code>hrv_sdnn_ms</Code> (not every Garmin writes this)</li>
                <li>Sleep: Find Health Samples type <Code>Sleep Analysis</Code>, add up the durations per night in minutes → <Code>sleep_minutes</Code></li>
                <li>Weight (smart scales) → <Code>weight_kg</Code></li>
              </ul>
              <p>One entry per metric per day is fine; the server merges entries for the same date.</p>
            </Step>
            <Step n={4} title="Workouts (optional)">
              <p>
                If your iOS version offers <strong>Find Health Samples</strong> of type <Code>Workouts</Code>, add a loop that
                builds dictionaries with <Code>sport</Code> (one of {SPORTS.join(", ")}), <Code>start</Code> and{" "}
                <Code>end</Code> (Format Date: ISO 8601), <Code>duration_s</Code> and, when available,{" "}
                <Code>distance_m</Code>, <Code>avg_hr</Code>, <Code>active_energy_kcal</Code>. Add them to a variable
                called <Code>workouts</Code>. If it&apos;s not available, upload FIT files instead.
              </p>
            </Step>
            <Step n={5} title="Send it">
              <p>
                Add a <strong>Dictionary</strong> with keys <Code>daily</Code> (Array: the <em>daily</em> variable) and,
                if you built it, <Code>workouts</Code>.
              </p>
              <p>
                Add <strong>Get Contents of URL</strong>: URL <Code>{ingestUrl}</Code>, Method <Code>POST</Code>, Headers{" "}
                <Code>Authorization</Code> = <Code>Bearer YOUR_TOKEN</Code> and <Code>Content-Type</Code> ={" "}
                <Code>application/json</Code>, Request Body <Code>File</Code> → the dictionary.
              </p>
              <p>Run the Shortcut once and allow Health access when asked. The response shows how many records were stored.</p>
            </Step>
            <Step n={6} title="Run it every day">
              <p>
                In Shortcuts open <strong>Automation</strong> → <strong>+</strong> → <strong>Time of Day</strong> (e.g.
                07:30, Daily) → choose <strong>Run Immediately</strong> → select <Code>Hybrid Athlete sync</Code>. Each run
                sends the last 2 days, so a missed day catches up and re-sending never duplicates anything.
              </p>
            </Step>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test from a computer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Replace the token, run it twice: the second response reports everything as unchanged.</p>
          <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs" aria-label="Test command">
            {curlTestCommand(ingestUrl)}
          </pre>
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        Never share this Shortcut: it contains your token, and anyone with it can send data to your account. If it leaks,
        rotate the token in Settings.
      </p>
    </>
  );
}
