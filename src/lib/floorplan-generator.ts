// Deterministic schematic HMO floorplan generator.
// Takes total internal floor area + amenity prefs and outputs:
//   - capacity breakdown (non-bedroom allocation, bedroom-available area)
//   - three scenarios (max singles / balanced / max doubles)
//   - per-storey list of placed rectangles laid out via squarified treemap
//
// Pure functions, no IO. All areas in sqm.

export type RoomType =
  | "bedroom-single"
  | "bedroom-double"
  | "kitchen"
  | "kitchen-diner"
  | "bathroom"
  | "living"
  | "stair"
  | "circulation";

export interface Room {
  id: string;
  label: string;
  sqm: number;
  type: RoomType;
}

export interface PlacedRect extends Room {
  /** normalised [0,1] coords within the floor rectangle */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FloorPlan {
  storey: number; // 1-indexed; 1 = ground floor
  label: string;
  widthM: number;
  heightM: number;
  rooms: PlacedRect[];
}

export interface CapacityBreakdownItem {
  item: string;
  sqm: number;
}

export interface Capacity {
  totalFloorAreaSqm: number;
  nonBedroomAllocationSqm: number;
  bedroomAvailableSqm: number;
  breakdown: CapacityBreakdownItem[];
  assumptions: string[];
}

export interface Scenario {
  key: "maxSingles" | "balanced" | "maxDoubles";
  bedroomCount: number;
  mix: { singles: number; doubles: number };
  estRentIndex: number; // 0-100 relative
  tradeoffs: string[];
}

export interface GenerateInput {
  totalFloorAreaSqm: number;
  storeys: number;
  targetBedrooms: number;
  occupants: number;
  bathRatio: 3 | 4 | 5;
  kitchenSizing: "standard" | "kitchen-diner" | "large";
  requireLivingRoom: boolean;
  circulationPct: number; // 12-22
}

export interface GenerateResult {
  capacity: Capacity;
  scenarios: Record<"maxSingles" | "balanced" | "maxDoubles", Scenario>;
  maxCompliantBedrooms: number;
  floors: FloorPlan[];
  warnings: string[];
}

const SINGLE_TARGET = 8; // realistic single (min 6.51)
const DOUBLE_TARGET = 11.5; // realistic double (min 10.22)
const BATHROOM_SQM = 4;
const STAIR_SQM = 3.5;
const LIVING_SQM = 12;
const WALL_LOSS = 0.9; // 10% lost to internal walls

function kitchenSqm(sizing: GenerateInput["kitchenSizing"]): number {
  switch (sizing) {
    case "standard":
      return 9.5;
    case "kitchen-diner":
      return 14;
    case "large":
      return 12.5;
  }
}

function kitchenLabel(sizing: GenerateInput["kitchenSizing"]): string {
  switch (sizing) {
    case "standard":
      return "Kitchen";
    case "kitchen-diner":
      return "Kitchen / diner";
    case "large":
      return "Large kitchen";
  }
}

export function computeCapacity(input: GenerateInput): Capacity {
  const breakdown: CapacityBreakdownItem[] = [];
  const assumptions: string[] = [];

  const kSqm = kitchenSqm(input.kitchenSizing);
  breakdown.push({ item: kitchenLabel(input.kitchenSizing), sqm: kSqm });

  const bathCount = Math.max(1, Math.ceil(input.occupants / input.bathRatio));
  breakdown.push({ item: `${bathCount}× bathroom/WC`, sqm: bathCount * BATHROOM_SQM });
  assumptions.push(`1 bath/WC per ${input.bathRatio} occupants → ${bathCount} units`);

  const hasLiving = input.requireLivingRoom && input.kitchenSizing !== "kitchen-diner";
  if (hasLiving) {
    breakdown.push({ item: "Living room", sqm: LIVING_SQM });
  } else if (input.kitchenSizing === "kitchen-diner") {
    assumptions.push("Kitchen-diner covers communal eating — no separate living room");
  }

  if (input.storeys > 1) {
    breakdown.push({ item: `Stair core ×${input.storeys}`, sqm: STAIR_SQM * input.storeys });
  }

  const circulation = input.totalFloorAreaSqm * (input.circulationPct / 100);
  breakdown.push({ item: `Circulation (${input.circulationPct}%)`, sqm: circulation });
  assumptions.push(`Circulation set at ${input.circulationPct}% of total internal area`);
  assumptions.push(
    "10% loss applied to bedroom-available area for internal walls between rooms",
  );

  const nonBedroom = breakdown.reduce((s, b) => s + b.sqm, 0);
  const bedroomAvailable = Math.max(0, input.totalFloorAreaSqm - nonBedroom);

  return {
    totalFloorAreaSqm: input.totalFloorAreaSqm,
    nonBedroomAllocationSqm: nonBedroom,
    bedroomAvailableSqm: bedroomAvailable,
    breakdown,
    assumptions,
  };
}

function rentIndex(singles: number, doubles: number): number {
  // singles ~ £500pcm, doubles ~ £650pcm — relative weighting
  return singles * 500 + doubles * 650;
}

export function computeScenarios(
  capacity: Capacity,
  targetBedrooms: number,
): GenerateResult["scenarios"] & { maxIndex: number } {
  const usable = capacity.bedroomAvailableSqm * WALL_LOSS;

  // maxSingles: all 8 sqm singles
  const sCount = Math.max(0, Math.floor(usable / SINGLE_TARGET));
  const maxSingles: Scenario = {
    key: "maxSingles",
    bedroomCount: sCount,
    mix: { singles: sCount, doubles: 0 },
    estRentIndex: 0,
    tradeoffs: [
      "Maximises lettable room count and total monthly rent",
      "Lower £/room — typically student or low-budget tenants",
    ],
  };

  // maxDoubles: all doubles
  const dCount = Math.max(0, Math.floor(usable / DOUBLE_TARGET));
  const maxDoubles: Scenario = {
    key: "maxDoubles",
    bedroomCount: dCount,
    mix: { singles: 0, doubles: dCount },
    estRentIndex: 0,
    tradeoffs: [
      "Higher £/room and lower tenant turnover",
      "Fewer total rooms — lower gross monthly rent",
    ],
  };

  // balanced: aim for targetBedrooms by mixing singles + doubles
  // Solve for s + d = target, 8s + 11.5d = usable (maximising d)
  const target = Math.max(0, targetBedrooms);
  let bestS = 0;
  let bestD = 0;
  let bestCount = 0;
  // Try every (s,d) where s+d<=ceiling, find the largest s+d that fits AND
  // prefer the mix that lands closest to `target` while maximising doubles.
  const maxRooms = sCount; // upper bound = max singles
  let bestScore = -Infinity;
  for (let d = 0; d <= dCount; d++) {
    const remaining = usable - d * DOUBLE_TARGET;
    if (remaining < 0) break;
    const s = Math.max(0, Math.floor(remaining / SINGLE_TARGET));
    const count = s + d;
    if (count > maxRooms + 1) continue;
    // score: prefer count == target, then more doubles
    const targetPenalty = Math.abs(count - target);
    const score = -targetPenalty * 1000 + d * 10 + count;
    if (score > bestScore) {
      bestScore = score;
      bestS = s;
      bestD = d;
      bestCount = count;
    }
  }
  const balanced: Scenario = {
    key: "balanced",
    bedroomCount: bestCount,
    mix: { singles: bestS, doubles: bestD },
    estRentIndex: 0,
    tradeoffs:
      bestCount >= target
        ? [`Hits your target of ${target} bedrooms`, "Realistic mix UK councils will licence"]
        : [
            `Floor area only supports ${bestCount} bedrooms vs your target of ${target}`,
            "Increase total area, lower amenity overhead, or accept smaller mix",
          ],
  };

  const indices = [
    rentIndex(maxSingles.mix.singles, maxSingles.mix.doubles),
    rentIndex(balanced.mix.singles, balanced.mix.doubles),
    rentIndex(maxDoubles.mix.singles, maxDoubles.mix.doubles),
  ];
  const maxIdx = Math.max(1, ...indices);
  maxSingles.estRentIndex = Math.round((indices[0]! / maxIdx) * 100);
  balanced.estRentIndex = Math.round((indices[1]! / maxIdx) * 100);
  maxDoubles.estRentIndex = Math.round((indices[2]! / maxIdx) * 100);

  return { maxSingles, balanced, maxDoubles, maxIndex: maxIdx };
}

// -----------------------------------------------------------
// Layout: squarified treemap
// -----------------------------------------------------------

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function worst(row: number[], w: number, totalArea: number, container: number): number {
  if (row.length === 0) return Infinity;
  const s = row.reduce((a, b) => a + b, 0);
  const scale = (container * s) / totalArea;
  const rowW = scale; // along the shorter side
  const max = Math.max(...row);
  const min = Math.min(...row);
  // worst aspect ratio in the row
  const a = (w * w * max) / (s * s);
  const b = (s * s) / (w * w * min);
  return Math.max(a, b);
  // (container/totalArea unused intentionally — classical formula uses w & s)
}

/**
 * Squarified treemap. Returns rects within container, in same order as input.
 * Areas are normalised to sum of container.w*container.h.
 */
function squarify(items: number[], container: Rect): Rect[] {
  const total = items.reduce((a, b) => a + b, 0);
  if (total <= 0) return items.map(() => ({ x: container.x, y: container.y, w: 0, h: 0 }));
  const containerArea = container.w * container.h;
  const scaled = items.map((v) => (v / total) * containerArea);

  const result: Rect[] = new Array(items.length);
  const indices: number[] = scaled.map((_, i) => i);
  // Sort indices by descending area for layout, but remember original positions
  indices.sort((a, b) => scaled[b]! - scaled[a]!);

  let rect = { ...container };
  let i = 0;

  while (i < indices.length) {
    const shortSide = Math.min(rect.w, rect.h);
    if (shortSide <= 0) break;
    const row: number[] = [];
    const rowIdx: number[] = [];
    while (i < indices.length) {
      const idx = indices[i]!;
      const v = scaled[idx]!;
      const next = [...row, v];
      const cur = worst(row, shortSide, total, containerArea);
      const nxt = worst(next, shortSide, total, containerArea);
      if (row.length === 0 || nxt <= cur) {
        row.push(v);
        rowIdx.push(idx);
        i++;
      } else {
        break;
      }
    }
    // Lay row out along the shorter axis
    const rowSum = row.reduce((a, b) => a + b, 0);
    if (rect.w <= rect.h) {
      // place row across the top
      const rowH = rowSum / rect.w;
      let xCursor = rect.x;
      for (let k = 0; k < row.length; k++) {
        const w = row[k]! / rowH;
        result[rowIdx[k]!] = { x: xCursor, y: rect.y, w, h: rowH };
        xCursor += w;
      }
      rect = { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH };
    } else {
      // place row down the left
      const rowW = rowSum / rect.h;
      let yCursor = rect.y;
      for (let k = 0; k < row.length; k++) {
        const h = row[k]! / rowW;
        result[rowIdx[k]!] = { x: rect.x, y: yCursor, w: rowW, h };
        yCursor += h;
      }
      rect = { x: rect.x + rowW, y: rect.y, w: rect.w - rowW, h: rect.h };
    }
  }
  return result;
}

// -----------------------------------------------------------
// Floor assignment & generation
// -----------------------------------------------------------

export function generateFloorplan(input: GenerateInput): GenerateResult {
  const warnings: string[] = [];
  const capacity = computeCapacity(input);
  const scenarios = computeScenarios(capacity, input.targetBedrooms);

  if (capacity.bedroomAvailableSqm <= 0) {
    warnings.push("No bedroom-available area — amenity overhead exceeds total floor area.");
  }

  const balanced = scenarios.balanced;
  const totalBedrooms = balanced.bedroomCount;
  if (totalBedrooms < input.targetBedrooms) {
    warnings.push(
      `Floor area only supports ${totalBedrooms} compliant bedrooms — you asked for ${input.targetBedrooms}.`,
    );
  }

  // Build a list of all rooms in the building
  const bedrooms: Room[] = [];
  for (let i = 0; i < balanced.mix.doubles; i++) {
    bedrooms.push({
      id: `bd-d${i + 1}`,
      label: `Double ${i + 1}`,
      sqm: DOUBLE_TARGET,
      type: "bedroom-double",
    });
  }
  for (let i = 0; i < balanced.mix.singles; i++) {
    bedrooms.push({
      id: `bd-s${i + 1}`,
      label: `Single ${i + 1}`,
      sqm: SINGLE_TARGET,
      type: "bedroom-single",
    });
  }

  const bathCount = Math.max(1, Math.ceil(input.occupants / input.bathRatio));
  const baths: Room[] = Array.from({ length: bathCount }, (_, i) => ({
    id: `bath-${i + 1}`,
    label: `Bath ${i + 1}`,
    sqm: BATHROOM_SQM,
    type: "bathroom",
  }));

  const kitchen: Room = {
    id: "kitchen",
    label: kitchenLabel(input.kitchenSizing),
    sqm: kitchenSqm(input.kitchenSizing),
    type: input.kitchenSizing === "kitchen-diner" ? "kitchen-diner" : "kitchen",
  };
  const hasLiving = input.requireLivingRoom && input.kitchenSizing !== "kitchen-diner";
  const living: Room | null = hasLiving
    ? { id: "living", label: "Living room", sqm: LIVING_SQM, type: "living" }
    : null;

  // Per-storey area = total / storeys (assume same footprint each floor)
  const storeys = Math.max(1, Math.floor(input.storeys));
  const perStoreyArea = input.totalFloorAreaSqm / storeys;
  // Footprint slightly wider than deep (1.3:1) for a realistic terrace
  const ratio = 1.3;
  const heightM = Math.sqrt(perStoreyArea / ratio);
  const widthM = heightM * ratio;

  // Assign rooms to floors:
  //   storeys === 1 → everything on ground
  //   storeys >= 2  → all communal on ground; bedrooms distributed across upper floors,
  //                   spilling onto ground if needed; one bathroom per floor that has bedrooms
  const floorRoomLists: Room[][] = Array.from({ length: storeys }, () => []);

  if (storeys === 1) {
    floorRoomLists[0]!.push(kitchen);
    if (living) floorRoomLists[0]!.push(living);
    baths.forEach((b) => floorRoomLists[0]!.push(b));
    bedrooms.forEach((r) => floorRoomLists[0]!.push(r));
  } else {
    // Ground: kitchen + living + 1 bathroom + stair
    floorRoomLists[0]!.push(kitchen);
    if (living) floorRoomLists[0]!.push(living);
    floorRoomLists[0]!.push(baths[0]!);
    floorRoomLists[0]!.push({
      id: "stair-0",
      label: "Stairs",
      sqm: STAIR_SQM,
      type: "stair",
    });

    // Distribute remaining baths to upper floors round-robin
    const upperFloors = storeys - 1;
    for (let i = 1; i < baths.length; i++) {
      const floor = 1 + ((i - 1) % upperFloors);
      floorRoomLists[floor]!.push(baths[i]!);
    }

    // Stair core on each upper floor
    for (let f = 1; f < storeys; f++) {
      floorRoomLists[f]!.push({
        id: `stair-${f}`,
        label: "Stairs",
        sqm: STAIR_SQM,
        type: "stair",
      });
    }

    // Distribute bedrooms — fill upper floors first (largest first), spill to ground
    const sorted = [...bedrooms].sort((a, b) => b.sqm - a.sqm);
    const upperCapacity = upperFloors;
    let f = 1;
    for (const room of sorted) {
      floorRoomLists[f]!.push(room);
      f++;
      if (f >= storeys) f = 1; // wrap upper floors
    }
    // Note: this round-robin approach spreads bedrooms evenly across upper floors.
    void upperCapacity;
  }

  // Squarify each floor and emit FloorPlan objects
  const floors: FloorPlan[] = floorRoomLists.map((rooms, idx) => {
    // Inject a fake "circulation/landing" sliver equal to circulationPct of floor area
    const circulationSqm = perStoreyArea * (input.circulationPct / 100);
    const enriched: Room[] = [
      ...rooms,
      {
        id: `circ-${idx}`,
        label: idx === 0 ? "Hall" : "Landing",
        sqm: Math.max(2, circulationSqm),
        type: "circulation",
      },
    ];

    // Container in normalised coords [0,1]
    const container: Rect = { x: 0, y: 0, w: 1, h: 1 };
    const areas = enriched.map((r) => r.sqm);
    const rects = squarify(areas, container);

    const placed: PlacedRect[] = enriched.map((r, i) => ({
      ...r,
      x: rects[i]!.x,
      y: rects[i]!.y,
      w: rects[i]!.w,
      h: rects[i]!.h,
    }));

    return {
      storey: idx + 1,
      label:
        storeys === 1
          ? "Ground floor"
          : idx === 0
            ? "Ground floor"
            : idx === storeys - 1 && storeys > 2
              ? "Top floor"
              : `Floor ${idx + 1}`,
      widthM,
      heightM,
      rooms: placed,
    };
  });

  const maxCompliant = Math.max(
    scenarios.balanced.bedroomCount,
    scenarios.maxSingles.bedroomCount,
  );

  return {
    capacity,
    scenarios: {
      maxSingles: scenarios.maxSingles,
      balanced: scenarios.balanced,
      maxDoubles: scenarios.maxDoubles,
    },
    maxCompliantBedrooms: maxCompliant,
    floors,
    warnings,
  };
}

export const ROOM_COLORS: Record<RoomType, { fill: string; stroke: string; text: string }> = {
  "bedroom-single": {
    fill: "color-mix(in oklab, var(--primary) 14%, var(--card))",
    stroke: "color-mix(in oklab, var(--primary) 45%, transparent)",
    text: "var(--foreground)",
  },
  "bedroom-double": {
    fill: "color-mix(in oklab, var(--primary) 26%, var(--card))",
    stroke: "color-mix(in oklab, var(--primary) 55%, transparent)",
    text: "var(--foreground)",
  },
  kitchen: {
    fill: "color-mix(in oklab, var(--chart-2) 25%, var(--card))",
    stroke: "color-mix(in oklab, var(--chart-2) 60%, transparent)",
    text: "var(--foreground)",
  },
  "kitchen-diner": {
    fill: "color-mix(in oklab, var(--chart-2) 30%, var(--card))",
    stroke: "color-mix(in oklab, var(--chart-2) 60%, transparent)",
    text: "var(--foreground)",
  },
  bathroom: {
    fill: "color-mix(in oklab, var(--chart-4) 25%, var(--card))",
    stroke: "color-mix(in oklab, var(--chart-4) 55%, transparent)",
    text: "var(--foreground)",
  },
  living: {
    fill: "color-mix(in oklab, var(--chart-3) 25%, var(--card))",
    stroke: "color-mix(in oklab, var(--chart-3) 55%, transparent)",
    text: "var(--foreground)",
  },
  stair: {
    fill: "color-mix(in oklab, var(--muted-foreground) 20%, var(--card))",
    stroke: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
    text: "var(--foreground)",
  },
  circulation: {
    fill: "color-mix(in oklab, var(--muted) 80%, var(--background))",
    stroke: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
    text: "var(--muted-foreground)",
  },
};