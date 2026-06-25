export type PropertyType = "btl" | "hmo" | "flip" | "commercial" | "mixed" | "dev_site" | "other";
export type PropertyStatus = "sourcing" | "under_offer" | "owned" | "refurb" | "let" | "sold";
export type ProjectStage = "planning" | "permits" | "demo" | "first_fix" | "second_fix" | "snagging" | "complete" | "refinanced";
export type ProjectType = "light_refurb" | "heavy_refurb" | "conversion" | "new_build";
export type UnitStatus = "vacant" | "marketing" | "offer" | "referencing" | "let" | "notice" | "refurb";
export type TenantStatus = "current" | "past" | "arrears" | "notice";
export type Risk = "low" | "med" | "high";
export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "converted";
export type LeadSource = "referral" | "feed" | "portal" | "event" | "cold" | "website" | "other";

export type Property = {
  id: string;
  address: string;
  postcode: string | null;
  property_type: PropertyType;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  tenure: string | null;
  status: PropertyStatus;
  purchase_price: number | null;
  current_value: number | null;
  equity: number | null;
  owner_entity: string | null;
  source_post_id: string | null;
  hero_image_url: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

export type Project = {
  id: string;
  property_id: string;
  name: string;
  type: ProjectType;
  stage: ProjectStage;
  budget: number;
  spent: number;
  start_date: string | null;
  target_end: string | null;
  actual_end: string | null;
  risk: Risk;
  notes: string | null;
};

export type Unit = {
  id: string;
  property_id: string;
  label: string;
  beds: number | null;
  rent_pcm: number | null;
  status: UnitStatus;
  marketed_at: string | null;
};

export type Tenant = {
  id: string;
  unit_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  tenancy_start: string | null;
  tenancy_end: string | null;
  rent_pcm: number | null;
  deposit: number | null;
  status: TenantStatus;
  arrears_amount: number;
  notes: string | null;
};

export type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  interested_in: string | null;
  budget_min: number | null;
  budget_max: number | null;
  area_pref: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  next_action_at: string | null;
  converted_client_id: string | null;
};

export const PROPERTY_STATUSES: PropertyStatus[] = ["sourcing", "under_offer", "owned", "refurb", "let", "sold"];
export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, string> = {
  sourcing: "Sourcing", under_offer: "Under offer", owned: "Owned",
  refurb: "In refurb", let: "Let", sold: "Sold",
};
export const PROPERTY_STATUS_COLOR: Record<PropertyStatus, string> = {
  sourcing: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  under_offer: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  owned: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  refurb: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  let: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  sold: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const PROJECT_STAGES: ProjectStage[] = ["planning", "permits", "demo", "first_fix", "second_fix", "snagging", "complete", "refinanced"];
export const PROJECT_STAGE_LABEL: Record<ProjectStage, string> = {
  planning: "Planning", permits: "Permits", demo: "Demo",
  first_fix: "First fix", second_fix: "Second fix", snagging: "Snagging",
  complete: "Complete", refinanced: "Refinanced",
};
export const PROJECT_STAGE_COLOR: Record<ProjectStage, string> = {
  planning: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  permits: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  demo: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  first_fix: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  second_fix: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  snagging: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  complete: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  refinanced: "bg-teal-500/15 text-teal-300 border-teal-500/30",
};

export const UNIT_STATUSES: UnitStatus[] = ["vacant", "marketing", "offer", "referencing", "let", "notice", "refurb"];
export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  vacant: "Vacant", marketing: "Marketing", offer: "Offer", referencing: "Referencing",
  let: "Let", notice: "Notice", refurb: "Refurb",
};
export const UNIT_STATUS_COLOR: Record<UnitStatus, string> = {
  vacant: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  marketing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  offer: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  referencing: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  let: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  notice: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  refurb: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "unqualified", "converted"];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  unqualified: "Unqualified", converted: "Converted",
};
export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  new: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  contacted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  qualified: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unqualified: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  converted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export const fmtGBP = (n: number | null | undefined) =>
  typeof n === "number" ? `£${Math.round(n).toLocaleString()}` : "—";

/* ===== Landlord-ops additions ===== */
export type RentPayment = {
  id: string;
  tenant_id: string;
  due_date: string;
  due_amount: number;
  paid_amount: number;
  paid_on: string | null;
  method: string | null;
  notes: string | null;
};
export type Expense = {
  id: string;
  property_id: string;
  supplier_id: string | null;
  date: string;
  category: string;
  amount: number;
  vat_amount: number;
  notes: string | null;
  receipt_url: string | null;
};
export type ComplianceItem = {
  id: string;
  property_id: string;
  type: string;
  issued_on: string | null;
  expires_on: string | null;
  document_url: string | null;
  notes: string | null;
};
export type CrmDocument = {
  id: string;
  property_id: string;
  name: string;
  kind: string;
  file_url: string;
  uploaded_at: string;
};

export const EXPENSE_CATEGORIES = [
  "maintenance","repairs","management","insurance","utilities","mortgage",
  "service_charge","ground_rent","legal","letting_fees","other",
] as const;

export const COMPLIANCE_TYPES = [
  "Gas safety","EICR","EPC","PAT","Fire alarm","HMO licence","Deposit protection","Legionella",
] as const;

export const DOCUMENT_KINDS = [
  "tenancy_agreement","certificate","statement","invoice","insurance","other",
] as const;

export const expiryStatus = (iso: string | null): { label: string; color: string } => {
  if (!iso) return { label: "Unknown", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" };
  const days = Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Expired", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
  if (days <= 60) return { label: `${days}d left`, color: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return { label: `${days}d left`, color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
};