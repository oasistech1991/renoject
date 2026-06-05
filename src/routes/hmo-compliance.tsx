import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { analyseFloorplan } from "@/lib/hmo.functions";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/btl/NumberField";
import { supabase } from "@/integrations/supabase/client";
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

type AnalysisResult = Awaited<ReturnType<typeof analyseFloorplan>>;

type SavedMeta = { id: string; label: string; createdAt: string; propertyId: string | null };

async function downscaleDataUrl(dataUrl: string, maxDim = 400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

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

  // Saved-analysis state
  const [propertiesList, setPropertiesList] = useState<{ id: string; name: string }[]>([]);
  const [label, setLabel] = useState("");
  const [attachId, setAttachId] = useState<string>(""); // "" = unattached
  const [savedMeta, setSavedMeta] = useState<SavedMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewData, setViewData] = useState<AnalysisResult | null>(null);
  const [viewMeta, setViewMeta] = useState<SavedMeta | null>(null);
  const [lastCheckAt, setLastCheckAt] = useState<Date | null>(null);

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

  // Load existing properties for the attach dropdown
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("properties")
      .select("id,name")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled && data) setPropertiesList(data as { id: string; name: string }[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate from ?analysis=<id> for read-only view
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("analysis");
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("hmo_analyses")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) return;
      const inputs = (data.inputs ?? {}) as any;
      setViewData(data.result as unknown as AnalysisResult);
      setViewMeta({
        id: data.id,
        label: data.label,
        createdAt: data.created_at,
        propertyId: data.property_id,
      });
      if (typeof inputs.location === "string") setLocation(inputs.location);
      if (typeof inputs.targetBedrooms === "number") setTargetBedrooms(inputs.targetBedrooms);
      if (typeof inputs.currentBedrooms === "number") setCurrentBedrooms(inputs.currentBedrooms);
      if (typeof inputs.storeys === "number") setStoreys(inputs.storeys);
      if (typeof inputs.occupants === "number") setOccupants(inputs.occupants);
      if (typeof inputs.notes === "string") setNotes(inputs.notes);
      if (data.thumbnail) setImageBase64(data.thumbnail);
      setFileName(data.label);
    })();
  }, []);

  // Track last check timestamp for status banner
  useEffect(() => {
    if (mutation.isSuccess || mutation.isError) {
      setLastCheckAt(new Date());
    }
  }, [mutation.isSuccess, mutation.isError]);

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

  const displayData: AnalysisResult | null = viewData ?? mutation.data ?? null;

  const resetForNew = () => {
    setViewData(null);
    setViewMeta(null);
    setSavedMeta(null);
    setSaveError(null);
    setImageBase64(null);
    setFileName("");
    mutation.reset();
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  const handleSave = async () => {
    if (!mutation.data || !imageBase64) return;
    setSaving(true);
    setSaveError(null);
    try {
      const thumb = await downscaleDataUrl(imageBase64, 400);
      const inputs = {
        location,
        targetBedrooms,
        currentBedrooms,
        storeys,
        occupants,
        notes,
        floorArea,
        areaUnit,
        scaleReference,
        bathRatio,
        kitchenSizing,
        requireLivingRoom,
        circulationPct,
      };
      const finalLabel = label.trim() || location.trim() || "HMO analysis";
      const { data, error } = await supabase
        .from("hmo_analyses")
        .insert({
          property_id: attachId || null,
          label: finalLabel,
          location: location || null,
          inputs: inputs as any,
          result: mutation.data as any,
          thumbnail: thumb,
        } as any)
        .select()
        .single();
      if (error) throw error;
      setSavedMeta({
        id: data.id,
        label: data.label,
        createdAt: data.created_at,
        propertyId: data.property_id,
      });
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save analysis");
    } finally {
      setSaving(false);
    }
  };

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
          {viewMeta && (
            <Button size="sm" variant="outline" onClick={resetForNew}>
              Run new check
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {viewMeta && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <span className="font-medium">Viewing saved analysis:</span>{" "}
            <span className="text-foreground">{viewMeta.label}</span>{" "}
            <span className="text-muted-foreground">
              · saved {new Date(viewMeta.createdAt).toLocaleString()}
            </span>
          </div>
        )}
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
            {!displayData && !mutation.isPending && (
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

            {displayData && (
              <>
                <ReportView data={displayData} proposed={targetBedrooms} />
                {mutation.data && !viewMeta && (
                  <div className="mt-6 rounded-xl border border-border bg-muted/20 p-5">
                    {savedMeta ? (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            ✓ Saved as "{savedMeta.label}"
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {savedMeta.propertyId
                              ? "Attached to property — view it in Properties."
                              : "Saved unattached — attach to a property anytime from Properties."}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setSavedMeta(null)}>
                          Save another copy
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-sm font-semibold">Save this analysis</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Attach to an existing property now, or save unattached and link it
                          later when you set the deal up.
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-medium">Label</label>
                            <input
                              type="text"
                              value={label}
                              onChange={(e) => setLabel(e.target.value)}
                              placeholder={location.trim() || "HMO analysis"}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium">Attach to</label>
                            <select
                              value={attachId}
                              onChange={(e) => setAttachId(e.target.value)}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">— Save unattached (link later) —</option>
                              {propertiesList.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {saveError && (
                          <p className="mt-2 text-xs text-destructive">{saveError}</p>
                        )}
                        <Button
                          className="mt-3"
                          size="sm"
                          disabled={saving}
                          onClick={handleSave}
                        >
                          {saving ? "Saving…" : "Save analysis"}
                        </Button>
                      </>
                    )}
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

function ReportView({
  data,
  proposed,
}: {
  data: Awaited<ReturnType<typeof analyseFloorplan>>;
  proposed: number;
}) {
  const [activeScenario, setActiveScenario] = useState<"maxSingles" | "balanced" | "maxDoubles">(
    "balanced",
  );
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

  const scenarios = data.scenarios;
  const active = scenarios?.[activeScenario];
  const scenarioMeta: { key: "maxSingles" | "balanced" | "maxDoubles"; label: string; sub: string }[] = [
    { key: "maxSingles", label: "Max singles", sub: "Most rooms" },
    { key: "balanced", label: "Balanced", sub: "Recommended" },
    { key: "maxDoubles", label: "Max doubles", sub: "Best £/room" },
  ];

  // GDV (Gross Development Value) — HMO investment valuation
  const [rentPerRoom, setRentPerRoom] = useState(600);
  const [opexPct, setOpexPct] = useState(20);
  const [yieldPct, setYieldPct] = useState(8);
  const gdvRooms = active?.bedroomCount ?? data.maxCompliantBedrooms;
  const grossMonthly = rentPerRoom * gdvRooms;
  const grossAnnual = grossMonthly * 12;
  const opex = grossAnnual * (opexPct / 100);
  const netAdjusted = grossAnnual - opex;
  const gdv = yieldPct > 0 ? netAdjusted / (yieldPct / 100) : 0;
  const fmtGBP0 = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(isFinite(n) ? n : 0);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Max compliant bedrooms (balanced)
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

      {/* Scenario comparison */}
      {scenarios && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Capacity scenarios</h3>
            <p className="text-xs text-muted-foreground">
              Three layouts fitted into the same bedroom-available area
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {scenarioMeta.map((m) => {
              const s = scenarios[m.key];
              const isActive = activeScenario === m.key;
              const tone =
                s.verdict === "PASS"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : s.verdict === "REVIEW"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-destructive/30 bg-destructive/10 text-destructive";
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setActiveScenario(m.key)}
                  className={`rounded-lg border p-3 text-left transition ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {m.label}
                    </p>
                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>
                      {s.verdict}
                    </span>
                  </div>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{s.bedroomCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.mix.singles}S / {s.mix.doubles}D · {m.sub}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, s.estRentIndex))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Rent index {s.estRentIndex}/100
                  </p>
                  {!s.physicallyAchievable && (
                    <p className="mt-2 text-[11px] text-destructive">
                      Not physically achievable — capped
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {active && (
            <div className="mt-5 space-y-4 rounded-lg border border-border bg-muted/10 p-4">
              {active.tradeoffs.length > 0 && (
                <ul className="space-y-1 text-xs text-foreground">
                  {active.tradeoffs.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}

              {active.physicalNote && !active.physicallyAchievable && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {active.physicalNote}
                </p>
              )}

              {active.rooms.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proposed layout
                  </h4>
                  <div className="mt-2 overflow-hidden rounded-md border border-border">
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
                        {active.rooms.map((r, i) => (
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

              {active.rooms.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Updated floorplan with dimensions
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scale diagram of the {scenarioMeta.find((m) => m.key === activeScenario)?.label.toLowerCase()} layout — each room sized to its sqm. Dimensions in metres.
                  </p>
                  <div className="mt-2 rounded-md border border-border bg-muted/10 p-3">
                    <UpdatedFloorplan
                      rooms={active.rooms}
                      totalAreaSqm={data.capacity?.totalFloorAreaSqm}
                    />
                  </div>
                </div>
              )}

              {active.reconfiguration.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Reconfiguration to hit this layout
                  </h4>
                  <ol className="mt-2 space-y-2">
                    {active.reconfiguration.map((step, i) => (
                      <li
                        key={i}
                        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">
                            {i + 1}. {step.change}
                          </span>
                          <ComplexityBadge complexity={step.complexity} />
                        </div>
                        {step.impact && (
                          <p className="mt-1 text-xs text-muted-foreground">{step.impact}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {active.issues.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Scenario issues
                  </h4>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {active.issues.map((iss, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{iss}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* GDV — HMO investment valuation */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Estimated GDV (HMO investment value)</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Income-based valuation using the {scenarioMeta.find((m) => m.key === activeScenario)?.label.toLowerCase()} scenario ({gdvRooms} room{gdvRooms === 1 ? "" : "s"}).
            </p>
          </div>
          <p className="text-3xl font-semibold tabular-nums">{fmtGBP0(gdv)}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <NumberField
            id="gdv-rent"
            label="Rent per room (PCM)"
            prefix="£"
            step={25}
            value={rentPerRoom}
            onChange={setRentPerRoom}
          />
          <NumberField
            id="gdv-opex"
            label="Operating costs"
            suffix="%"
            step={1}
            value={opexPct}
            onChange={setOpexPct}
            hint="Management, voids, maintenance, bills"
          />
          <NumberField
            id="gdv-yield"
            label="Investor yield"
            suffix="%"
            step={0.25}
            value={yieldPct}
            onChange={setYieldPct}
            hint="Typical HMO: 7–9%"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="px-3 py-2 text-muted-foreground">Gross monthly rent</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtGBP0(rentPerRoom)} × {gdvRooms} rooms
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {fmtGBP0(grossMonthly)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 text-muted-foreground">Gross annual income</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtGBP0(grossMonthly)} × 12
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {fmtGBP0(grossAnnual)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2 text-muted-foreground">Less operating costs</td>
                <td className="px-3 py-2 text-right tabular-nums">{opexPct}%</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-destructive">
                  −{fmtGBP0(opex)}
                </td>
              </tr>
              <tr className="border-b border-border bg-muted/20">
                <td className="px-3 py-2 font-medium">Net adjusted income</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {fmtGBP0(netAdjusted)}
                </td>
              </tr>
              <tr className="bg-primary/5">
                <td className="px-3 py-2 font-medium">Estimated GDV</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  ÷ {yieldPct}% yield
                </td>
                <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">
                  {fmtGBP0(gdv)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Capacity calculation */}
      {data.capacity && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              How we got to the bedroom-available area
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

function ComplexityBadge({
  complexity,
}: {
  complexity: "cosmetic" | "minor works" | "structural";
}) {
  const tone =
    complexity === "cosmetic"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : complexity === "minor works"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      {complexity}
    </span>
  );
}

function UpdatedFloorplan({
  rooms,
  totalAreaSqm,
}: {
  rooms: { label: string; estimatedSqm: number; compliant: boolean }[];
  totalAreaSqm?: number;
}) {
  // Approximate building footprint aspect ratio ~ 1.4:1 (typical UK terrace).
  // We pack bedroom rectangles + a single "Shared (kitchen/bath/circ)" rectangle
  // into a footprint scaled to match the property's true sqm where known.
  const bedroomSqmTotal = rooms.reduce((s, r) => s + r.estimatedSqm, 0);
  const sharedSqm = Math.max(
    0,
    (totalAreaSqm ?? bedroomSqmTotal * 1.6) - bedroomSqmTotal,
  );
  const total = bedroomSqmTotal + sharedSqm;
  // Footprint dimensions in metres (visual only)
  const ratio = 1.45;
  const footprintH = Math.sqrt(total / ratio);
  const footprintW = footprintH * ratio;

  // Simple shelf-packer: split into rows, fit rooms left-to-right until row
  // width exceeds footprint, then start new row. Each room's width in the row
  // is proportional to its sqm so heights stay uniform per row.
  type Tile = {
    label: string;
    sqm: number;
    w: number;
    h: number;
    x: number;
    y: number;
    tone: "ok" | "fail" | "shared";
  };
  const items: { label: string; sqm: number; tone: Tile["tone"] }[] = [
    ...rooms.map((r) => ({
      label: r.label,
      sqm: r.estimatedSqm,
      tone: (r.compliant ? "ok" : "fail") as Tile["tone"],
    })),
  ];
  if (sharedSqm > 0.5) {
    items.push({
      label: "Shared (kitchen / bath / circulation)",
      sqm: sharedSqm,
      tone: "shared",
    });
  }

  // Greedy row packing: aim for ~2-3 rooms per row depending on count
  const perRow = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(items.length))));
  const rows: { label: string; sqm: number; tone: Tile["tone"] }[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }

  const rowAreas = rows.map((row) => row.reduce((s, r) => s + r.sqm, 0));
  const totalArea = rowAreas.reduce((s, a) => s + a, 0);

  const tiles: Tile[] = [];
  let cursorY = 0;
  rows.forEach((row, ri) => {
    const rowAreaShare = rowAreas[ri] / totalArea;
    const rowH = footprintH * rowAreaShare;
    const rowSqm = rowAreas[ri];
    let cursorX = 0;
    row.forEach((it) => {
      const w = footprintW * (it.sqm / rowSqm);
      const h = rowH;
      tiles.push({
        label: it.label,
        sqm: it.sqm,
        w,
        h,
        x: cursorX,
        y: cursorY,
        tone: it.tone,
      });
      cursorX += w;
    });
    cursorY += rowH;
  });

  // SVG viewbox: 1m = 40 units, plus margin for dimension arrows
  const SCALE = 40;
  const PAD = 36;
  const vbW = footprintW * SCALE + PAD * 2;
  const vbH = footprintH * SCALE + PAD * 2;

  const toneFill = (t: Tile["tone"]) =>
    t === "ok"
      ? "hsl(var(--primary) / 0.10)"
      : t === "fail"
        ? "hsl(0 84% 60% / 0.12)"
        : "hsl(var(--muted-foreground) / 0.10)";
  const toneStroke = (t: Tile["tone"]) =>
    t === "ok"
      ? "hsl(var(--primary))"
      : t === "fail"
        ? "hsl(0 84% 60%)"
        : "hsl(var(--muted-foreground))";

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className="h-auto w-full"
      style={{ maxHeight: 520 }}
      role="img"
      aria-label="Updated floorplan with room dimensions"
    >
      {/* Footprint outline */}
      <rect
        x={PAD}
        y={PAD}
        width={footprintW * SCALE}
        height={footprintH * SCALE}
        fill="hsl(var(--background))"
        stroke="hsl(var(--foreground))"
        strokeWidth={2}
      />

      {/* Overall dimension labels */}
      <text
        x={PAD + (footprintW * SCALE) / 2}
        y={PAD - 12}
        textAnchor="middle"
        fontSize={12}
        fill="hsl(var(--foreground))"
        fontWeight={600}
      >
        {footprintW.toFixed(1)} m
      </text>
      <text
        x={PAD - 12}
        y={PAD + (footprintH * SCALE) / 2}
        textAnchor="middle"
        fontSize={12}
        fill="hsl(var(--foreground))"
        fontWeight={600}
        transform={`rotate(-90 ${PAD - 12} ${PAD + (footprintH * SCALE) / 2})`}
      >
        {footprintH.toFixed(1)} m
      </text>

      {/* Room tiles */}
      {tiles.map((t, i) => {
        const x = PAD + t.x * SCALE;
        const y = PAD + t.y * SCALE;
        const w = t.w * SCALE;
        const h = t.h * SCALE;
        const cx = x + w / 2;
        const cy = y + h / 2;
        // Approx side lengths from sqm assuming room aspect ~1.25
        const roomH = Math.sqrt(t.sqm / 1.25);
        const roomW = roomH * 1.25;
        const minSide = Math.min(w, h);
        return (
          <g key={i}>
            <rect
              x={x + 1}
              y={y + 1}
              width={Math.max(0, w - 2)}
              height={Math.max(0, h - 2)}
              fill={toneFill(t.tone)}
              stroke={toneStroke(t.tone)}
              strokeWidth={1.25}
            />
            {minSide > 38 && (
              <>
                <text
                  x={cx}
                  y={cy - 8}
                  textAnchor="middle"
                  fontSize={Math.min(13, minSide / 5)}
                  fontWeight={600}
                  fill="hsl(var(--foreground))"
                >
                  {t.label}
                </text>
                <text
                  x={cx}
                  y={cy + 8}
                  textAnchor="middle"
                  fontSize={Math.min(11, minSide / 6)}
                  fill="hsl(var(--muted-foreground))"
                >
                  {t.sqm.toFixed(1)} m² · {roomW.toFixed(1)} × {roomH.toFixed(1)} m
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}