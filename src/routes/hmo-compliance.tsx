import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/btl/NumberField";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  generateFloorplan,
  ROOM_COLORS,
  type FloorPlan,
  type GenerateInput,
  type PlacedRect,
} from "@/lib/floorplan-generator";

export const Route = createFileRoute("/hmo-compliance")({
  head: () => ({
    meta: [
      { title: "HMO Floorplan Generator" },
      {
        name: "description",
        content:
          "Generate a compliant UK HMO floorplan from your total floor area, storeys and amenity requirements — with capacity scenarios and GDV.",
      },
      { property: "og:title", content: "HMO Floorplan Generator" },
      {
        property: "og:description",
        content:
          "Synthesises a schematic HMO floorplan from your inputs and shows what's compliant under UK rules.",
      },
    ],
  }),
  component: HMOCompliancePage,
});

function HMOCompliancePage() {
  // Inputs (user said: total floor area + storeys is the input set)
  const [floorArea, setFloorArea] = useState<string>("140");
  const [areaUnit, setAreaUnit] = useState<"sqm" | "sqft">("sqm");
  const [storeys, setStoreys] = useState(2);
  const [targetBedrooms, setTargetBedrooms] = useState(5);
  const [occupants, setOccupants] = useState(5);
  const [bathRatio, setBathRatio] = useState<3 | 4 | 5>(5);
  const [kitchenSizing, setKitchenSizing] = useState<
    "standard" | "kitchen-diner" | "large"
  >("kitchen-diner");
  const [requireLivingRoom, setRequireLivingRoom] = useState(false);
  const [circulationPct, setCirculationPct] = useState(17);
  const [showAmenity, setShowAmenity] = useState(false);

  const input: GenerateInput | null = useMemo(() => {
    const parsed = parseFloat(floorArea);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const totalFloorAreaSqm = areaUnit === "sqft" ? parsed * 0.092903 : parsed;
    return {
      totalFloorAreaSqm,
      storeys: Math.max(1, Math.floor(storeys)),
      targetBedrooms: Math.max(1, Math.floor(targetBedrooms)),
      occupants: Math.max(1, Math.floor(occupants)),
      bathRatio,
      kitchenSizing,
      requireLivingRoom,
      circulationPct,
    };
  }, [
    floorArea,
    areaUnit,
    storeys,
    targetBedrooms,
    occupants,
    bathRatio,
    kitchenSizing,
    requireLivingRoom,
    circulationPct,
  ]);

  const result = useMemo(() => (input ? generateFloorplan(input) : null), [input]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              H
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                HMO Floorplan Generator
              </h1>
              <p className="text-xs text-muted-foreground">
                Generate a compliant schematic plan from your area & requirements
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
              <label className="text-sm font-medium">Total floor area</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={floorArea}
                  onChange={(e) => setFloorArea(e.target.value)}
                  placeholder="e.g. 140"
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
                Total internal floor area across all storeys.
              </p>
            </div>

            <NumberField
              id="storeys"
              label="Storeys"
              value={storeys}
              onChange={setStoreys}
              step={1}
              hint="Bedrooms get distributed across upper floors first"
            />

            <NumberField
              id="target-beds"
              label="Target HMO bedrooms"
              value={targetBedrooms}
              onChange={setTargetBedrooms}
              step={1}
              hint="Generator tries to hit this — caps at what fits"
            />

            <NumberField
              id="occ"
              label="Occupants"
              value={occupants}
              onChange={setOccupants}
              step={1}
            />

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
                      onChange={(e) =>
                        setBathRatio(Number(e.target.value) as 3 | 4 | 5)
                      }
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
                        setKitchenSizing(
                          e.target.value as "standard" | "kitchen-diner" | "large",
                        )
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="standard">Standard kitchen (~9.5 sqm)</option>
                      <option value="kitchen-diner">Kitchen-diner combined (~14 sqm)</option>
                      <option value="large">Large kitchen (~12.5 sqm)</option>
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
                      <span className="tabular-nums text-muted-foreground">
                        {circulationPct}%
                      </span>
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

            {!input && (
              <p className="text-xs text-destructive">
                Enter a valid total floor area to generate a plan.
              </p>
            )}
          </section>

          {/* Output */}
          <section className="space-y-5">
            {result && input && (
              <ResultView result={result} input={input} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ResultView({
  result,
  input,
}: {
  result: ReturnType<typeof generateFloorplan>;
  input: GenerateInput;
}) {
  const { capacity, scenarios, floors, warnings } = result;
  const balanced = scenarios.balanced;
  const verdict: "PASS" | "REVIEW" | "FAIL" =
    balanced.bedroomCount >= input.targetBedrooms
      ? "PASS"
      : balanced.bedroomCount >= input.targetBedrooms - 1
        ? "REVIEW"
        : "FAIL";
  const verdictTone =
    verdict === "PASS"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : verdict === "REVIEW"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";

  // GDV
  const [rentPerRoom, setRentPerRoom] = useState(600);
  const [opexPct, setOpexPct] = useState(20);
  const [yieldPct, setYieldPct] = useState(8);
  const grossMonthly = rentPerRoom * balanced.bedroomCount;
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
    <>
      {/* Hero */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Generated bedrooms (balanced)
            </p>
            <p className="mt-1 text-5xl font-semibold tracking-tight text-foreground">
              {balanced.bedroomCount}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {balanced.mix.singles} single · {balanced.mix.doubles} double · target{" "}
              {input.targetBedrooms}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${verdictTone}`}
          >
            {verdict}
          </span>
        </div>
        {warnings.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-amber-700 dark:text-amber-300">
            {warnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Generated floorplans */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Generated floorplan</h3>
          <p className="text-xs text-muted-foreground">
            Schematic — ~{floors[0]?.widthM.toFixed(1)}m × {floors[0]?.heightM.toFixed(1)}m per
            storey
          </p>
        </div>
        <Legend />
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {floors.map((f) => (
            <FloorSVG key={f.storey} floor={f} />
          ))}
        </div>
      </div>

      {/* Scenario summary */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Capacity scenarios</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Three layouts fitted into the same bedroom-available area
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(["maxSingles", "balanced", "maxDoubles"] as const).map((key) => {
            const s = scenarios[key];
            const label =
              key === "maxSingles"
                ? "Max singles"
                : key === "balanced"
                  ? "Balanced"
                  : "Max doubles";
            const sub =
              key === "maxSingles"
                ? "Most rooms"
                : key === "balanced"
                  ? "Recommended"
                  : "Best £/room";
            return (
              <div
                key={key}
                className={`rounded-lg border p-3 ${
                  key === "balanced"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-muted/20"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{s.bedroomCount}</p>
                <p className="text-xs text-muted-foreground">
                  {s.mix.singles}S / {s.mix.doubles}D · {sub}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.max(0, Math.min(100, s.estRentIndex))}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Rent index {s.estRentIndex}/100
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {s.tradeoffs.map((t, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* GDV */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Estimated GDV (HMO investment value)</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Income-based valuation using the balanced scenario ({balanced.bedroomCount}{" "}
              room{balanced.bedroomCount === 1 ? "" : "s"}).
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
                  {fmtGBP0(rentPerRoom)} × {balanced.bedroomCount} rooms
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
      <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-5">
        <AccordionItem value="capacity" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold">
            How we got to the bedroom-available area
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat
                label="Total area"
                value={`${capacity.totalFloorAreaSqm.toFixed(1)} sqm`}
              />
              <Stat
                label="Non-bedroom"
                value={`${capacity.nonBedroomAllocationSqm.toFixed(1)} sqm`}
              />
              <Stat
                label="Bedroom-available"
                value={`${capacity.bedroomAvailableSqm.toFixed(1)} sqm`}
              />
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      Non-bedroom allocation
                    </th>
                    <th className="px-3 py-2 text-right font-medium">sqm</th>
                  </tr>
                </thead>
                <tbody>
                  {capacity.breakdown.map((b, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">{b.item}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {b.sqm.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {capacity.assumptions.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
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

function Legend() {
  const items: { label: string; type: keyof typeof ROOM_COLORS }[] = [
    { label: "Double", type: "bedroom-double" },
    { label: "Single", type: "bedroom-single" },
    { label: "Kitchen", type: "kitchen" },
    { label: "Living", type: "living" },
    { label: "Bath", type: "bathroom" },
    { label: "Stairs", type: "stair" },
    { label: "Hall", type: "circulation" },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <div key={i.type} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm border"
            style={{
              background: ROOM_COLORS[i.type].fill,
              borderColor: ROOM_COLORS[i.type].stroke,
            }}
          />
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function FloorSVG({ floor }: { floor: FloorPlan }) {
  // Render at fixed pixel size, preserve aspect from widthM × heightM
  const targetW = 480;
  const aspect = floor.widthM / floor.heightM;
  const W = targetW;
  const H = Math.round(targetW / aspect);
  const PAD = 6;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {floor.label}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {floor.widthM.toFixed(1)} × {floor.heightM.toFixed(1)} m
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-md border border-border bg-background"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Building outline */}
        <rect
          x={PAD / 2}
          y={PAD / 2}
          width={W - PAD}
          height={H - PAD}
          fill="var(--card)"
          stroke="var(--foreground)"
          strokeWidth={2}
        />
        {floor.rooms.map((r) => (
          <RoomRect key={r.id} room={r} W={W - PAD} H={H - PAD} ox={PAD / 2} oy={PAD / 2} />
        ))}
      </svg>
    </div>
  );
}

function RoomRect({
  room,
  W,
  H,
  ox,
  oy,
}: {
  room: PlacedRect;
  W: number;
  H: number;
  ox: number;
  oy: number;
}) {
  const x = ox + room.x * W;
  const y = oy + room.y * H;
  const w = room.w * W;
  const h = room.h * H;
  const colors = ROOM_COLORS[room.type];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const showLabel = w > 50 && h > 28;
  const showSqm = w > 60 && h > 42;
  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, w - 2)}
        height={Math.max(0, h - 2)}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1}
        rx={2}
      />
      {showLabel && (
        <text
          x={cx}
          y={showSqm ? cy - 4 : cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={500}
          fill={colors.text}
          style={{ pointerEvents: "none" }}
        >
          {room.label}
        </text>
      )}
      {showSqm && (
        <text
          x={cx}
          y={cy + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="var(--muted-foreground)"
          style={{ pointerEvents: "none" }}
        >
          {room.sqm.toFixed(1)} m²
        </text>
      )}
    </g>
  );
}
