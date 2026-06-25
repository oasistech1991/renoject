import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Camera, MapPin, Pencil, Save, X, Heart, MessageCircle, Bookmark,
  Target, Wallet, Hash, ThumbsUp, ThumbsDown, Loader2,
} from "lucide-react";
import { DEAL_TYPES, dealTypeMeta } from "@/lib/feed";
import { fmtGBP } from "@/lib/btl";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Renoject" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ProfilePage,
});

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  investor_type: string | null;
  preferred_areas: string[];
  preferred_deal_types: string[];
  budget_min: number | null;
  budget_max: number | null;
  available_capital: number | null;
  capital_notes: string | null;
  capital_updated_at: string | null;
};

const EMPTY: Profile = {
  user_id: "", display_name: "", avatar_url: null, cover_url: null,
  headline: "", bio: "", location: "", investor_type: "",
  preferred_areas: [], preferred_deal_types: [], budget_min: null, budget_max: null,
  available_capital: null, capital_notes: null, capital_updated_at: null,
};

type ActivityItem = {
  kind: "vote" | "comment" | "interest";
  postId: string;
  propertyName: string;
  detail: string;
  at: string;
};

type SavedDeal = {
  postId: string;
  propertyName: string;
  price: number;
  dealType: string | null;
};

function ProfilePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"about" | "activity" | "saved" | "preferences">("about");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [saved, setSaved] = useState<SavedDeal[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { navigate({ to: "/auth" }); return; }
      setUserId(u.user.id);
      setEmail(u.user.email ?? null);
      await loadAll(u.user.id);
      setLoading(false);
    })();
  }, [navigate]);

  async function loadAll(uid: string) {
    const { data: p } = await supabase
      .from("client_profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (p) {
      setProfile({
        ...EMPTY,
        ...p,
        preferred_areas: (p as any).preferred_areas ?? [],
        preferred_deal_types: (p as any).preferred_deal_types ?? [],
      });
    } else {
      setProfile({ ...EMPTY, user_id: uid });
    }

    // Activity: latest votes, comments, interests
    const [votes, comments, interests] = await Promise.all([
      supabase.from("feed_poll_votes").select("post_id, vote, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("feed_comments").select("post_id, body, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("feed_interest").select("post_id, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
    ]);

    const allPostIds = Array.from(new Set([
      ...(votes.data ?? []).map((v: any) => v.post_id),
      ...(comments.data ?? []).map((c: any) => c.post_id),
      ...(interests.data ?? []).map((i: any) => i.post_id),
    ]));

    const postMap = new Map<string, { property_id: string; deal_type: string | null }>();
    if (allPostIds.length) {
      const { data: posts } = await supabase
        .from("feed_posts").select("id, property_id, deal_type").in("id", allPostIds);
      (posts ?? []).forEach((p: any) => postMap.set(p.id, { property_id: p.property_id, deal_type: p.deal_type }));
    }
    const propIds = Array.from(new Set([...postMap.values()].map((v) => v.property_id)));
    const propMap = new Map<string, { name: string; inputs: any }>();
    if (propIds.length) {
      const { data: props } = await supabase
        .from("properties").select("id, name, inputs").in("id", propIds);
      (props ?? []).forEach((p: any) => propMap.set(p.id, { name: p.name, inputs: p.inputs ?? {} }));
    }

    const items: ActivityItem[] = [];
    (votes.data ?? []).forEach((v: any) => {
      const post = postMap.get(v.post_id); const prop = post && propMap.get(post.property_id);
      items.push({ kind: "vote", postId: v.post_id, propertyName: prop?.name ?? "Deal", detail: v.vote === "yes" ? "Voted Yes" : "Voted No", at: v.created_at });
    });
    (comments.data ?? []).forEach((c: any) => {
      const post = postMap.get(c.post_id); const prop = post && propMap.get(post.property_id);
      items.push({ kind: "comment", postId: c.post_id, propertyName: prop?.name ?? "Deal", detail: c.body, at: c.created_at });
    });
    (interests.data ?? []).forEach((i: any) => {
      const post = postMap.get(i.post_id); const prop = post && propMap.get(post.property_id);
      items.push({ kind: "interest", postId: i.post_id, propertyName: prop?.name ?? "Deal", detail: "Marked as interested", at: i.created_at });
    });
    items.sort((a, b) => (a.at < b.at ? 1 : -1));
    setActivity(items);

    // Saved deals
    const { data: savedRows } = await supabase
      .from("feed_saves").select("post_id, created_at").eq("user_id", uid).order("created_at", { ascending: false });
    const savedPostIds = (savedRows ?? []).map((s: any) => s.post_id);
    const savedDeals: SavedDeal[] = [];
    if (savedPostIds.length) {
      const { data: posts } = await supabase
        .from("feed_posts").select("id, property_id, deal_type").in("id", savedPostIds);
      const sPropIds = Array.from(new Set((posts ?? []).map((p: any) => p.property_id)));
      const sPropMap = new Map<string, { name: string; inputs: any }>();
      if (sPropIds.length) {
        const { data: props } = await supabase
          .from("properties").select("id, name, inputs").in("id", sPropIds);
        (props ?? []).forEach((p: any) => sPropMap.set(p.id, { name: p.name, inputs: p.inputs ?? {} }));
      }
      (posts ?? []).forEach((p: any) => {
        const prop = sPropMap.get(p.property_id);
        savedDeals.push({
          postId: p.id,
          propertyName: prop?.name ?? "Deal",
          price: Number(prop?.inputs?.purchasePrice ?? 0),
          dealType: p.deal_type,
        });
      });
    }
    setSaved(savedDeals);
  }

  async function uploadImage(file: File, target: "avatar" | "cover") {
    if (!userId) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `profile/${userId}/${target}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("property-media").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = await supabase.storage.from("property-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = data?.signedUrl ?? null;
    if (!url) return;
    const field = target === "avatar" ? "avatar_url" : "cover_url";
    setProfile((p) => ({ ...p, [field]: url }));
    const payload: { user_id: string; avatar_url?: string; cover_url?: string } = { user_id: userId };
    payload[field] = url;
    await supabase.from("client_profiles").upsert(payload);
    toast.success(target === "avatar" ? "Profile picture updated" : "Cover photo updated");
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    const capitalChanged =
      profile.available_capital !== null && profile.available_capital !== undefined;
    const { error } = await supabase.from("client_profiles").upsert({
      user_id: userId,
      display_name: profile.display_name,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      investor_type: profile.investor_type,
      preferred_areas: profile.preferred_areas,
      preferred_deal_types: profile.preferred_deal_types,
      budget_min: profile.budget_min,
      budget_max: profile.budget_max,
      available_capital: profile.available_capital,
      capital_notes: profile.capital_notes,
      capital_updated_at: capitalChanged ? new Date().toISOString() : profile.capital_updated_at,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); setEditing(false); }
  }

  const initials = useMemo(() => {
    const n = profile.display_name || email || "";
    return n.slice(0, 2).toUpperCase();
  }, [profile.display_name, email]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading profile…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Cover */}
      <div className="relative h-56 overflow-hidden rounded-b-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-muted sm:h-72">
        {profile.cover_url && (
          <img src={profile.cover_url} alt="Cover" className="h-full w-full object-cover" />
        )}
        <label className="absolute bottom-3 right-3 cursor-pointer rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80">
          <Camera className="mr-1.5 inline h-3.5 w-3.5" /> Edit cover
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "cover")} />
        </label>
      </div>

      {/* Avatar + identity */}
      <div className="-mt-16 px-4 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-primary/20 text-3xl font-semibold text-primary shadow-lg">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : initials}
              </div>
              <label className="absolute bottom-1 right-1 cursor-pointer rounded-full bg-foreground p-1.5 text-background shadow-md transition-transform hover:scale-110">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar")} />
              </label>
            </div>
            <div className="pb-2">
              <h1 className="text-2xl font-bold leading-tight">{profile.display_name || email?.split("@")[0] || "Your name"}</h1>
              {profile.headline && <p className="text-sm text-muted-foreground">{profile.headline}</p>}
              {profile.location && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {profile.location}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="mr-1 h-4 w-4" /> Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save"}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-4 w-4" /> Edit profile
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-border">
          {([
            ["about", "About"],
            ["activity", "Activity"],
            ["saved", "Saved"],
            ["preferences", "Preferences"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >{label}</button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "about" && <AboutTab profile={profile} editing={editing} setProfile={setProfile} />}
          {tab === "activity" && <ActivityTab items={activity} />}
          {tab === "saved" && <SavedTab items={saved} />}
          {tab === "preferences" && <PreferencesTab profile={profile} editing={editing} setProfile={setProfile} />}
        </div>
      </div>
    </div>
  );
}

function AboutTab({ profile, editing, setProfile }: { profile: Profile; editing: boolean; setProfile: (f: (p: Profile) => Profile) => void }) {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="space-y-4 sm:col-span-2 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">About</h2>
        {editing ? (
          <div className="space-y-3">
            <Field label="Display name">
              <Input value={profile.display_name ?? ""} onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))} />
            </Field>
            <Field label="Headline">
              <Input placeholder="e.g. BRR investor, North West UK" value={profile.headline ?? ""} onChange={(e) => setProfile((p) => ({ ...p, headline: e.target.value }))} />
            </Field>
            <Field label="Location">
              <Input placeholder="Manchester, UK" value={profile.location ?? ""} onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))} />
            </Field>
            <Field label="Bio">
              <Textarea rows={4} placeholder="Tell us about your investing journey…" value={profile.bio ?? ""} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} />
            </Field>
            <Field label="Investor type">
              <Input placeholder="Individual / Limited company / Fund" value={profile.investor_type ?? ""} onChange={(e) => setProfile((p) => ({ ...p, investor_type: e.target.value }))} />
            </Field>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {profile.bio ? <p className="whitespace-pre-wrap">{profile.bio}</p> : <p className="text-muted-foreground italic">No bio yet. Click Edit profile to add one.</p>}
            {profile.investor_type && <p><span className="text-muted-foreground">Investor type:</span> {profile.investor_type}</p>}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">At a glance</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> {profile.preferred_deal_types.length || 0} preferred deal type{profile.preferred_deal_types.length === 1 ? "" : "s"}</li>
          <li className="flex items-center gap-2"><Hash className="h-4 w-4 text-primary" /> {profile.preferred_areas.length} preferred area{profile.preferred_areas.length === 1 ? "" : "s"}</li>
          <li className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Budget: {profile.budget_min || profile.budget_max ? `${fmtGBP(profile.budget_min ?? 0)} – ${fmtGBP(profile.budget_max ?? 0)}` : "Not set"}</li>
        </ul>
      </div>
    </div>
  );
}

function ActivityTab({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <Empty text="No activity yet — vote, comment, or mark a deal as interested in the feed." />;
  return (
    <ol className="space-y-3">
      {items.map((it, i) => {
        const Icon = it.kind === "comment" ? MessageCircle : it.kind === "interest" ? Heart : it.detail.startsWith("Voted Yes") ? ThumbsUp : ThumbsDown;
        return (
          <li key={`${it.kind}-${i}`} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Link to="/feed" className="truncate text-sm font-medium hover:text-primary">{it.propertyName}</Link>
                <span className="text-xs text-muted-foreground">{new Date(it.at).toLocaleDateString()}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{it.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SavedTab({ items }: { items: SavedDeal[] }) {
  if (!items.length) return <Empty text="You haven't saved any deals yet. Tap the bookmark on a feed card to save it here." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => {
        const meta = dealTypeMeta(it.dealType);
        return (
          <Link key={it.postId} to="/feed" className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{it.propertyName}</h3>
              <Bookmark className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
              <span className="text-muted-foreground">{fmtGBP(it.price)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PreferencesTab({ profile, editing, setProfile }: { profile: Profile; editing: boolean; setProfile: (f: (p: Profile) => Profile) => void }) {
  const [areaInput, setAreaInput] = useState("");
  const addArea = () => {
    const v = areaInput.trim();
    if (!v) return;
    if (profile.preferred_areas.includes(v)) { setAreaInput(""); return; }
    setProfile((p) => ({ ...p, preferred_areas: [...p.preferred_areas, v] }));
    setAreaInput("");
  };
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preferred deal types</h2>
        <div className="flex flex-wrap gap-2">
          {DEAL_TYPES.map((d) => {
            const active = profile.preferred_deal_types.includes(d.key);
            return (
              <button
                key={d.key}
                disabled={!editing}
                onClick={() => setProfile((p) => ({
                  ...p,
                  preferred_deal_types: active
                    ? p.preferred_deal_types.filter((k) => k !== d.key)
                    : [...p.preferred_deal_types, d.key],
                }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default ${
                  active ? "border-transparent text-white" : "border-border text-foreground hover:bg-accent disabled:hover:bg-transparent"
                }`}
                style={active ? { backgroundColor: d.color } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "rgba(255,255,255,0.9)" : d.color }} />
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Preferred areas</h2>
        <div className="flex flex-wrap gap-2">
          {profile.preferred_areas.map((a) => (
            <Badge key={a} variant="secondary" className="gap-1">
              {a}
              {editing && (
                <button onClick={() => setProfile((p) => ({ ...p, preferred_areas: p.preferred_areas.filter((x) => x !== a) }))} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {!profile.preferred_areas.length && !editing && <p className="text-sm text-muted-foreground italic">No areas yet.</p>}
        </div>
        {editing && (
          <div className="mt-3 flex gap-2">
            <Input
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }}
              placeholder="e.g. Manchester M14"
            />
            <Button type="button" size="sm" onClick={addArea}>Add</Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Budget range (GBP)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum">
            <Input type="number" disabled={!editing} value={profile.budget_min ?? ""} onChange={(e) => setProfile((p) => ({ ...p, budget_min: e.target.value ? Number(e.target.value) : null }))} />
          </Field>
          <Field label="Maximum">
            <Input type="number" disabled={!editing} value={profile.budget_max ?? ""} onChange={(e) => setProfile((p) => ({ ...p, budget_max: e.target.value ? Number(e.target.value) : null }))} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">{text}</div>;
}