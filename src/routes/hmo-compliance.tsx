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
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [currentBedrooms, setCurrentBedrooms] = useState(3);
  const [targetBedrooms, setTargetBedrooms] = useState(5);
  const [storeys, setStoreys] = useState(2);
  const [occupants, setOccupants] = useState(5);
  const [notes, setNotes] = useState("");
  const [floorArea, setFloorArea] = useState<string>("");
  const [areaUnit, setAreaUnit] = useState<"sqm" | "sqft">("sqm");
  const [scaleReference, setScaleReference] = useState("");
  const [bathRatio, setBathRatio] = useState<3 | 4 | 5>(5);
  const [kitchenSizing, setKitchenSizing] = useState<"standard" | "kitchen-diner" | "large">("standard");
  const [requireLivingRoom, setRequireLivingRoom] = useState(false);
  const [circulationPct, setCirculationPct] = useState(17);
  const [showAmenity, setShowAmenity] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = parseFloat(floorArea);
      const totalFloorAreaSqm = Number.isFinite(parsed) && parsed > 0
        ? areaUnit === "sqft"
          ? parsed * 0.092903
          : parsed
        : undefined;
      return analyse({
        data: {
          imageBase64: imageBase64!,
          location,
          bedrooms: targetBedrooms,
          storeys,
          occupants,
          notes: `Current bedrooms on floorplan: ${currentBedrooms}. ${notes}`.trim(),
          totalFloorAreaSqm,
          scaleReference: scaleReference.trim() || undefined,
          bathRatio,
          kitchenSizing,
          requireLivingRoom,
          circulationPct,
        },
      });
    },
  });

  const onFile = async (f: File | null) => {
    if (!f) return;
    setConvertError(null);
    if (f.size > 15 * 1024 * 1024) {
      setConvertError("File must be under 15MB");
      return;
    }
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const isImage = f.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setConvertError("Unsupported file. Upload an image (PNG/JPG) or a PDF floorplan.");
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageBase64(reader.result as string);
        setFileName(f.name);
      };
      reader.readAsDataURL(f);
      return;
    }

    // PDF: render the first page to a PNG data URL using pdfjs-dist
    try {
      setIsConverting(true);
      const pdfjs = await import("pdfjs-dist");
      // Use bundled worker via Vite ?url import
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      setImageBase64(dataUrl);
      setFileName(f.name + " (page 1)");
    } catch (err) {
      setConvertError(
        err instanceof Error ? `Couldn't read PDF: ${err.message}` : "Couldn't read PDF",
      );
    } finally {
      setIsConverting(false);
    }
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
                {isConverting ? (
                  <>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="mt-2 text-xs text-muted-foreground">Reading PDF…</p>
                  </>
                ) : imageBase64 ? (
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG, JPG or PDF up to 15MB (PDF: first page is used)
                    </p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {convertError && (
                <p className="mt-2 text-xs text-destructive">{convertError}</p>
              )}
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

            <div>
              <label className="text-sm font-medium">Total floor area</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={floorArea}
                  onChange={(e) => setFloorArea(e.target.value)}
                  placeholder="e.g. 95"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="inline-flex rounded-md border border-input bg-background p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAreaUnit("sqm")}
                    className={`px-2 py-1 rounded ${areaUnit === "sqm" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    sqm
                  </button>
                  <button
                    type="button"
                    onClick={() => setAreaUnit("sqft")}
                    className={`px-2 py-1 rounded ${areaUnit === "sqft" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    sqft
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Usually shown on the floorplan. Lets us calculate true bedroom capacity
                instead of guessing from the image.
              </p>
              <input
                type="text"
                value={scaleReference}
                onChange={(e) => setScaleReference(e.target.value)}
                placeholder="Scale reference (optional) — e.g. 1cm = 1m"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-3">
              <div>
                <NumberField
                  id="target-beds"
                  label="Target HMO bedrooms"
                  value={targetBedrooms}
                  onChange={setTargetBedrooms}
                  step={1}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  How many lettable bedrooms you want this property to provide once
                  converted. The AI checks whether the floorplan can support that many
                  under UK HMO rules.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumberField
                  id="current-beds"
                  label="Current beds"
                  value={currentBedrooms}
                  onChange={setCurrentBedrooms}
                  step={1}
                />
                <NumberField id="storeys" label="Storeys" value={storeys} onChange={setStoreys} step={1} />
                <NumberField id="occ" label="Occupants" value={occupants} onChange={setOccupants} step={1} />
              </div>
              <p className="-mt-1 text-xs text-muted-foreground">
                "Current beds" = bedrooms shown on the existing floorplan (context only).
              </p>
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

            <div className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setShowAmenity((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
              >
                <span>Amenity standards</span>
                <span className="text-xs text-muted-foreground">
                  {showAmenity ? "Hide" : "Customise"}
                </span>
              </button>
              {showAmenity && (
                <div className="space-y-3 border-t border-border px-3 py-3">
                  <div>
                    <label className="text-xs font-medium">Bath/WC ratio</label>
                    <select
                      value={bathRatio}
                      onChange={(e) => setBathRatio(Number(e.target.value) as 3 | 4 | 5)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      <option value={5}>1 per 5 occupants (England standard)</option>
                      <option value={4}>1 per 4 occupants (stricter)</option>
                      <option value={3}>1 per 3 occupants (premium)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Kitchen sizing</label>
                    <select
                      value={kitchenSizing}
                      onChange={(e) =>
                        setKitchenSizing(e.target.value as "standard" | "kitchen-diner" | "large")
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="standard">Standard kitchen (7-12 sqm)</option>
                      <option value="kitchen-diner">Kitchen-diner combined (12-16 sqm)</option>
                      <option value="large">Large kitchen (11-14 sqm)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={requireLivingRoom}
                      onChange={(e) => setRequireLivingRoom(e.target.checked)}
                      disabled={kitchenSizing === "kitchen-diner"}
                    />
                    <span>
                      Separate living room required
                      {kitchenSizing === "kitchen-diner" && (
                        <span className="text-muted-foreground"> (covered by diner)</span>
                      )}
                    </span>
                  </label>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium">Circulation %</label>
                      <span className="tabular-nums text-muted-foreground">{circulationPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={22}
                      step={1}
                      value={circulationPct}
                      onChange={(e) => setCirculationPct(Number(e.target.value))}
                      className="mt-1 w-full"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Hallways, landings, stairs and internal walls as % of total area.
                    </p>
                  </div>
                </div>
              )}
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
              <ReportView data={mutation.data} proposed={targetBedrooms} />
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

      {/* Capacity calculation */}
      {data.capacity && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              How we got to {data.maxCompliantBedrooms} bedrooms
            </h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                data.capacity.areaSource === "user"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {data.capacity.areaSource === "user" ? "Your area" : "Estimated area"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Total area" value={`${data.capacity.totalFloorAreaSqm.toFixed(1)} sqm`} />
            <Stat
              label="Non-bedroom"
              value={`${data.capacity.nonBedroomAllocationSqm.toFixed(1)} sqm`}
            />
            <Stat
              label="Bedroom-available"
              value={`${data.capacity.bedroomAvailableSqm.toFixed(1)} sqm`}
            />
          </div>
          {data.capacity.breakdown.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Non-bedroom allocation</th>
                    <th className="px-3 py-2 text-right font-medium">sqm</th>
                  </tr>
                </thead>
                <tbody>
                  {data.capacity.breakdown.map((b, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">{b.item}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.sqm.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.capacity.assumptions.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {data.capacity.assumptions.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}