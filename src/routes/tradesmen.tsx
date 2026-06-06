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