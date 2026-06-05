// Mock UK property listings for the Market Search tab.
// Swap-point: replace `MOCK_LISTINGS` with a fetch from PropertyData / saved Rightmove URLs.

export type ListingType = "sale" | "auction" | "repossession" | "probate";
export type PropertyType = "terraced" | "semi" | "detached" | "flat" | "bungalow";
export type Condition = "turnkey" | "light" | "heavy";

export interface Listing {
  id: string;
  address: string;
  postcode: string;
  town: string;
  lat: number;
  lng: number;
  price: number;
  guidePrice?: number;
  beds: number;
  baths: number;
  sqft: number;
  propertyType: PropertyType;
  tenure: "freehold" | "leasehold";
  epc: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  listingType: ListingType;
  daysOnMarket: number;
  photos: string[];
  description: string;
  agent: string;
  sourceUrl: string;
  article4: boolean;
  hmoRoomsPotential: number;
  condition: Condition;
  refurbEstimate: number;
  postcodeMedianPrice: number;
  avgRoomRent: number; // £/room/month
  avgBtlRent: number; // £/month single-let
}

// Photo pool (Unsplash) — keyed so different listings reuse but mix
const P = (id: string) => `https://images.unsplash.com/${id}?w=800&q=70&auto=format&fit=crop`;
const PHOTOS = [
  P("photo-1568605114967-8130f3a36994"),
  P("photo-1570129477492-45c003edd2be"),
  P("photo-1564013799919-ab600027ffc6"),
  P("photo-1572120360610-d971b9d7767c"),
  P("photo-1605276374104-dee2a0ed3cd6"),
  P("photo-1582268611958-ebfd161ef9cf"),
  P("photo-1600585154340-be6161a56a0c"),
  P("photo-1502672260266-1c1ef2d93688"),
  P("photo-1512917774080-9991f1c4c750"),
  P("photo-1493809842364-78817add7ffb"),
];
const pick = (i: number, n = 3) =>
  Array.from({ length: n }, (_, k) => PHOTOS[(i * 7 + k * 3) % PHOTOS.length]);

type Seed = Partial<Listing> & {
  address: string;
  postcode: string;
  town: string;
  lat: number;
  lng: number;
  price: number;
  beds: number;
  sqft: number;
};

const SEEDS: Seed[] = [
  // Manchester (M14 — Article 4)
  { address: "12 Acomb St", postcode: "M14 5AT", town: "Manchester", lat: 53.4509, lng: -2.2207, price: 245000, beds: 4, sqft: 1180, propertyType: "terraced", article4: true, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 575, avgBtlRent: 1450, postcodeMedianPrice: 270000, listingType: "sale" },
  { address: "47 Wilbraham Rd", postcode: "M14 7DR", town: "Manchester", lat: 53.4452, lng: -2.2349, price: 295000, beds: 5, sqft: 1450, propertyType: "semi", article4: true, hmoRoomsPotential: 6, condition: "heavy", refurbEstimate: 42000, avgRoomRent: 600, avgBtlRent: 1600, postcodeMedianPrice: 320000, listingType: "auction", guidePrice: 245000 },
  { address: "9 Clarendon Rd", postcode: "M16 8QX", town: "Manchester", lat: 53.4569, lng: -2.2754, price: 210000, beds: 3, sqft: 980, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "turnkey", avgRoomRent: 525, avgBtlRent: 1250, postcodeMedianPrice: 235000, listingType: "sale" },
  { address: "21 Platt Lane", postcode: "M14 7FB", town: "Manchester", lat: 53.4493, lng: -2.2310, price: 275000, beds: 4, sqft: 1300, propertyType: "terraced", article4: true, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 590, avgBtlRent: 1500, postcodeMedianPrice: 300000, listingType: "sale" },

  // Liverpool (L7 / L15 — high yields)
  { address: "33 Smithdown Rd", postcode: "L15 3JJ", town: "Liverpool", lat: 53.3915, lng: -2.9342, price: 145000, beds: 4, sqft: 1100, propertyType: "terraced", article4: false, hmoRoomsPotential: 5, condition: "heavy", refurbEstimate: 35000, avgRoomRent: 475, avgBtlRent: 1050, postcodeMedianPrice: 165000, listingType: "auction", guidePrice: 110000 },
  { address: "8 Wavertree Rd", postcode: "L7 1PH", town: "Liverpool", lat: 53.4087, lng: -2.9573, price: 125000, beds: 3, sqft: 920, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "light", avgRoomRent: 450, avgBtlRent: 900, postcodeMedianPrice: 140000, listingType: "sale" },
  { address: "62 Lawrence Rd", postcode: "L15 0EE", town: "Liverpool", lat: 53.3942, lng: -2.9281, price: 160000, beds: 4, sqft: 1150, propertyType: "terraced", article4: false, hmoRoomsPotential: 5, condition: "turnkey", avgRoomRent: 480, avgBtlRent: 1100, postcodeMedianPrice: 170000, listingType: "sale" },
  { address: "14 Garmoyle Rd", postcode: "L15 3JE", town: "Liverpool", lat: 53.3897, lng: -2.9389, price: 99000, beds: 3, sqft: 880, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "heavy", refurbEstimate: 38000, avgRoomRent: 460, avgBtlRent: 850, postcodeMedianPrice: 135000, listingType: "repossession" },

  // Sheffield (S2 / S7 / S10)
  { address: "5 Pinstone St", postcode: "S2 4SW", town: "Sheffield", lat: 53.3700, lng: -1.4636, price: 165000, beds: 3, sqft: 1000, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "light", avgRoomRent: 460, avgBtlRent: 950, postcodeMedianPrice: 180000, listingType: "sale" },
  { address: "19 Sharrow Vale Rd", postcode: "S11 8ZF", town: "Sheffield", lat: 53.3725, lng: -1.4980, price: 235000, beds: 4, sqft: 1280, propertyType: "semi", article4: false, hmoRoomsPotential: 5, condition: "turnkey", avgRoomRent: 510, avgBtlRent: 1250, postcodeMedianPrice: 245000, listingType: "sale" },
  { address: "78 Crookes Rd", postcode: "S10 5BE", town: "Sheffield", lat: 53.3812, lng: -1.5052, price: 285000, beds: 5, sqft: 1550, propertyType: "semi", article4: true, hmoRoomsPotential: 6, condition: "heavy", refurbEstimate: 48000, avgRoomRent: 525, avgBtlRent: 1400, postcodeMedianPrice: 310000, listingType: "auction", guidePrice: 230000 },

  // Birmingham (B16 / B29 / B11)
  { address: "44 Selly Oak Rd", postcode: "B29 6PD", town: "Birmingham", lat: 52.4421, lng: -1.9419, price: 250000, beds: 4, sqft: 1220, propertyType: "semi", article4: true, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 540, avgBtlRent: 1300, postcodeMedianPrice: 275000, listingType: "sale" },
  { address: "11 Edgbaston Rd", postcode: "B16 9AB", town: "Birmingham", lat: 52.4730, lng: -1.9305, price: 195000, beds: 3, sqft: 1050, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "turnkey", avgRoomRent: 500, avgBtlRent: 1150, postcodeMedianPrice: 210000, listingType: "sale" },
  { address: "7 Stoney Lane", postcode: "B11 1RJ", town: "Birmingham", lat: 52.4615, lng: -1.8612, price: 138000, beds: 3, sqft: 940, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "heavy", refurbEstimate: 32000, avgRoomRent: 470, avgBtlRent: 950, postcodeMedianPrice: 158000, listingType: "auction", guidePrice: 105000 },

  // Leeds (LS6 / LS4 — student / Article 4)
  { address: "23 Royal Park Rd", postcode: "LS6 1JG", town: "Leeds", lat: 53.8186, lng: -1.5650, price: 295000, beds: 5, sqft: 1450, propertyType: "terraced", article4: true, hmoRoomsPotential: 6, condition: "light", avgRoomRent: 565, avgBtlRent: 1500, postcodeMedianPrice: 315000, listingType: "sale" },
  { address: "88 Kirkstall Lane", postcode: "LS4 2QB", town: "Leeds", lat: 53.8233, lng: -1.5891, price: 215000, beds: 4, sqft: 1180, propertyType: "terraced", article4: false, hmoRoomsPotential: 5, condition: "turnkey", avgRoomRent: 525, avgBtlRent: 1250, postcodeMedianPrice: 230000, listingType: "sale" },
  { address: "2 Hyde Park Rd", postcode: "LS6 1AF", town: "Leeds", lat: 53.8154, lng: -1.5618, price: 340000, beds: 6, sqft: 1700, propertyType: "semi", article4: true, hmoRoomsPotential: 7, condition: "heavy", refurbEstimate: 55000, avgRoomRent: 580, avgBtlRent: 1700, postcodeMedianPrice: 365000, listingType: "auction", guidePrice: 275000 },

  // Newcastle (NE6 / NE2)
  { address: "16 Heaton Rd", postcode: "NE6 5HL", town: "Newcastle", lat: 54.9856, lng: -1.5821, price: 175000, beds: 4, sqft: 1180, propertyType: "terraced", article4: true, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 480, avgBtlRent: 1100, postcodeMedianPrice: 195000, listingType: "sale" },
  { address: "41 Jesmond Rd", postcode: "NE2 1NA", town: "Newcastle", lat: 54.9881, lng: -1.5963, price: 240000, beds: 4, sqft: 1320, propertyType: "semi", article4: false, hmoRoomsPotential: 5, condition: "turnkey", avgRoomRent: 510, avgBtlRent: 1250, postcodeMedianPrice: 255000, listingType: "sale" },
  { address: "9 Chillingham Rd", postcode: "NE6 5XW", town: "Newcastle", lat: 54.9912, lng: -1.5740, price: 132000, beds: 3, sqft: 940, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "heavy", refurbEstimate: 30000, avgRoomRent: 470, avgBtlRent: 925, postcodeMedianPrice: 150000, listingType: "repossession" },

  // Nottingham (NG7)
  { address: "55 Lenton Blvd", postcode: "NG7 2EN", town: "Nottingham", lat: 52.9421, lng: -1.1817, price: 220000, beds: 5, sqft: 1320, propertyType: "terraced", article4: true, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 515, avgBtlRent: 1350, postcodeMedianPrice: 245000, listingType: "sale" },
  { address: "12 Forest Rd East", postcode: "NG1 4HJ", town: "Nottingham", lat: 52.9614, lng: -1.1582, price: 185000, beds: 4, sqft: 1100, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "turnkey", avgRoomRent: 490, avgBtlRent: 1150, postcodeMedianPrice: 200000, listingType: "sale" },

  // Stoke / Hull / Bradford — high yield bargains
  { address: "4 Hartshill Rd", postcode: "ST4 7NY", town: "Stoke-on-Trent", lat: 53.0040, lng: -2.1934, price: 75000, beds: 3, sqft: 860, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "heavy", refurbEstimate: 28000, avgRoomRent: 380, avgBtlRent: 650, postcodeMedianPrice: 95000, listingType: "auction", guidePrice: 55000 },
  { address: "27 Beverley Rd", postcode: "HU3 1XL", town: "Hull", lat: 53.7510, lng: -0.3372, price: 68000, beds: 3, sqft: 880, propertyType: "terraced", article4: false, hmoRoomsPotential: 4, condition: "heavy", refurbEstimate: 25000, avgRoomRent: 360, avgBtlRent: 600, postcodeMedianPrice: 85000, listingType: "repossession" },
  { address: "18 Manningham Lane", postcode: "BD8 7HE", town: "Bradford", lat: 53.8094, lng: -1.7615, price: 85000, beds: 4, sqft: 1050, propertyType: "terraced", article4: false, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 380, avgBtlRent: 700, postcodeMedianPrice: 105000, listingType: "auction", guidePrice: 65000 },

  // Coventry / Leicester
  { address: "31 Earlsdon Ave", postcode: "CV5 6DR", town: "Coventry", lat: 52.4035, lng: -1.5293, price: 230000, beds: 4, sqft: 1240, propertyType: "semi", article4: true, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 510, avgBtlRent: 1250, postcodeMedianPrice: 250000, listingType: "sale" },
  { address: "6 Narborough Rd", postcode: "LE3 0BQ", town: "Leicester", lat: 52.6313, lng: -1.1531, price: 195000, beds: 4, sqft: 1150, propertyType: "terraced", article4: false, hmoRoomsPotential: 5, condition: "turnkey", avgRoomRent: 475, avgBtlRent: 1100, postcodeMedianPrice: 210000, listingType: "sale" },

  // Bristol / Cardiff (lower yield, capital growth)
  { address: "22 Gloucester Rd", postcode: "BS7 8AE", town: "Bristol", lat: 51.4762, lng: -2.5912, price: 425000, beds: 4, sqft: 1380, propertyType: "terraced", article4: false, hmoRoomsPotential: 5, condition: "turnkey", avgRoomRent: 650, avgBtlRent: 1850, postcodeMedianPrice: 440000, listingType: "sale" },
  { address: "4 Cathays Terrace", postcode: "CF24 4HX", town: "Cardiff", lat: 51.4945, lng: -3.1817, price: 245000, beds: 5, sqft: 1300, propertyType: "terraced", article4: true, hmoRoomsPotential: 5, condition: "light", avgRoomRent: 525, avgBtlRent: 1400, postcodeMedianPrice: 265000, listingType: "sale" },
];

let _id = 0;
function buildListing(s: Seed): Listing {
  const idx = _id++;
  return {
    id: `L${(idx + 1).toString().padStart(3, "0")}`,
    baths: s.baths ?? Math.max(1, Math.floor((s.beds ?? 3) / 2)),
    tenure: s.tenure ?? "freehold",
    epc: s.epc ?? (["C", "D", "D", "E"][idx % 4] as Listing["epc"]),
    daysOnMarket: s.daysOnMarket ?? ((idx * 13) % 90) + 3,
    photos: s.photos ?? pick(idx),
    description:
      s.description ??
      `${s.beds}-bed ${s.propertyType ?? "terraced"} in ${s.town}. ${
        (s.condition ?? "light") === "heavy"
          ? "Refurb opportunity with strong uplift potential."
          : (s.condition ?? "light") === "turnkey"
            ? "Ready-to-let, tenant demand high in this postcode."
            : "Light modernisation needed; great fundamentals."
      }`,
    agent: s.agent ?? ["Lomond", "Whitegates", "Reeds Rains", "Northwood", "Auction House UK"][idx % 5],
    sourceUrl: s.sourceUrl ?? `https://rightmove.co.uk/properties/${100000 + idx}`,
    article4: s.article4 ?? false,
    hmoRoomsPotential: s.hmoRoomsPotential ?? Math.max(s.beds ?? 3, 4),
    condition: s.condition ?? "light",
    refurbEstimate: s.refurbEstimate ?? 8000,
    postcodeMedianPrice: s.postcodeMedianPrice ?? s.price,
    avgRoomRent: s.avgRoomRent ?? 500,
    avgBtlRent: s.avgBtlRent ?? 1100,
    propertyType: s.propertyType ?? "terraced",
    guidePrice: s.guidePrice,
    ...s,
  } as Listing;
}

export const MOCK_LISTINGS: Listing[] = SEEDS.map(buildListing);

// ---- Derived investor metrics ----

export interface InvestorMetrics {
  grossYieldBtl: number; // %
  grossYieldHmo: number; // %
  bmvPct: number; // % below postcode median (positive = below)
  roiAnnual: number; // % cash-on-cash assuming 75% LTV @ 5.5% IO
  pricePerSqft: number;
  estGdvHmo: number; // GDV using 8% yield assumption
  refurbUplift: number; // estimated value after refurb (very rough)
  totalInPlight: number; // deposit + costs + refurb
}

const STAMP_RATE = (price: number) => {
  // simplified additional-dwelling SDLT
  let t = 0;
  const bands = [
    [125000, 0.05],
    [125000, 0.07],
    [675000, 0.1],
    [Infinity, 0.15],
  ] as const;
  let rem = price;
  for (const [size, rate] of bands) {
    const slice = Math.min(rem, size);
    t += slice * rate;
    rem -= slice;
    if (rem <= 0) break;
  }
  return Math.round(t);
};

export function metricsFor(l: Listing): InvestorMetrics {
  const grossBtl = (l.avgBtlRent * 12) / l.price;
  const hmoGross = (l.avgRoomRent * l.hmoRoomsPotential * 12) / l.price;

  const bmv = ((l.postcodeMedianPrice - l.price) / l.postcodeMedianPrice) * 100;

  const deposit = l.price * 0.25;
  const loan = l.price * 0.75;
  const interest = loan * 0.055;
  const stamp = STAMP_RATE(l.price);
  const costs = stamp + 2000 + (l.condition === "heavy" ? l.refurbEstimate : l.refurbEstimate / 2);
  const annualNet = l.avgBtlRent * 12 * 0.75 - interest; // 25% opex
  const totalIn = deposit + costs;
  const roi = (annualNet / totalIn) * 100;

  // GDV: HMO Net Adjusted Income / 8%
  const grossAnnualHmo = l.avgRoomRent * l.hmoRoomsPotential * 12;
  const netAdjusted = grossAnnualHmo * 0.8;
  const estGdv = netAdjusted / 0.08;

  const refurbUplift = Math.max(0, estGdv - l.price - costs);

  return {
    grossYieldBtl: grossBtl * 100,
    grossYieldHmo: hmoGross * 100,
    bmvPct: bmv,
    roiAnnual: roi,
    pricePerSqft: l.price / l.sqft,
    estGdvHmo: estGdv,
    refurbUplift,
    totalInPlight: totalIn,
  };
}

// ---- Filtering ----

export interface MarketFilters {
  query?: string; // town / postcode contains
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  propertyTypes?: PropertyType[];
  listingTypes?: ListingType[];
  minHmoYield?: number;
  minRoi?: number;
  minRooms?: number;
  article4?: "any" | "exclude" | "only";
  minBmv?: number;
  conditions?: Condition[];
  maxPpsf?: number;
}

export function applyFilters(listings: Listing[], f: MarketFilters): Array<Listing & { m: InvestorMetrics }> {
  const q = f.query?.trim().toLowerCase();
  return listings
    .map((l) => ({ ...l, m: metricsFor(l) }))
    .filter((l) => {
      if (q && !`${l.address} ${l.postcode} ${l.town}`.toLowerCase().includes(q)) return false;
      if (f.minPrice != null && l.price < f.minPrice) return false;
      if (f.maxPrice != null && l.price > f.maxPrice) return false;
      if (f.minBeds != null && l.beds < f.minBeds) return false;
      if (f.propertyTypes?.length && !f.propertyTypes.includes(l.propertyType)) return false;
      if (f.listingTypes?.length && !f.listingTypes.includes(l.listingType)) return false;
      if (f.minHmoYield != null && l.m.grossYieldHmo < f.minHmoYield) return false;
      if (f.minRoi != null && l.m.roiAnnual < f.minRoi) return false;
      if (f.minRooms != null && l.hmoRoomsPotential < f.minRooms) return false;
      if (f.article4 === "exclude" && l.article4) return false;
      if (f.article4 === "only" && !l.article4) return false;
      if (f.minBmv != null && l.m.bmvPct < f.minBmv) return false;
      if (f.conditions?.length && !f.conditions.includes(l.condition)) return false;
      if (f.maxPpsf != null && l.m.pricePerSqft > f.maxPpsf) return false;
      return true;
    });
}

export function getListingById(id: string): Listing | undefined {
  return MOCK_LISTINGS.find((l) => l.id === id);
}

export const fmtGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;