import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtGBP, fmtPct } from "@/lib/btl";
import {
  REACTION_EMOJI,
  HIDABLE_FIELDS,
  type ReactionKind,
  type FeedPostRow,
  type HidableFieldKey,
} from "@/lib/feed";
import { toast } from "sonner";
import {
  Heart,
  Flame,
  ThumbsUp,
  MessageCircle,
  Bookmark,
  Share2,
  Mail,
  Send,
  Inbox,
  Settings,
  LayoutGrid,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Client deal feed — Renoject" },
      { name: "description", content: "Browse the latest deals shared by Renoject." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FeedPage,
});

type Property = {
  id: string;
  name: string;
  inputs: any;
  metrics: any;
  source: string | null;
};

type Profile = { user_id: string; display_name: string | null; avatar_url: string | null };

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type Reaction = { post_id: string; user_id: string; kind: ReactionKind };

type Interest = { post_id: string; user_id: string; status: string; note: string | null; created_at: string };

type PollVote = { post_id: string; user_id: string; vote: "yes" | "no" };

type FeedPost = FeedPostRow & {
  property: Property | null;
  cover_resolved: string | null;
  reactions: Reaction[];
  comment_count: number;
  interested: boolean;
  saved: boolean;
  my_reaction: ReactionKind | null;
  poll_yes: number;
  poll_no: number;
  my_vote: "yes" | "no" | null;
};

type Tab = "feed" | "saved" | "manage" | "inbox";

function FeedPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", id);
        setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
      }
      setAuthLoaded(true);
    });
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    const { data: postRows, error } = await supabase
      .from("feed_posts")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const propIds = (postRows ?? []).map((p) => p.property_id);
    const postIds = (postRows ?? []).map((p) => p.id);
    const authorIds = Array.from(new Set((postRows ?? []).map((p) => p.author_id)));
    const [propsRes, reactsRes, commentsRes, intRes, savesRes, mediaRes, profsRes, pollsRes] = await Promise.all([
      propIds.length
        ? supabase.from("properties").select("id,name,inputs,metrics,source").in("id", propIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from("feed_reactions").select("post_id,user_id,kind").in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from("feed_comments").select("post_id").in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length && userId
        ? supabase.from("feed_interest").select("post_id").in("post_id", postIds).eq("user_id", userId)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length && userId
        ? supabase.from("feed_saves").select("post_id").in("post_id", postIds).eq("user_id", userId)
        : Promise.resolve({ data: [] as any[] }),
      propIds.length
        ? supabase.from("property_media")
            .select("property_id,storage_path")
            .in("property_id", propIds)
            .eq("is_hero", true)
            .eq("kind", "image")
        : Promise.resolve({ data: [] as any[] }),
      authorIds.length
        ? supabase.from("client_profiles").select("user_id,display_name,avatar_url").in("user_id", authorIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase.from("feed_poll_votes").select("post_id,user_id,vote").in("post_id", postIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const propMap = new Map<string, Property>(
      ((propsRes.data as Property[]) ?? []).map((p) => [p.id, p]),
    );
    const reactMap = new Map<string, Reaction[]>();
    for (const r of (reactsRes.data as Reaction[]) ?? []) {
      const arr = reactMap.get(r.post_id) ?? [];
      arr.push(r);
      reactMap.set(r.post_id, arr);
    }
    const commentCountMap = new Map<string, number>();
    for (const c of (commentsRes.data as { post_id: string }[]) ?? []) {
      commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) ?? 0) + 1);
    }
    const interestedSet = new Set(((intRes.data as { post_id: string }[]) ?? []).map((r) => r.post_id));
    const savedSet = new Set(((savesRes.data as { post_id: string }[]) ?? []).map((r) => r.post_id));

    const pollMap = new Map<string, PollVote[]>();
    for (const v of (pollsRes.data as PollVote[]) ?? []) {
      const arr = pollMap.get(v.post_id) ?? [];
      arr.push(v);
      pollMap.set(v.post_id, arr);
    }

    const coverMap: Record<string, string> = {};
    await Promise.all(
      ((mediaRes.data as { property_id: string; storage_path: string }[]) ?? []).map(async (m) => {
        const { data: s } = await supabase.storage
          .from("property-media")
          .createSignedUrl(m.storage_path, 60 * 60);
        if (s?.signedUrl) coverMap[m.property_id] = s.signedUrl;
      }),
    );

    const profMap: Record<string, Profile> = {};
    for (const p of (profsRes.data as Profile[]) ?? []) profMap[p.user_id] = p;
    setProfiles(profMap);

    const enriched: FeedPost[] = ((postRows ?? []) as any[]).map((p) => {
      const reacts = reactMap.get(p.id) ?? [];
      const votes = pollMap.get(p.id) ?? [];
      return {
        ...p,
        hidden_fields: (p.hidden_fields ?? []) as HidableFieldKey[],
        property: propMap.get(p.property_id) ?? null,
        cover_resolved: p.cover_url ?? coverMap[p.property_id] ?? null,
        reactions: reacts,
        comment_count: commentCountMap.get(p.id) ?? 0,
        interested: interestedSet.has(p.id),
        saved: savedSet.has(p.id),
        my_reaction: (reacts.find((r) => r.user_id === userId)?.kind ?? null) as ReactionKind | null,
        poll_yes: votes.filter((v) => v.vote === "yes").length,
        poll_no: votes.filter((v) => v.vote === "no").length,
        my_vote: (votes.find((v) => v.user_id === userId)?.vote ?? null) as "yes" | "no" | null,
      };
    });
    setPosts(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoaded && userId) loadFeed();
    else if (authLoaded) setLoading(false);
  }, [authLoaded, userId]);

  const toggleReact = async (postId: string, kind: ReactionKind) => {
    if (!userId) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.my_reaction === kind) {
      await supabase.from("feed_reactions").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase
        .from("feed_reactions")
        .upsert({ post_id: postId, user_id: userId, kind }, { onConflict: "post_id,user_id" });
    }
    loadFeed();
  };

  const toggleSave = async (postId: string) => {
    if (!userId) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.saved) {
      await supabase.from("feed_saves").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase.from("feed_saves").insert({ post_id: postId, user_id: userId });
    }
    loadFeed();
  };

  const expressInterest = async (postId: string) => {
    if (!userId) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.interested) {
      toast.info("You've already expressed interest.");
      return;
    }
    const { error } = await supabase
      .from("feed_interest")
      .insert({ post_id: postId, user_id: userId, status: "new" });
    if (error) toast.error(error.message);
    else {
      toast.success("Interest sent. The deal owner has been notified.");
      loadFeed();
    }
  };

  const castVote = async (postId: string, vote: "yes" | "no") => {
    if (!userId) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (post.my_vote === vote) {
      await supabase.from("feed_poll_votes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase
        .from("feed_poll_votes")
        .upsert({ post_id: postId, user_id: userId, vote }, { onConflict: "post_id,user_id" });
    }
    loadFeed();
  };

  const share = async (postId: string) => {
    const url = `${window.location.origin}/feed?post=${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  // ---------- gates ----------
  if (!authLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!userId) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-semibold">Client deal feed</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to browse the latest deals, react, comment and signal interest.
        </p>
        <Link to="/auth"><Button className="mt-6">Sign in / Sign up</Button></Link>
      </div>
    );
  }

  const visiblePosts = tab === "saved" ? posts.filter((p) => p.saved) : posts;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Client deal feed</h1>
          <p className="text-sm text-muted-foreground">
            New BRRR deals, fresh off the calculator.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-2">
        <TabBtn active={tab === "feed"} onClick={() => setTab("feed")} icon={<LayoutGrid className="h-4 w-4" />}>Feed</TabBtn>
        <TabBtn active={tab === "saved"} onClick={() => setTab("saved")} icon={<Bookmark className="h-4 w-4" />}>Saved</TabBtn>
        {isAdmin && (
          <>
            <TabBtn active={tab === "manage"} onClick={() => setTab("manage")} icon={<Settings className="h-4 w-4" />}>Manage</TabBtn>
            <TabBtn active={tab === "inbox"} onClick={() => setTab("inbox")} icon={<Inbox className="h-4 w-4" />}>Inbox</TabBtn>
          </>
        )}
      </div>

      {loading && <p className="mt-8 text-sm text-muted-foreground">Loading feed…</p>}

      {!loading && (tab === "feed" || tab === "saved") && (
        <div className="mt-6 space-y-6">
          {visiblePosts.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {tab === "saved" ? "Nothing saved yet." : "No deals on the feed yet."}
              </p>
            </div>
          )}
          {visiblePosts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              profile={profiles[p.author_id]}
              userId={userId}
              onReact={toggleReact}
              onSave={toggleSave}
              onInterest={expressInterest}
              onShare={share}
              onVote={castVote}
              onOpen={() => setOpenPostId(p.id)}
            />
          ))}
        </div>
      )}

      {!loading && tab === "manage" && isAdmin && (
        <ManageTable posts={posts} onChanged={loadFeed} />
      )}

      {!loading && tab === "inbox" && isAdmin && (
        <InboxView posts={posts} profiles={profiles} />
      )}

      {openPostId && (
        <PostSheet
          post={posts.find((p) => p.id === openPostId)!}
          userId={userId}
          onVote={castVote}
          onClose={() => {
            setOpenPostId(null);
            loadFeed();
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------

function TabBtn({
  active, onClick, children, icon,
}: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function PostCard({
  post,
  profile,
  userId,
  onReact,
  onSave,
  onInterest,
  onShare,
  onVote,
  onOpen,
}: {
  post: FeedPost;
  profile?: Profile;
  userId: string;
  onReact: (id: string, kind: ReactionKind) => void;
  onSave: (id: string) => void;
  onInterest: (id: string) => void;
  onShare: (id: string) => void;
  onVote: (id: string, vote: "yes" | "no") => void;
  onOpen: () => void;
}) {
  const prop = post.property;
  const inputs = prop?.inputs ?? {};
  const metrics = prop?.metrics ?? {};
  const hidden = new Set(post.hidden_fields);

  const counts = post.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});

  const authorName = profile?.display_name ?? "Renoject";
  const date = new Date(post.created_at).toLocaleDateString();

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      {post.cover_resolved && (
        <button onClick={onOpen} className="block w-full">
          <img
            src={post.cover_resolved}
            alt={prop?.name ?? "Deal"}
            className="aspect-[16/9] w-full object-cover"
          />
        </button>
      )}
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
            {authorName[0]?.toUpperCase() ?? "R"}
          </div>
          <div>
            <div className="text-sm font-medium">{authorName}</div>
            <div className="text-xs text-muted-foreground">{date}</div>
          </div>
        </div>

        <button onClick={onOpen} className="mt-3 block w-full text-left">
          <h2 className="text-lg font-semibold leading-tight">{prop?.name ?? "Deal"}</h2>
        </button>

        {post.caption && <p className="mt-2 whitespace-pre-wrap text-sm">{post.caption}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="GDV" value={fmtGBP(inputs.gdv ?? 0)} />
          {!hidden.has("purchasePrice") && (
            <Stat label="Purchase" value={fmtGBP(inputs.purchasePrice ?? 0)} />
          )}
          <Stat label="Cash left in" value={fmtGBP(Math.max(0, metrics.cashLeftIn ?? 0))} />
          <Stat label="Monthly CF" value={fmtGBP(metrics.monthlyCashflowIO ?? 0)} />
          {post.display_mode === "full" && (
            <>
              <Stat label="ROI" value={fmtPct(metrics.roiOnCashLeftIn ?? 0)} />
              {!hidden.has("refurbCost") && (
                <Stat label="Refurb" value={fmtGBP(inputs.refurbCost ?? 0)} />
              )}
              <Stat label="New loan" value={fmtGBP(metrics.newLoan ?? 0)} />
              <Stat label="Profit on paper" value={fmtGBP(metrics.profitOnPaper ?? 0)} />
            </>
          )}
        </div>

        {!hidden.has("purchasePrice") && (inputs.purchasePrice ?? 0) > 0 && (
          <PollBlock
            price={inputs.purchasePrice ?? 0}
            yes={post.poll_yes}
            no={post.poll_no}
            myVote={post.my_vote}
            onVote={(v) => onVote(post.id, v)}
          />
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <ReactBtn
            icon={<ThumbsUp className="h-4 w-4" />}
            count={counts.like ?? 0}
            active={post.my_reaction === "like"}
            onClick={() => onReact(post.id, "like")}
          />
          <ReactBtn
            icon={<Heart className="h-4 w-4" />}
            count={counts.love ?? 0}
            active={post.my_reaction === "love"}
            onClick={() => onReact(post.id, "love")}
          />
          <ReactBtn
            icon={<Flame className="h-4 w-4" />}
            count={counts.fire ?? 0}
            active={post.my_reaction === "fire"}
            onClick={() => onReact(post.id, "fire")}
          />
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {post.comment_count} comment{post.comment_count === 1 ? "" : "s"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={post.interested ? "secondary" : "default"}
              size="sm"
              onClick={() => onInterest(post.id)}
              disabled={post.interested}
            >
              <Mail className="h-3.5 w-3.5" />
              {post.interested ? "Interest sent" : "I'm interested"}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onSave(post.id)} title="Save">
              <Bookmark className={`h-4 w-4 ${post.saved ? "fill-current text-primary" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onShare(post.id)} title="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PollBlock({
  price, yes, no, myVote, onVote,
}: {
  price: number;
  yes: number;
  no: number;
  myVote: "yes" | "no" | null;
  onVote: (v: "yes" | "no") => void;
}) {
  const total = yes + no;
  const yesPct = total ? Math.round((yes / total) * 100) : 0;
  const noPct = total ? 100 - yesPct : 0;
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          Would you buy at {fmtGBP(price)}?
        </div>
        {myVote ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Check className="h-3 w-3" />
            You voted {myVote === "yes" ? "Yes" : "No"}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Cast your vote</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <PollOption
          label="Yes, I'd buy"
          count={yes}
          pct={yesPct}
          total={total}
          selected={myVote === "yes"}
          tone="yes"
          onClick={() => onVote("yes")}
        />
        <PollOption
          label="No, too high"
          count={no}
          pct={noPct}
          total={total}
          selected={myVote === "no"}
          tone="no"
          onClick={() => onVote("no")}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">{yes}</span> yes ·{" "}
          <span className="font-medium text-foreground tabular-nums">{no}</span> no ·{" "}
          {total} total vote{total === 1 ? "" : "s"}
        </span>
        {myVote && <span>Tap your choice again to clear it</span>}
      </div>
    </div>
  );
}

function PollOption({
  label, count, pct, total, selected, tone, onClick,
}: {
  label: string;
  count: number;
  pct: number;
  total: number;
  selected: boolean;
  tone: "yes" | "no";
  onClick: () => void;
}) {
  const fill = tone === "yes" ? "bg-primary/20" : "bg-muted-foreground/25";
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`relative overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors ${
        selected
          ? "border-primary ring-2 ring-primary/40 bg-primary/10 text-foreground"
          : "border-border hover:bg-accent"
      }`}
    >
      {total > 0 && (
        <span
          className={`absolute inset-y-0 left-0 ${fill}`}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      )}
      <span className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          {selected && <Check className="h-3.5 w-3.5 text-primary" />}
          {label}
        </span>
        <span className="text-xs tabular-nums">
          <span className="font-semibold text-foreground">{count}</span>
          <span className="text-muted-foreground"> · {pct}%</span>
        </span>
      </span>
    </button>
  );
}

function PollBreakdown({
  post,
  onVote,
}: {
  post: FeedPost;
  onVote: (v: "yes" | "no") => void;
}) {
  const price = post.property?.inputs?.purchasePrice ?? 0;
  const yes = post.poll_yes;
  const no = post.poll_no;
  const total = yes + no;
  const yesPct = total ? Math.round((yes / total) * 100) : 0;
  const noPct = total ? 100 - yesPct : 0;
  const myVote = post.my_vote;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Buyer poll
          </div>
          <div className="mt-1 text-base font-semibold">
            Would you buy at {fmtGBP(price)}?
          </div>
        </div>
        {myVote ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" />
            Your vote: {myVote === "yes" ? "Yes" : "No"}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            Not voted yet
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-background px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Yes</div>
          <div className="text-lg font-semibold tabular-nums">{yes}</div>
          <div className="text-[11px] text-muted-foreground">{yesPct}%</div>
        </div>
        <div className="rounded-md bg-background px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">No</div>
          <div className="text-lg font-semibold tabular-nums">{no}</div>
          <div className="text-[11px] text-muted-foreground">{noPct}%</div>
        </div>
        <div className="rounded-md bg-background px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-lg font-semibold tabular-nums">{total}</div>
          <div className="text-[11px] text-muted-foreground">vote{total === 1 ? "" : "s"}</div>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary"
            style={{ width: `${yesPct}%` }}
            aria-label={`Yes ${yesPct}%`}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <PollOption
          label="Yes, I'd buy"
          count={yes}
          pct={yesPct}
          total={total}
          selected={myVote === "yes"}
          tone="yes"
          onClick={() => onVote("yes")}
        />
        <PollOption
          label="No, too high"
          count={no}
          pct={noPct}
          total={total}
          selected={myVote === "no"}
          tone="no"
          onClick={() => onVote("no")}
        />
      </div>
      {myVote && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tap your current choice again to clear it.
        </p>
      )}
    </div>
  );
}

function ReactBtn({
  icon, count, active, onClick,
}: { icon: React.ReactNode; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
      {count}
    </button>
  );
}

// ---------------- Post detail sheet (with comments) ----------------

function PostSheet({
  post, userId, onVote, onClose,
}: {
  post: FeedPost;
  userId: string;
  onVote: (postId: string, vote: "yes" | "no") => void;
  onClose: () => void;
}) {
  const postId = post.id;
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("feed_comments")
      .select("id,post_id,user_id,body,created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const rows = (data as Comment[]) ?? [];
    setComments(rows);
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("client_profiles")
        .select("user_id,display_name,avatar_url")
        .in("user_id", ids);
      const map: Record<string, Profile> = {};
      for (const p of (profs as Profile[]) ?? []) map[p.user_id] = p;
      setProfiles(map);
    }
  };

  useEffect(() => { load(); }, [postId]);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase
      .from("feed_comments")
      .insert({ post_id: postId, user_id: userId, body: text });
    setSending(false);
    if (error) toast.error(error.message);
    else {
      setBody("");
      load();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-border bg-card sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-sm font-semibold">{post.property?.name ?? "Deal"}</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <PollBreakdown post={post} onVote={(v) => onVote(post.id, v)} />
          <div className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comments
          </div>
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">Be the first to comment.</p>
          )}
          {comments.map((c) => {
            const name = profiles[c.user_id]?.display_name ?? "User";
            return (
              <div key={c.id} className="flex gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs font-medium">{name}</div>
                  <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 border-t border-border p-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
            placeholder="Write a comment…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            maxLength={2000}
          />
          <Button onClick={submit} disabled={sending || !body.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Admin: manage ----------------

function ManageTable({ posts, onChanged }: { posts: FeedPost[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const current = posts.find((p) => p.id === editing) ?? null;

  const unpublish = async (id: string) => {
    if (!confirm("Remove this deal from the feed?")) return;
    await supabase.from("feed_posts").delete().eq("id", id);
    toast.success("Removed from feed");
    onChanged();
  };

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Deal</th>
            <th className="px-4 py-3 text-left">Mode</th>
            <th className="px-4 py-3 text-right">Reactions</th>
            <th className="px-4 py-3 text-right">Comments</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {posts.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No posts.</td></tr>
          )}
          {posts.map((p) => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{p.property?.name ?? "—"}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">{p.display_mode}</td>
              <td className="px-4 py-3 text-right tabular-nums">{p.reactions.length}</td>
              <td className="px-4 py-3 text-right tabular-nums">{p.comment_count}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p.id)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => unpublish(p.id)}>Remove</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {current && (
        <EditPostDialog
          post={current}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function EditPostDialog({ post, onClose, onSaved }: { post: FeedPost; onClose: () => void; onSaved: () => void }) {
  const [caption, setCaption] = useState(post.caption ?? "");
  const [displayMode, setDisplayMode] = useState<"teaser" | "full">(post.display_mode);
  const [hidden, setHidden] = useState<Set<HidableFieldKey>>(new Set(post.hidden_fields));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("feed_posts")
      .update({
        caption: caption || null,
        display_mode: displayMode,
        hidden_fields: Array.from(hidden),
      } as any)
      .eq("id", post.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); onSaved(); }
  };

  const toggleHide = (k: HidableFieldKey) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k); else next.add(k);
    setHidden(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">Edit feed post</h3>
        <p className="text-xs text-muted-foreground">{post.property?.name}</p>

        <label className="mt-4 block text-xs font-medium">Caption</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Say something about this deal…"
        />

        <label className="mt-4 block text-xs font-medium">Display mode</label>
        <div className="mt-1 flex gap-2">
          {(["teaser", "full"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDisplayMode(m)}
              className={`flex-1 rounded-md border px-3 py-2 text-xs capitalize ${
                displayMode === m ? "border-primary bg-primary/15 text-primary" : "border-border"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium">Hide fields</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {HIDABLE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={hidden.has(f.key)}
                  onChange={() => toggleHide(f.key)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Admin: inbox ----------------

function InboxView({ posts, profiles }: { posts: FeedPost[]; profiles: Record<string, Profile> }) {
  const [leads, setLeads] = useState<(Interest & { email?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feed_interest")
      .select("post_id,user_id,status,note,created_at")
      .order("created_at", { ascending: false });
    setLeads((data as Interest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (postId: string, userId: string, status: string) => {
    await supabase
      .from("feed_interest")
      .update({ status } as any)
      .eq("post_id", postId)
      .eq("user_id", userId);
    load();
  };

  if (loading) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;

  if (leads.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">No interested clients yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {leads.map((l) => {
        const post = posts.find((p) => p.id === l.post_id);
        const profile = profiles[l.user_id];
        return (
          <div key={`${l.post_id}-${l.user_id}`} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4">
            <div className="flex-1 min-w-[200px]">
              <div className="text-sm font-medium">{profile?.display_name ?? l.user_id.slice(0, 8)}</div>
              <div className="text-xs text-muted-foreground">
                {post?.property?.name ?? "Deal"} · {new Date(l.created_at).toLocaleDateString()}
              </div>
            </div>
            <select
              value={l.status}
              onChange={(e) => setStatus(l.post_id, l.user_id, e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}

void REACTION_EMOJI;