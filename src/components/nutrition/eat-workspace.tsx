"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, History, MessageSquareText, Pencil, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RequiresAiKey } from "@/components/requires-ai-key";
import { api } from "@/lib/api-client";
import { ClientImageError, reencodeForUpload } from "@/lib/images/normalize-client";
import { MEAL_TYPES, MEAL_TYPE_LABELS, draftFromItems, type MealDraft, type MealType } from "@/lib/nutrition/draft";
import { inferMealType, localClock } from "@/lib/nutrition/meal-time";
import type { MealWithItems } from "@/server/nutrition/meals";
import type { PlannedMealRow } from "@/server/nutrition/planned";
import { MealConfirm, type ConfirmMode } from "./meal-confirm";
import { Recommendations } from "./recommendations";

const MEAL_PHOTO_LONG_EDGE = 1568;
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

type RecognizeResponse = { kind: "draft"; draft: MealDraft } | { kind: "no_food" } | { kind: "unreadable" };
type Editing = { draft: MealDraft; mode: ConfirmMode; mealType: MealType } | null;

const sum = (m: MealWithItems, key: "kcal" | "protein_g" | "carb_g" | "fat_g") => Math.round(m.items.reduce((s, i) => s + Number(i[key]), 0));

export function EatWorkspace(props: {
  date: string;
  isToday: boolean;
  timezone: string;
  hasAiKey: boolean;
  meals: MealWithItems[];
  planned: PlannedMealRow[];
  isComplete: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [panel, setPanel] = useState<"none" | "describe" | "recent">("none");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<MealWithItems[] | null>(null);

  const nowType = () => inferMealType(localClock(new Date(), props.timezone));
  const open = (draft: MealDraft, mode: ConfirmMode = { kind: "new" }, mealType: MealType = nowType()) => {
    setMessage(null);
    setPanel("none");
    setEditing({ draft, mode, mealType });
  };
  const done = (saved: boolean) => {
    setEditing(null);
    if (saved) {
      toast.success("Meal saved");
      router.refresh();
    }
  };

  async function recognize(body: { photoPath?: string; description?: string }) {
    setStatus("Analysing your meal…");
    const res = await api<RecognizeResponse>("/api/meals/recognize", { body });
    setStatus(null);
    if (!res.ok) return setMessage(res.message);
    if (res.data.kind === "draft") return open(res.data.draft);
    setMessage(
      res.data.kind === "no_food"
        ? "No food was found. Try describing the meal or search for the foods instead."
        : "That couldn't be read reliably. Describe the meal or search for the foods instead.",
    );
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      setStatus("Preparing photo…");
      const jpeg = await reencodeForUpload(file, MAX_ORIGINAL_BYTES, MEAL_PHOTO_LONG_EDGE);
      const form = new FormData();
      form.set("file", jpeg);
      setStatus("Uploading…");
      const res = await fetch("/api/meals/photo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ClientImageError(data.message ?? "The photo could not be uploaded.");
      await recognize({ photoPath: data.photoPath });
    } catch (error) {
      setStatus(null);
      setMessage(error instanceof ClientImageError ? error.message : "The photo could not be uploaded. Please try again.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function showRecent() {
    setPanel("recent");
    const res = await api<{ meals: MealWithItems[] }>("/api/meals/recent");
    if (res.ok) setRecent(res.data.meals);
    else setMessage(res.message);
  }

  async function mutate(path: string, init: { method: string; body?: unknown }, success: string) {
    const res = await api(path, init);
    if (!res.ok) return toast.error(res.message);
    toast.success(success);
    router.refresh();
  }

  async function ateThis(id: string) {
    const res = await api<{ draft: MealDraft }>(`/api/planned-meals/${id}/draft`);
    if (!res.ok) return toast.error(res.message);
    const slot = props.planned.find((p) => p.id === id)?.slot ?? nowType();
    open(res.data.draft, { kind: "new" }, slot);
  }

  return (
    <div className="space-y-6">
      {props.isToday && !editing && (
        <section aria-label="Log a meal" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <RequiresAiKey available={props.hasAiKey} feature="Photo logging">
              <Button type="button" className="h-12" onClick={() => fileInput.current?.click()} disabled={status !== null}>
                <Camera className="size-5" aria-hidden /> Snap meal
              </Button>
            </RequiresAiKey>
            <RequiresAiKey available={props.hasAiKey} feature="Describing a meal">
              <Button type="button" variant="outline" className="h-12" onClick={() => setPanel(panel === "describe" ? "none" : "describe")}>
                <MessageSquareText className="size-5" aria-hidden /> Describe
              </Button>
            </RequiresAiKey>
            <Button type="button" variant="outline" className="h-12" onClick={() => open({ source: "search", name: null, photo_path: null, items: [] })}>
              <Search className="size-5" aria-hidden /> Search food
            </Button>
            <Button type="button" variant="outline" className="h-12" onClick={showRecent}>
              <History className="size-5" aria-hidden /> Recent
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="Meal photo"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
          {panel === "describe" && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                recognize({ description });
              }}
            >
              <Textarea
                aria-label="Describe your meal"
                placeholder="e.g. 200 g chicken breast with rice and a side salad. Tap the keyboard mic to dictate."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                required
              />
              <Button type="submit" className="h-11 w-full" disabled={status !== null}>
                Estimate nutrients
              </Button>
            </form>
          )}
          {panel === "recent" && (
            <div className="space-y-2">
              {recent === null && <p className="text-muted-foreground text-sm">Loading…</p>}
              {recent?.length === 0 && <p className="text-muted-foreground text-sm">Meals you log will appear here for one-tap re-logging.</p>}
              <ul className="divide-y rounded-md border" aria-label="Recent and favourite meals">
                {recent?.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.is_favorite && <Star className="mr-1 inline size-3 fill-current text-amber-500" aria-label="Favourite" />}
                        {m.name || m.items.map((i) => i.name).join(", ")}
                      </p>
                      <p className="text-muted-foreground text-xs">{sum(m, "kcal")} kcal</p>
                    </div>
                    <Button type="button" size="sm" className="h-11" onClick={() => mutate(`/api/meals/${m.id}/relog`, { method: "POST" }, "Logged again")}>
                      Log again
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status && (
            <p role="status" className="text-muted-foreground text-sm">
              {status}
            </p>
          )}
          {message && (
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
              {message}
            </p>
          )}
        </section>
      )}

      {editing && <MealConfirm key={JSON.stringify(editing.mode)} initial={editing.draft} mode={editing.mode} defaultMealType={editing.mealType} onDone={done} />}

      <section aria-label="Meals" className="space-y-4">
        {props.meals.length === 0 && <p className="text-muted-foreground text-sm">No meals logged for this day yet.</p>}
        {MEAL_TYPES.map((type) => {
          const meals = props.meals.filter((m) => m.meal_type === type);
          if (meals.length === 0) return null;
          return (
            <div key={type} className="space-y-2">
              <h2 className="font-medium">{MEAL_TYPE_LABELS[type]}</h2>
              <ul className="space-y-2">
                {meals.map((m) => (
                  <li key={m.id} className="flex gap-3 rounded-md border p-3" data-testid="meal">
                    {m.photo_url && (
                      // Signed, short-lived URL to the user's private photo.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo_url} alt="" className="size-16 shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.name || m.items.map((i) => i.name).join(", ")}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {sum(m, "kcal")} kcal · P {sum(m, "protein_g")} g · C {sum(m, "carb_g")} g · F {sum(m, "fat_g")} g
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{m.items.map((i) => `${i.name} ${Number(i.grams)} g`).join(" · ")}</p>
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label={m.is_favorite ? "Remove from favourites" : "Add to favourites"}
                        aria-pressed={m.is_favorite}
                        onClick={() => mutate(`/api/meals/${m.id}/favorite`, { method: "PUT", body: { isFavorite: !m.is_favorite } }, m.is_favorite ? "Removed from favourites" : "Added to favourites")}
                      >
                        <Star className={m.is_favorite ? "size-4 fill-current text-amber-500" : "size-4"} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        aria-label="Edit meal"
                        onClick={() => open({ source: m.source, name: m.name, photo_path: m.photo_path, items: draftFromItems(m.items) }, { kind: "edit", mealId: m.id }, m.meal_type)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Delete meal" onClick={() => mutate(`/api/meals/${m.id}`, { method: "DELETE" }, "Meal deleted")}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {props.planned.length > 0 && (
        <section aria-label="Planned meals" className="space-y-2">
          <h2 className="font-medium">Planned (not counted until eaten)</h2>
          <ul className="space-y-2">
            {props.planned.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-dashed p-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">{MEAL_TYPE_LABELS[p.slot]}</p>
                  <p className="truncate font-medium">{p.name}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" className="h-11" onClick={() => ateThis(p.id)}>
                    Ate this
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove plan ${p.name}`} onClick={() => mutate(`/api/planned-meals/${p.id}`, { method: "DELETE" }, "Plan removed")}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.isToday && (
        <RequiresAiKey available={props.hasAiKey} feature="Meal suggestions">
          <Recommendations />
        </RequiresAiKey>
      )}

      <label className="flex min-h-11 items-center gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          className="size-5"
          defaultChecked={props.isComplete}
          onChange={(e) => mutate(`/api/nutrition/log-days/${props.date}`, { method: "PUT", body: { isComplete: e.target.checked } }, e.target.checked ? "Day marked complete" : "Day marked incomplete")}
        />
        <span className="text-sm">
          I logged everything I ate this day
          <span className="text-muted-foreground block text-xs">Complete days teach the app your real calorie burn.</span>
        </span>
      </label>
    </div>
  );
}
