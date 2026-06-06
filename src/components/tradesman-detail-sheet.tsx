import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getTradesmanDetail } from "@/lib/tradesmen-scrape.functions";
import { runBackgroundCheck } from "@/lib/tradesmen-background.functions";
import {
  Mail, Phone, MapPin, PoundSterling, Briefcase, Clock, ExternalLink, Star,
  ShieldCheck, ShieldAlert, ShieldX, Building2, Users, Loader2, Pencil, Trash2, Sparkles,
} from "lucide-react";

type Tradesman = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  area_covered: string | null;
  specialities: string[];
  day_rate: number | null;
  call_out_fee: number | null;
  lead_time_days: number | null;
  notes: string | null;
  created_at: string;
};

type Candidate = {
  id: string;
  rating: number | null;
  review_count: number | null;
  social_presence_score: number | null;
  website: string | null;
  search_query: string | null;
  sources: Record<string, { url?: string; snippet?: string }> | null;
  sense_check: { verdict: "clean" | "mixed" | "flagged"; complaintSummary: string; redFlags: string[]; positiveSignals: string[] } | null;
  review_breakdown: Array<{
    source: string;
    url: string | null;
    rating: number | null;
    count: number | null;
    snippets: Array<{ text: string; rating: number | null }>;
  }> | null;
  background_check: BackgroundReport | null;
  background_checked_at: string | null;
};

type BackgroundReport = {
  company_match: {
    company_name: string;
    company_number: string;
    company_status: string;
    address: string | null;
    incorporated_on: string | null;
    url: string;
  } | null;
  officers: Array<{ name: string; role: string | null; appointed_on: string | null; resigned_on: string | null; appointments_url: string | null }>;
  director_reports: Array<{
    name: string;
    role: string | null;
    appointed_on: string | null;
    appointments_url: string | null;
    counts: { total: number; active: number; dissolved: number; resigned: number; liquidation: number };
    examples: Array<{ company_name: string; company_number: string; status: string; role: string | null }>;
  }>;
  web_mentions: Array<{ url: string; title: string | null; snippet: string }>;
  ai: {
    verdict: "clean" | "watch" | "flagged";
    summary: string;
    riskSignals: string[];
    positiveSignals: string[];
    directorFlags: string[];
  } | null;
  checked_at: string;
  disclaimer: string;
};

function SenseBadge({ verdict }: { verdict?: string | null }) {
  if (verdict === "clean") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" /> Clean</Badge>;
  if (verdict === "mixed") return <Badge className="bg-amber-600 hover:bg-amber-600"><ShieldAlert className="mr-1 h-3 w-3" /> Mixed</Badge>;
  if (verdict === "flagged") return <Badge variant="destructive"><ShieldX className="mr-1 h-3 w-3" /> Flagged</Badge>;
  return <Badge variant="outline">Unchecked</Badge>;
}

function BgBadge({ verdict }: { verdict?: string | null }) {
  if (verdict === "clean") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" /> Clean</Badge>;
  if (verdict === "watch") return <Badge className="bg-amber-600 hover:bg-amber-600"><ShieldAlert className="mr-1 h-3 w-3" /> Watch</Badge>;
  if (verdict === "flagged") return <Badge variant="destructive"><ShieldX className="mr-1 h-3 w-3" /> Flagged</Badge>;
  return null;
}

export function TradesmanDetailSheet({
  tradesmanId,
  onClose,
  onEdit,
  onDelete,
}: {
  tradesmanId: string | null;
  onClose: () => void;
  onEdit: (t: Tradesman) => void;
  onDelete: (id: string) => void;
}) {
  const open = tradesmanId !== null;
  const [tradesman, setTradesman] = useState<Tradesman | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [bgLoading, setBgLoading] = useState(false);
  const detailFn = useServerFn(getTradesmanDetail);
  const backgroundFn = useServerFn(runBackgroundCheck);

  useEffect(() => {
    if (!tradesmanId) {
      setTradesman(null);
      setCandidate(null);
      return;
    }
    setLoading(true);
    detailFn({ data: { id: tradesmanId } })
      .then((r) => {
        setTradesman(r.tradesman as Tradesman);
        setCandidate((r.candidate ?? null) as Candidate | null);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [tradesmanId, detailFn]);

  const runBg = async () => {
    if (!candidate) {
      toast.error("No source candidate linked — background check unavailable.");
      return;
    }
    setBgLoading(true);
    try {
      const report = await backgroundFn({ data: { id: candidate.id } });
      setCandidate({ ...candidate, background_check: report, background_checked_at: report.checked_at });
      toast.success("Background check complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Background check failed");
    } finally {
      setBgLoading(false);
    }
  };

  const breakdown = candidate?.review_breakdown ?? [];
  const totalReviews = breakdown.length > 0
    ? breakdown.reduce((s, b) => s + (b.count ?? 0), 0)
    : candidate?.review_count ?? 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {loading || !tradesman ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle>{tradesman.name}</SheetTitle>
                  {tradesman.company && <SheetDescription>{tradesman.company}</SheetDescription>}
                </div>
                <SenseBadge verdict={candidate?.sense_check?.verdict} />
              </div>
            </SheetHeader>

            <div className="mt-4 space-y-5 text-sm">
              {/* Specialities */}
              {(tradesman.specialities?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tradesman.specialities.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              )}

              {/* Contact */}
              <div className="space-y-2">
                {tradesman.phone && (
                  <a href={`tel:${tradesman.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Phone className="h-4 w-4" /> {tradesman.phone}
                  </a>
                )}
                {tradesman.email && (
                  <a href={`mailto:${tradesman.email}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Mail className="h-4 w-4" /> {tradesman.email}
                  </a>
                )}
                {candidate?.website && (
                  <a href={candidate.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" /> Website
                  </a>
                )}
                {tradesman.area_covered && (
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {tradesman.area_covered}</p>
                )}
              </div>

              {/* Rates */}
              <div className="grid grid-cols-3 gap-2 rounded-md border border-border p-3">
                <div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><PoundSterling className="h-3 w-3" /> Day rate</p>
                  <p className="font-medium">{tradesman.day_rate != null ? `£${tradesman.day_rate}` : "—"}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Briefcase className="h-3 w-3" /> Call-out</p>
                  <p className="font-medium">{tradesman.call_out_fee != null ? `£${tradesman.call_out_fee}` : "—"}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Lead time</p>
                  <p className="font-medium">{tradesman.lead_time_days != null ? `${tradesman.lead_time_days}d` : "—"}</p>
                </div>
              </div>

              {tradesman.notes && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap">{tradesman.notes}</p>
                </div>
              )}

              {candidate ? (
                <>
                  <Separator />

                  {/* Reviews */}
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                      <strong>{candidate.rating != null ? candidate.rating.toFixed(1) : "—"}</strong>
                      <span className="text-muted-foreground">
                        · {totalReviews} review{totalReviews === 1 ? "" : "s"}
                        {breakdown.length > 0 && ` across ${breakdown.length} source${breakdown.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    {breakdown.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No per-source breakdown captured.</p>
                    ) : (
                      <div className="space-y-2">
                        {breakdown.map((b, i) => (
                          <div key={`${b.source}-${i}`} className="rounded-md border border-border p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              {b.url ? (
                                <a href={b.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                                  {b.source} <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="font-medium">{b.source}</span>
                              )}
                              <span className="text-muted-foreground">
                                {b.rating != null && (<><Star className="mr-1 inline h-3 w-3 fill-amber-500 text-amber-500" />{b.rating.toFixed(1)} · </>)}
                                {b.count ?? 0} reviews
                              </span>
                            </div>
                            {b.snippets.length > 0 && (
                              <ul className="mt-1 space-y-1 text-muted-foreground">
                                {b.snippets.slice(0, 3).map((s, j) => (
                                  <li key={j} className="line-clamp-3">
                                    {s.rating != null && <span className="mr-1 text-amber-600">{s.rating}★</span>}
                                    {s.text}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sense check */}
                  {candidate.sense_check && (
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                      <p className="mb-1 font-medium">Sense check</p>
                      <p className="text-muted-foreground">{candidate.sense_check.complaintSummary || "No notable complaints."}</p>
                      {candidate.sense_check.redFlags?.length > 0 && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-destructive">
                          {candidate.sense_check.redFlags.map((f, i) => (<li key={i}>{f}</li>))}
                        </ul>
                      )}
                      {candidate.sense_check.positiveSignals?.length > 0 && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-emerald-600 dark:text-emerald-400">
                          {candidate.sense_check.positiveSignals.map((f, i) => (<li key={i}>{f}</li>))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Sources */}
                  {candidate.sources && Object.keys(candidate.sources).length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Sources</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(candidate.sources).map(([src, info]) => {
                          const url = (info as any)?.url;
                          const label = src.replace("www.", "");
                          return url ? (
                            <a key={src} href={url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold hover:border-primary hover:text-primary">
                              {label} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <Badge key={src} variant="outline" className="text-xs">{label}</Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Background check */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4" />
                        <strong>Background check</strong>
                        <BgBadge verdict={candidate.background_check?.ai?.verdict} />
                      </div>
                      <Button size="sm" variant="secondary" onClick={runBg} disabled={bgLoading}>
                        {bgLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Sparkles className="mr-2 h-3 w-3" />}
                        {candidate.background_check ? "Re-run" : "Run check"}
                      </Button>
                    </div>
                    {candidate.background_check ? (
                      <BackgroundBody report={candidate.background_check} />
                    ) : (
                      <p className="text-xs text-muted-foreground">No background check yet — run one to pull Companies House, director history and CCJ web mentions.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No scraped review data linked. Added manually or before the source candidate was archived.
                </p>
              )}
            </div>

            <SheetFooter className="mt-6 flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => onDelete(tradesman.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
              <Button onClick={() => onEdit(tradesman)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BackgroundBody({ report }: { report: BackgroundReport }) {
  const match = report.company_match;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border p-2 text-xs">
        <p className="mb-1 font-medium">Company match</p>
        {match ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <a href={match.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {match.company_name} <ExternalLink className="h-3 w-3" />
              </a>
              <Badge variant="outline" className="text-[10px]">{match.company_status}</Badge>
              <span className="text-muted-foreground">#{match.company_number}</span>
            </div>
            {match.incorporated_on && <p className="text-muted-foreground">Incorporated {match.incorporated_on}</p>}
            {match.address && <p className="text-muted-foreground">{match.address}</p>}
          </div>
        ) : (
          <p className="text-muted-foreground">No Companies House match found.</p>
        )}
      </div>

      {report.director_reports.length > 0 && (
        <div className="rounded-md border border-border p-2 text-xs">
          <p className="mb-1 flex items-center gap-1 font-medium"><Users className="h-3 w-3" /> Directors</p>
          <ul className="space-y-2">
            {report.director_reports.map((d, i) => (
              <li key={i} className="border-l-2 border-border pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  {d.appointments_url ? (
                    <a href={d.appointments_url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{d.name}</a>
                  ) : (
                    <span className="font-medium">{d.name}</span>
                  )}
                  {d.role && <span className="text-muted-foreground">· {d.role}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-muted-foreground">
                  <span>{d.counts.total} appointments</span>
                  <span>{d.counts.active} active</span>
                  <span className={d.counts.dissolved >= 3 ? "text-destructive" : ""}>{d.counts.dissolved} dissolved</span>
                  {d.counts.liquidation > 0 && <span className="text-destructive">{d.counts.liquidation} liquidation</span>}
                  <span>{d.counts.resigned} resigned</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.ai && (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
          <p className="mb-1 font-medium">Verdict</p>
          <p className="text-muted-foreground">{report.ai.summary}</p>
          {report.ai.riskSignals.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-destructive">
              {report.ai.riskSignals.map((f, i) => (<li key={i}>{f}</li>))}
            </ul>
          )}
          {report.ai.directorFlags.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-700 dark:text-amber-400">
              {report.ai.directorFlags.map((f, i) => (<li key={i}>{f}</li>))}
            </ul>
          )}
          {report.ai.positiveSignals.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-emerald-600 dark:text-emerald-400">
              {report.ai.positiveSignals.map((f, i) => (<li key={i}>{f}</li>))}
            </ul>
          )}
        </div>
      )}

      {report.web_mentions.length > 0 && (
        <div className="rounded-md border border-border p-2 text-xs">
          <p className="mb-1 font-medium">CCJ / reputation web mentions</p>
          <p className="mb-1 text-[10px] italic text-muted-foreground">{report.disclaimer}</p>
          <ul className="space-y-1">
            {report.web_mentions.slice(0, 6).map((m, i) => (
              <li key={i}>
                <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {m.title ?? m.url} <ExternalLink className="h-3 w-3" />
                </a>
                {m.snippet && <p className="line-clamp-2 text-muted-foreground">{m.snippet}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}