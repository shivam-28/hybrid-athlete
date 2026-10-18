"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatDay } from "@/lib/body/format";

type Photo = { id: string; local_date: string; pose: string; url: string; width: number; height: number };

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  if (photos.length === 0) return <p className="text-muted-foreground text-sm">No progress photos yet. Same light, same pose, every 2–4 weeks works best.</p>;
  const byDate = Map.groupBy(photos, (p) => p.local_date);

  return (
    <div className="space-y-5">
      {[...byDate].map(([date, items]) => (
        <section key={date} aria-label={formatDay(date)}>
          <h3 className="mb-2 text-sm font-medium">{formatDay(date)}</h3>
          <ul className="grid grid-cols-3 gap-2">
            {items.map((p) => (
              <li key={p.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs, not optimisable */}
                <img src={p.url} alt={`${p.pose} photo, ${formatDay(date)}`} width={p.width} height={p.height} className="aspect-[3/4] w-full rounded-md object-cover" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs capitalize">{p.pose}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-8 px-2 text-xs"
                    aria-label={`Delete ${p.pose} photo from ${formatDay(date)}`}
                    onClick={async () => {
                      if (!confirm("Delete this photo? This also deletes any analysis that used it.")) return;
                      await api(`/api/progress-photos/${p.id}`, { method: "DELETE" });
                      router.refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
