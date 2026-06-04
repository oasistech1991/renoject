import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { analyseFloorplan } from "@/lib/hmo.functions";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/btl/NumberField";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/hmo-compliance")({
  head: () => ({
    meta: [
      { title: "HMO Floorplan Compliance Checker" },
      {
        name: "description",
        content:
          "Upload an HMO floorplan and get an AI-driven UK compliance report: licensing, room sizes, fire safety, amenities and local authority rules.",
      },
      { property: "og:title", content: "HMO Floorplan Compliance Checker" },
      {
        property: "og:description",
        content: "AI compliance review of UK HMO floorplans by location.",
      },
    ],
  }),
  component: HMOCompliancePage,
});

function HMOCompliancePage() {
  const analyse = useServerFn(analyseFloorplan);
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [location, setLocation] = useState("");
  const [bedrooms, setBedrooms] = useState(5);
  const [storeys, setStoreys] = useState(2);
  const [occupants, setOccupants] = useState(5);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      analyse({
        data: {
          imageBase64: imageBase64!,
          location,
          bedrooms,
          storeys,
          occupants,
          notes,
        },
      }),
  });

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      alert("Image must be under 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(reader.result as string);
      setFileName(f.name);
    };
    reader.readAsDataURL(f);
  };

  const canSubmit = !!imageBase64 && location.trim().length > 0 && !mutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              H
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">HMO Compliance Checker</h1>
              <p className="text-xs text-muted-foreground">
                Upload a floorplan and get a location-specific compliance report
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
              <label className="text-sm font-medium">Floorplan image</label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors hover:bg-muted/50"
              >
                {imageBase64 ? (
                  <>
                    <img
                      src={imageBase64}
                      alt="Floorplan preview"
                      className="max-h-48 rounded-md object-contain"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">{fileName} · click to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Click or drag floorplan here</p>
                    <p className="mt-1 text-xs text-muted-foreground">PNG, JPG up to 8MB</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="loc" className="text-sm font-medium">
                Property location
              </label>
              <input
                id="loc"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Selly Oak, Birmingham B29"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used to identify local licensing, Article 4 directions etc.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <NumberField id="beds" label="Bedrooms" value={bedrooms} onChange={setBedrooms} step={1} />
              <NumberField id="storeys" label="Storeys" value={storeys} onChange={setStoreys} step={1} />
              <NumberField id="occ" label="Occupants" value={occupants} onChange={setOccupants} step={1} />
            </div>

            <div>
              <label htmlFor="notes" className="text-sm font-medium">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. ensuites in 3 rooms, shared kitchen on ground floor"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Analysing floorplan…" : "Run compliance check"}
            </Button>

            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message}
              </p>
            )}
          </section>

          {/* Results */}
          <section className="rounded-xl border border-border bg-card p-6">
            {!mutation.data && !mutation.isPending && (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-muted-foreground">
                <h2 className="text-lg font-semibold text-foreground">Compliance report</h2>
                <p className="mt-2 max-w-md text-sm">
                  Upload a floorplan, enter the location and occupant details, then run the check.
                  You'll get a detailed UK HMO compliance breakdown: licensing, minimum room sizes,
                  fire safety, amenity standards and local authority rules.
                </p>
              </div>
            )}

            {mutation.isPending && (
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Inspecting floorplan and checking regulations…
                  </p>
                </div>
              </div>
            )}

            {mutation.data && (
              <ReportView data={mutation.data} proposed={bedrooms} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ReportView({
  data,
  proposed,
}: {
  data: Awaited<ReturnType<typeof analyseFloorplan>>;
  proposed: number;
}) {
  const verdictTone =
    data.verdict === "PASS"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : data.verdict === "REVIEW"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";

  const delta = data.maxCompliantBedrooms - proposed;
  const deltaMsg =
    delta === 0
      ? `Matches your target of ${proposed}.`
      : delta > 0
        ? `You asked for ${proposed} — there's room for ${delta} more.`
        : `You asked for ${proposed} — that's ${Math.abs(delta)} too many to be compliant.`;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Max compliant bedrooms
            </p>
            <p className="mt-1 text-5xl font-semibold tracking-tight text-foreground">
              {data.maxCompliantBedrooms}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{deltaMsg}</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${verdictTone}`}
          >
            {data.verdict}
          </span>
        </div>
        <p className="mt-4 text-sm text-foreground">{data.headline}</p>
        <div className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{data.licensing.type}</span>
          {data.licensing.required ? " · required" : " · not required"} —{" "}
          {data.licensing.note}
        </div>
      </div>

      {/* Top issues */}
      {data.topIssues.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Top issues</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {data.topIssues.map((issue, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rooms table */}
      {data.rooms.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Bedroom assessment</h3>
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Room</th>
                  <th className="px-3 py-2 text-right font-medium">Est. sqm</th>
                  <th className="px-3 py-2 text-right font-medium">Min</th>
                  <th className="px-3 py-2 text-center font-medium">OK</th>
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.label}</div>
                      {r.note && (
                        <div className="text-xs text-muted-foreground">{r.note}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.estimatedSqm.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.minRequiredSqm.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          r.compliant ? "bg-emerald-500" : "bg-destructive"
                        }`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail */}
      <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-5">
        <AccordionItem value="detail" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold">
            See full compliance detail
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2 text-sm leading-relaxed text-foreground">
              <DetailBlock title="Fire safety" body={data.details.fireSafety} />
              <DetailBlock title="Amenities" body={data.details.amenities} />
              <DetailBlock title="Local authority rules" body={data.details.localAuthority} />
              <DetailBlock title="Planning" body={data.details.planning} />
              {data.details.actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold">Prioritised actions</h4>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                    {data.details.actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
    </div>
  );
}