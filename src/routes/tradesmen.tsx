import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Briefcase, Clock, PoundSterling, Pencil, Trash2, Plus, Search, Sparkles, ShieldCheck, ShieldAlert, ShieldX, ExternalLink, Loader2, Check, X, Star } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchTradesmen, approveCandidate, dismissCandidate } from "@/lib/tradesmen-scrape.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/tradesmen")({
  head: () => ({
    meta: [
      { title: "Tradesmen & Services — HARTSTONE HOLDINGS" },
      { name: "description", content: "Shared directory of trusted tradesmen and services with contact details, specialities and rates." },
    ],
  }),
  component: TradesmenPage,
});

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

type FormState = {
  name: string;
  company: string;
  phone: string;
  email: string;
  area_covered: string;
  specialities: string;
  day_rate: string;
  call_out_fee: string;
  lead_time_days: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  company: "",
  phone: "",
  email: "",
  area_covered: "",
  specialities: "",
  day_rate: "",
  call_out_fee: "",
  lead_time_days: "",
  notes: "",
};

function TradesmenPage() {
  const [list, setList] = useState<Tradesman[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tradesman | null>(null);
  const [profile, setProfile] = useState<Tradesman | null>(null);
  const [findOpen, setFindOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tradesmen")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setList((data ?? []) as Tradesman[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const allSpecialities = useMemo(() => {
    const set = new Set<string>();
    list.forEach((t) => t.specialities?.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((t) => {
      if (activeFilter && !t.specialities?.includes(activeFilter)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.company ?? "").toLowerCase().includes(q) ||
        (t.area_covered ?? "").toLowerCase().includes(q) ||
        (t.specialities ?? []).some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [list, query, activeFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this tradesman from the directory?")) return;
    const { error } = await supabase.from("tradesmen").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    setProfile(null);
    void load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold">Tradesmen & Services</h1>
            <p className="text-sm text-muted-foreground">
              Shared directory of trusted contacts, specialities and rates.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFindOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" /> Find tradesmen
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add tradesman
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <Tabs defaultValue="directory" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="queue">Review queue</TabsTrigger>
          </TabsList>
          <TabsContent value="directory">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, company, area or speciality…"
              className="pl-9"
            />
          </div>
        </div>

        {allSpecialities.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Badge
              variant={activeFilter === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveFilter(null)}
            >
              All
            </Badge>
            {allSpecialities.map((s) => (
              <Badge
                key={s}
                variant={activeFilter === s ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setActiveFilter(activeFilter === s ? null : s)}
              >
                {s}
              </Badge>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No tradesmen yet. Click <strong>Add tradesman</strong> to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Card
                key={t.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => setProfile(t)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.company && (
                    <p className="text-xs text-muted-foreground">{t.company}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {(t.specialities ?? []).slice(0, 4).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  {t.area_covered && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {t.area_covered}
                    </p>
                  )}
                  {t.phone && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {t.phone}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>
          <TabsContent value="queue">
            <ReviewQueue onApproved={() => void load()} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Profile dialog */}
      <Dialog open={profile !== null} onOpenChange={(o) => !o && setProfile(null)}>
        <DialogContent className="max-w-lg">
          {profile && (
            <>
              <DialogHeader>
                <DialogTitle>{profile.name}</DialogTitle>
                {profile.company && (
                  <p className="text-sm text-muted-foreground">{profile.company}</p>
                )}
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {(profile.specialities?.length ?? 0) > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Specialities</p>
                    <div className="flex flex-wrap gap-1">
                      {profile.specialities.map((s) => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2">
                  {profile.phone && (
                    <a href={`tel:${profile.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Phone className="h-4 w-4" /> {profile.phone}
                    </a>
                  )}
                  {profile.email && (
                    <a href={`mailto:${profile.email}`} className="flex items-center gap-2 text-primary hover:underline">
                      <Mail className="h-4 w-4" /> {profile.email}
                    </a>
                  )}
                  {profile.area_covered && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" /> {profile.area_covered}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><PoundSterling className="h-3 w-3" /> Day rate</p>
                    <p className="font-medium">{profile.day_rate != null ? `£${profile.day_rate}` : "—"}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Briefcase className="h-3 w-3" /> Call-out</p>
                    <p className="font-medium">{profile.call_out_fee != null ? `£${profile.call_out_fee}` : "—"}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Lead time</p>
                    <p className="font-medium">{profile.lead_time_days != null ? `${profile.lead_time_days}d` : "—"}</p>
                  </div>
                </div>
                {profile.notes && (
                  <div className="border-t border-border pt-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap text-sm">{profile.notes}</p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => handleDelete(profile.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
                <Button
                  onClick={() => {
                    setEditing(profile);
                    setProfile(null);
                    setOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TradesmanForm
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => {
          setOpen(false);
          setEditing(null);
          void load();
        }}
      />

      <FindTradesmenDialog open={findOpen} onOpenChange={setFindOpen} />
    </div>
  );
}

function TradesmanForm({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Tradesman | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name ?? "",
        company: editing.company ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        area_covered: editing.area_covered ?? "",
        specialities: (editing.specialities ?? []).join(", "),
        day_rate: editing.day_rate?.toString() ?? "",
        call_out_fee: editing.call_out_fee?.toString() ?? "",
        lead_time_days: editing.lead_time_days?.toString() ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing, open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      area_covered: form.area_covered.trim() || null,
      specialities: form.specialities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      day_rate: form.day_rate ? Number(form.day_rate) : null,
      call_out_fee: form.call_out_fee ? Number(form.call_out_fee) : null,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      notes: form.notes.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("tradesmen").update(payload).eq("id", editing.id)
      : await supabase.from("tradesmen").insert(payload);

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated" : "Added");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit tradesman" : "Add tradesman"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
          </div>
          <div>
            <Label>Company</Label>
            <Input value={form.company} onChange={(e) => set("company", e.target.value)} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={255} />
            </div>
          </div>
          <div>
            <Label>Area covered</Label>
            <Input value={form.area_covered} onChange={(e) => set("area_covered", e.target.value)} maxLength={200} placeholder="e.g. Greater Manchester" />
          </div>
          <div>
            <Label>Specialities (comma separated)</Label>
            <Input
              value={form.specialities}
              onChange={(e) => set("specialities", e.target.value)}
              placeholder="Plumbing, Gas Safe, HMO compliance"
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Day rate (£)</Label>
              <Input type="number" inputMode="decimal" value={form.day_rate} onChange={(e) => set("day_rate", e.target.value)} />
            </div>
            <div>
              <Label>Call-out (£)</Label>
              <Input type="number" inputMode="decimal" value={form.call_out_fee} onChange={(e) => set("call_out_fee", e.target.value)} />
            </div>
            <div>
              <Label>Lead time (days)</Label>
              <Input type="number" inputMode="numeric" value={form.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={2000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add tradesman"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Candidate = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  area_covered: string | null;
  website: string | null;
  specialities: string[];
  rating: number | null;
  review_count: number | null;
  social_presence_score: number | null;
  sense_check: { verdict: "clean" | "mixed" | "flagged"; complaintSummary: string; redFlags: string[]; positiveSignals: string[] } | null;
  score: number | null;
  status: string;
  search_query: string | null;
  sources: Record<string, { url?: string; snippet?: string }> | null;
  searched_at: string;
};

function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (verdict === "clean") return <Badge className="bg-emerald-600 hover:bg-emerald-600"><ShieldCheck className="mr-1 h-3 w-3" /> Clean</Badge>;
  if (verdict === "mixed") return <Badge className="bg-amber-600 hover:bg-amber-600"><ShieldAlert className="mr-1 h-3 w-3" /> Mixed</Badge>;
  if (verdict === "flagged") return <Badge variant="destructive"><ShieldX className="mr-1 h-3 w-3" /> Flagged</Badge>;
  return <Badge variant="outline">Unchecked</Badge>;
}

function ReviewQueue({ onApproved }: { onApproved: () => void }) {
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFlagged, setShowFlagged] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const approveFn = useServerFn(approveCandidate);
  const dismissFn = useServerFn(dismissCandidate);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tradesmen_candidates")
      .select("*")
      .eq("status", "pending")
      .order("score", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as unknown as Candidate[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = items.filter((c) => showFlagged || c.sense_check?.verdict !== "flagged");

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      await approveFn({ data: { id } });
      toast.success("Added to directory");
      setItems((prev) => prev.filter((c) => c.id !== id));
      onApproved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    try {
      await dismissFn({ data: { id } });
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to dismiss");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const flaggedCount = items.filter((c) => c.sense_check?.verdict === "flagged").length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} pending {items.length === 1 ? "candidate" : "candidates"}
          {flaggedCount > 0 && ` · ${flaggedCount} flagged`}
        </p>
        {flaggedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowFlagged((v) => !v)}>
            {showFlagged ? "Hide flagged" : "Show flagged"}
          </Button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No pending candidates. Click <strong>Find tradesmen</strong> to scrape an area.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    {c.search_query && <p className="text-xs text-muted-foreground">from "{c.search_query}"</p>}
                  </div>
                  <VerdictBadge verdict={c.sense_check?.verdict} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {c.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      <strong>{c.rating.toFixed(1)}</strong>
                      <span className="text-muted-foreground">({c.review_count ?? 0})</span>
                    </span>
                  )}
                  {c.social_presence_score != null && c.social_presence_score > 0 && (
                    <span className="text-muted-foreground">Social: {c.social_presence_score}</span>
                  )}
                  {c.area_covered && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {c.area_covered}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  )}
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> Website
                    </a>
                  )}
                </div>
                {c.sense_check && (
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                    <p className="mb-1 font-medium">Sense check</p>
                    <p className="text-muted-foreground">{c.sense_check.complaintSummary || "No notable complaints."}</p>
                    {c.sense_check.redFlags?.length > 0 && (
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-destructive">
                        {c.sense_check.redFlags.slice(0, 4).map((f, i) => (<li key={i}>{f}</li>))}
                      </ul>
                    )}
                    {c.sense_check.positiveSignals?.length > 0 && (
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-emerald-600 dark:text-emerald-400">
                        {c.sense_check.positiveSignals.slice(0, 3).map((f, i) => (<li key={i}>{f}</li>))}
                      </ul>
                    )}
                  </div>
                )}
                {c.sources && Object.keys(c.sources).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(c.sources).map((src) => (
                      <Badge key={src} variant="outline" className="text-xs">{src.replace("www.", "")}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => approve(c.id)} disabled={busyId === c.id}>
                    {busyId === c.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />} Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => dismiss(c.id)} disabled={busyId === c.id}>
                    <X className="mr-2 h-3 w-3" /> Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FindTradesmenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [town, setTown] = useState("");
  const [trade, setTrade] = useState("");
  const [running, setRunning] = useState(false);
  const searchFn = useServerFn(searchTradesmen);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!town.trim() || !trade.trim()) return toast.error("Town and trade are required");
    setRunning(true);
    try {
      const result = await searchFn({ data: { town: town.trim(), trade: trade.trim() } });
      toast.success(result.message);
      onOpenChange(false);
      setTown("");
      setTrade("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Find tradesmen</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Scrapes Google, review sites and social pages, then AI-checks each one for complaints.
            Results land in the Review queue for your approval.
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Town or city *</Label>
            <Input value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Manchester" maxLength={80} required />
          </div>
          <div>
            <Label>Trade *</Label>
            <Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="e.g. Electrician, Plumber, Gas Safe" maxLength={80} required />
          </div>
          <p className="text-xs text-muted-foreground">
            This takes ~30–60 seconds. Each search costs a few cents in API usage.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
              Cancel
            </Button>
            <Button type="submit" disabled={running}>
              {running ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scraping…</>) : (<><Sparkles className="mr-2 h-4 w-4" /> Start search</>)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}