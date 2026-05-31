import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { analyseCondition } from "@/lib/condition.functions";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/btl/NumberField";
import { fmtGBP } from "@/lib/btl";

export const Route = createFileRoute("/condition")({
  head: () => ({
    meta: [
      { title: "Property Condition Analyser" },
      {
        name: "description",
        content:
          "Upload internal photos of a property and get an AI condition score out of 10 plus an estimated cost to bring it to a lettable rental standard.",
      },
      { property: "og:title", content: "Property Condition Analyser" },
      {
        property: "og:description",
        content: "AI-rated property condition and refurb cost to rental-ready.",
      },
    ],
  }),
  component: ConditionPage,
});

function ConditionPage() {
  const analyse = useServerFn(analyseCondition);
  const fileRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [propertyType, setPropertyType] = useState("Mid-terrace house");
  const [bedrooms, setBedrooms] = useState(3);
  const [location, setLocation] = useState("");
  const [targetStandard, setTargetStandard] =
    useState<"basic" | "mid" | "premium">("mid");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      analyse({
        data: {
          images: images.map((i) => i.url),
          propertyType,
          bedrooms,
          location,
          targetStandard,
          notes,
        },
      }),
  });

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    for (const f of list) {
      if (images.length + 1 > 12) {
        alert("Max 12 images");
        break;
      }
      if (f.size > 8 * 1024 * 1024) {
        alert(`${f.name} is over 8MB and was skipped`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) =>
          prev.length >= 12 ? prev : [...prev, { url: reader.result as string, name: f.name }],
        );
      };
      reader.readAsDataURL(f);
    }
  };

  const removeImage = (idx: number) =>
    setImages((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit =
    images.length > 0 && location.trim().length > 0 && !mutation.isPending;

  const result = mutation.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              C
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Property Condition Analyser</h1>
              <p className="text-xs text-muted-foreground">
                Upload interior photos for an AI condition score and refurb estimate
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* Inputs */}
          <section className="space-y-5 rounded-xl border border-border bg-card p-5">
            <div>
              <label className="text-sm font-medium">Interior photos</label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-medium">Click or drag photos here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Up to 12 images, 8MB each (kitchen, bathroom, each room)
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="group relative">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="h-20 w-full rounded-md object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(i);
                        }}
                        className="absolute right-1 top-1 rounded-full bg-background/90 px-1.5 text-xs leading-tight opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="ptype" className="text-sm font-medium">
                Property type
              </label>
              <input
                id="ptype"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField id="bed" label="Bedrooms" value={bedrooms} onChange={setBedrooms} step={1} />
              <div>
                <label className="text-xs font-medium text-muted-foreground">Target standard</label>
                <select
                  value={targetStandard}
                  onChange={(e) => setTargetStandard(e.target.value as "basic" | "mid" | "premium")}
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="basic">Basic let</option>
                  <option value="mid">Mid / family</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="loc2" className="text-sm font-medium">
                Location
              </label>
              <input
                id="loc2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Leeds LS6"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">Used to adjust trade pricing.</p>
            </div>

            <div>
              <label htmlFor="notes2" className="text-sm font-medium">
                Notes (optional)
              </label>
              <textarea
                id="notes2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. boiler 12 yrs old, damp patch noted in hallway"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button className="w-full" disabled={!canSubmit} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Analysing photos…" : "Analyse condition"}
            </Button>

            {mutation.isError && (
              <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
            )}
          </section>

          {/* Results */}
          <section className="space-y-5">
            {!result && !mutation.isPending && (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
                <h2 className="text-lg font-semibold text-foreground">Condition report</h2>
                <p className="mt-2 max-w-md text-sm">
                  Upload interior photos of the property. You'll get an overall 1-10 score,
                  a room-by-room breakdown, the works needed and an estimated cost to bring
                  it to your chosen rental standard.
                </p>
              </div>
            )}

            {mutation.isPending && (
              <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-border bg-card p-6">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Surveying photos and pricing works…
                  </p>
                </div>
              </div>
            )}

            {result && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Condition score
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-4xl font-bold tabular-nums text-primary">
                        {result.overallRating}
                      </span>
                      <span className="text-lg text-muted-foreground">/10</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Estimated cost
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums">
                      {fmtGBP(result.totalEstimatedCost)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Range {fmtGBP(result.costRangeLow)} – {fmtGBP(result.costRangeHigh)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Timeline
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{result.timelineWeeks}</div>
                  </div>
                </div>

                {result.headline && (
                  <div className="rounded-xl border border-border bg-card p-5">
                    <p className="text-sm text-foreground">{result.headline}</p>
                  </div>
                )}

                {result.rooms?.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Room-by-room
                    </h3>
                    <div className="mt-3 divide-y divide-border">
                      {result.rooms.map((r, i) => (
                        <div key={i} className="py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium">{r.room}</div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="tabular-nums text-primary font-semibold">
                                {r.rating}/10
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {fmtGBP(r.estimatedCost)}
                              </span>
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{r.observations}</p>
                          {r.works?.length > 0 && (
                            <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
                              {r.works.map((w, j) => <li key={j}>{w}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.priorityWorks?.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Priority works
                    </h3>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                      {result.priorityWorks.map((w, i) => <li key={i}>{w}</li>)}
                    </ol>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}