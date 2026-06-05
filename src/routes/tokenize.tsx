import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/tokenize")({
  head: () => ({
    meta: [
      { title: "Tokenize — HARTSTONE HOLDINGS" },
      { name: "description", content: "Visual demo of property tokenization: mint NFT deeds, fractionalize ownership, and transfer to new parties on-chain." },
    ],
  }),
  component: TokenizePage,
});

type Property = { id: string; name: string; metrics: Record<string, unknown>; inputs: Record<string, unknown>; source: string | null };
type Token = { id: string; property_id: string; token_hash: string; chain: string; owner_wallet: string; minted_at: string; metadata: Record<string, unknown> };
type Fraction = { token_id: string; total_supply: number; price_per_share_pence: number };
type Holding = { id: string; token_id: string; holder: string; shares: number };
type Transfer = { id: string; token_id: string; kind: "mint" | "whole" | "shares"; from_party: string | null; to_party: string; amount: number; tx_hash: string; created_at: string };

const SELF_WALLET = "0xHARTS" + "0000000000000000000000000000000000ab";

function fakeHash(prefix = "0x") {
  const hex = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  return prefix + hex.slice(0, 40);
}
function shortHash(h: string) {
  return h.slice(0, 6) + "…" + h.slice(-4);
}
function fmtGBP(p: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(p / 100);
}
function getGDV(p: Property): number {
  const m = p.metrics ?? {};
  const candidates = ["gdv", "estimatedGdv", "ARV", "arv", "valuation"];
  for (const k of candidates) {
    const v = (m as Record<string, unknown>)[k];
    if (typeof v === "number" && v > 0) return v;
  }
  // fall back to inputs.purchasePrice or 250k
  const ip = (p.inputs ?? {}) as Record<string, unknown>;
  for (const k of ["purchasePrice", "price"]) {
    const v = ip[k];
    if (typeof v === "number" && v > 0) return v;
  }
  return 250_000;
}

function TokenizePage() {
  const [view, setView] = useState<"owner" | "investor">("owner");
  const [properties, setProperties] = useState<Property[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [fractions, setFractions] = useState<Fraction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [p, t, f, h, tr] = await Promise.all([
      supabase.from("properties").select("id,name,metrics,inputs,source").order("created_at", { ascending: false }),
      supabase.from("tokens").select("*").order("minted_at", { ascending: false }),
      supabase.from("token_fractions").select("*"),
      supabase.from("token_holdings").select("*"),
      supabase.from("token_transfers").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setProperties((p.data ?? []) as Property[]);
    setTokens((t.data ?? []) as Token[]);
    setFractions((f.data ?? []) as Fraction[]);
    setHoldings((h.data ?? []) as Holding[]);
    setTransfers((tr.data ?? []) as Transfer[]);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const tokenByProp = useMemo(() => new Map(tokens.map((t) => [t.property_id, t])), [tokens]);
  const fractByToken = useMemo(() => new Map(fractions.map((f) => [f.token_id, f])), [fractions]);
  const holdingsByToken = useMemo(() => {
    const m = new Map<string, Holding[]>();
    for (const h of holdings) {
      const arr = m.get(h.token_id) ?? [];
      arr.push(h);
      m.set(h.token_id, arr);
    }
    return m;
  }, [holdings]);

  const summary = useMemo(() => {
    const totalGDV = properties.reduce((a, p) => a + getGDV(p), 0);
    const sharesOut = fractions.reduce((a, f) => a + f.total_supply, 0);
    return { total: properties.length, minted: tokens.length, fract: fractions.length, gdv: totalGDV, shares: sharesOut };
  }, [properties, tokens, fractions]);

  return (
    <div className="min-h-[calc(100vh-49px)] bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Tokenize</p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">On-chain property vault</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Mint each property as an NFT deed, fractionalize into tradeable shares, and transfer ownership to a new party — all simulated on a private testnet so you can validate the flow before going to mainnet.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
            <button onClick={() => setView("owner")} className={`rounded px-3 py-1.5 text-sm font-medium ${view === "owner" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Owner</button>
            <button onClick={() => setView("investor")} className={`rounded px-3 py-1.5 text-sm font-medium ${view === "investor" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Investor</button>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-200">
          Demo only — tokens are simulated on the <code className="font-mono">base-sim</code> testnet and do not confer legal title. Real ERC-721 / ERC-20 deployment is the next step.
        </div>

        {/* Vault summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <SummaryStat label="Properties" value={summary.total} />
          <SummaryStat label="Deeds minted" value={summary.minted} />
          <SummaryStat label="Fractionalized" value={summary.fract} />
          <SummaryStat label="Total GDV" value={fmtGBP(summary.gdv * 100)} />
          <SummaryStat label="Shares outstanding" value={summary.shares.toLocaleString()} />
        </div>

        {loading ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Loading vault…</p>
        ) : view === "owner" ? (
          <OwnerView
            properties={properties}
            tokenByProp={tokenByProp}
            fractByToken={fractByToken}
            holdingsByToken={holdingsByToken}
            onChange={refresh}
          />
        ) : (
          <InvestorView
            properties={properties}
            tokens={tokens}
            fractions={fractions}
            holdingsByToken={holdingsByToken}
            onChange={refresh}
          />
        )}

        {/* Activity feed */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
            {transfers.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No on-chain activity yet. Mint your first deed above.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tx</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">From</th>
                    <th className="px-3 py-2 text-left font-medium">To</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((tr) => (
                    <tr key={tr.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-primary">{shortHash(tr.tx_hash)}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{tr.kind}</Badge></td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{tr.from_party ? shortHash(tr.from_party) : "—"}</td>
                      <td className="px-3 py-2 font-mono">{shortHash(tr.to_party)}</td>
                      <td className="px-3 py-2 text-right">{tr.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{new Date(tr.created_at).toLocaleString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function OwnerView({
  properties,
  tokenByProp,
  fractByToken,
  holdingsByToken,
  onChange,
}: {
  properties: Property[];
  tokenByProp: Map<string, Token>;
  fractByToken: Map<string, Fraction>;
  holdingsByToken: Map<string, Holding[]>;
  onChange: () => void;
}) {
  const [mintFor, setMintFor] = useState<Property | null>(null);
  const [fractFor, setFractFor] = useState<{ token: Token; property: Property } | null>(null);
  const [transferFor, setTransferFor] = useState<{ token: Token; property: Property; mode: "whole" | "shares" } | null>(null);

  if (properties.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No properties to tokenize yet. Add deals in <span className="font-semibold text-foreground">View Deals</span> first.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => {
          const token = tokenByProp.get(p.id);
          const fract = token ? fractByToken.get(token.id) : undefined;
          const cap = token ? (holdingsByToken.get(token.id) ?? []) : [];
          const gdv = getGDV(p);
          return (
            <TokenCard
              key={p.id}
              property={p}
              token={token}
              fraction={fract}
              holdings={cap}
              gdv={gdv}
              onMint={() => setMintFor(p)}
              onFract={() => token && setFractFor({ token, property: p })}
              onWhole={() => token && setTransferFor({ token, property: p, mode: "whole" })}
              onShares={() => token && setTransferFor({ token, property: p, mode: "shares" })}
            />
          );
        })}
      </div>

      {mintFor && <MintDialog property={mintFor} onDone={() => { setMintFor(null); onChange(); }} onClose={() => setMintFor(null)} />}
      {fractFor && <FractionalizeDialog {...fractFor} onDone={() => { setFractFor(null); onChange(); }} onClose={() => setFractFor(null)} />}
      {transferFor && <TransferDialog {...transferFor} fraction={fractByToken.get(transferFor.token.id)} ownerHolding={holdingsByToken.get(transferFor.token.id)?.find((h) => h.holder === SELF_WALLET)} onDone={() => { setTransferFor(null); onChange(); }} onClose={() => setTransferFor(null)} />}
    </>
  );
}

function TokenCard({
  property,
  token,
  fraction,
  holdings,
  gdv,
  onMint,
  onFract,
  onWhole,
  onShares,
}: {
  property: Property;
  token?: Token;
  fraction?: Fraction;
  holdings: Holding[];
  gdv: number;
  onMint: () => void;
  onFract: () => void;
  onWhole: () => void;
  onShares: () => void;
}) {
  const status = !token ? "Unminted" : fraction ? "Fractionalized" : "Deed minted";
  const badgeCls =
    status === "Unminted"
      ? "bg-muted text-muted-foreground"
      : status === "Deed minted"
        ? "bg-primary/15 text-primary"
        : "bg-emerald-500/15 text-emerald-300";

  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-lg">
      {/* Deed visual */}
      <div className="relative h-32 overflow-hidden border-b border-border bg-gradient-to-br from-primary/20 via-card to-card">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)/0.5), transparent 50%), radial-gradient(circle at 80% 80%, hsl(var(--accent)/0.3), transparent 50%)" }} />
        <div className="relative flex h-full flex-col justify-between p-3">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{token ? "DEED · base-sim" : "Ready to mint"}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>{status}</span>
          </div>
          <div>
            <p className="font-mono text-[10px] text-muted-foreground">{token ? shortHash(token.token_hash) : "0x…"}</p>
            <p className="truncate text-sm font-bold text-foreground">{property.name}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Est. GDV</span>
          <span className="font-semibold text-foreground">{fmtGBP(gdv * 100)}</span>
        </div>

        {fraction && (
          <div className="rounded-md border border-border bg-background/50 p-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total supply</span>
              <span className="font-semibold">{fraction.total_supply.toLocaleString()} shares</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Price / share</span>
              <span className="font-semibold">{fmtGBP(fraction.price_per_share_pence)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Implied valuation</span>
              <span className="font-semibold text-emerald-300">{fmtGBP(fraction.total_supply * fraction.price_per_share_pence)}</span>
            </div>
            {holdings.length > 0 && (
              <div className="mt-2 border-t border-border pt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Cap table</p>
                {holdings
                  .slice()
                  .sort((a, b) => b.shares - a.shares)
                  .slice(0, 3)
                  .map((h) => {
                    const pct = (h.shares / fraction.total_supply) * 100;
                    return (
                      <div key={h.id} className="flex items-center gap-2">
                        <span className="flex-1 truncate font-mono text-[10px]">{h.holder === SELF_WALLET ? "You" : shortHash(h.holder)}</span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 text-right text-[10px] tabular-nums">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {!token && (
            <Button size="sm" className="flex-1" onClick={onMint}>Mint deed</Button>
          )}
          {token && !fraction && (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={onFract}>Fractionalize</Button>
              <Button size="sm" className="flex-1" onClick={onWhole}>Transfer</Button>
            </>
          )}
          {token && fraction && (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={onWhole}>Whole</Button>
              <Button size="sm" className="flex-1" onClick={onShares}>Sell shares</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MintDialog({ property, onDone, onClose }: { property: Property; onDone: () => void; onClose: () => void }) {
  const [stage, setStage] = useState<"prep" | "broadcast" | "done">("prep");
  const [hash, setHash] = useState("");

  const mint = async () => {
    setStage("broadcast");
    const tokenHash = fakeHash();
    const txHash = fakeHash();
    setHash(tokenHash);
    await new Promise((r) => setTimeout(r, 1400));
    const { data, error } = await supabase
      .from("tokens")
      .insert({
        property_id: property.id,
        token_hash: tokenHash,
        chain: "base-sim",
        owner_wallet: SELF_WALLET,
        metadata: { name: property.name, source: property.source ?? "manual" },
      } as never)
      .select()
      .single();
    if (error || !data) {
      toast.error("Mint failed: " + (error?.message ?? "unknown"));
      onClose();
      return;
    }
    await supabase.from("token_transfers").insert({
      token_id: (data as { id: string }).id,
      kind: "mint",
      from_party: null,
      to_party: SELF_WALLET,
      amount: 1,
      tx_hash: txHash,
    } as never);
    setStage("done");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mint deed NFT</DialogTitle>
          <DialogDescription>{property.name}</DialogDescription>
        </DialogHeader>

        {stage === "prep" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">A unique ERC-721 deed will be minted to your wallet on the <code className="rounded bg-muted px-1 font-mono text-xs">base-sim</code> testnet. The token metadata will include the property name, source and estimated GDV.</p>
            <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
              <p className="text-muted-foreground">Recipient wallet:</p>
              <p className="text-primary">{shortHash(SELF_WALLET)}</p>
            </div>
          </div>
        )}
        {stage === "broadcast" && (
          <div className="space-y-3 py-6 text-center text-sm">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="font-semibold">Broadcasting to base-sim…</p>
            <p className="font-mono text-xs text-muted-foreground">{shortHash(hash)}</p>
          </div>
        )}
        {stage === "done" && (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-400">✓</div>
            <p className="text-sm font-semibold">Deed minted</p>
            <p className="font-mono text-xs text-muted-foreground">{shortHash(hash)}</p>
          </div>
        )}

        <DialogFooter>
          {stage === "prep" && <Button onClick={mint}>Confirm & mint</Button>}
          {stage === "done" && <Button onClick={onDone}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FractionalizeDialog({
  token,
  property,
  onDone,
  onClose,
}: {
  token: Token;
  property: Property;
  onDone: () => void;
  onClose: () => void;
}) {
  const gdv = getGDV(property);
  const [supply, setSupply] = useState(10000);
  const [pricePence, setPricePence] = useState(Math.max(1, Math.round((gdv * 100) / 10000)));
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (supply <= 0 || pricePence <= 0) return;
    setWorking(true);
    const { error } = await supabase.from("token_fractions").insert({
      token_id: token.id,
      total_supply: supply,
      price_per_share_pence: pricePence,
    } as never);
    if (error) { toast.error(error.message); setWorking(false); return; }
    // owner starts with all shares
    await supabase.from("token_holdings").insert({
      token_id: token.id,
      holder: SELF_WALLET,
      shares: supply,
    } as never);
    await supabase.from("token_transfers").insert({
      token_id: token.id,
      kind: "shares",
      from_party: null,
      to_party: SELF_WALLET,
      amount: supply,
      tx_hash: fakeHash(),
    } as never);
    toast.success("Fractionalized");
    onDone();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fractionalize {property.name}</DialogTitle>
          <DialogDescription>The deed will be locked in a vault and split into ERC-20 shares.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Total share supply</label>
            <div className="mt-1 flex gap-2">
              {[1000, 10000, 100000].map((n) => (
                <Button key={n} size="sm" variant={supply === n ? "default" : "outline"} onClick={() => { setSupply(n); setPricePence(Math.max(1, Math.round((gdv * 100) / n))); }}>{n.toLocaleString()}</Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Price per share (pence)</label>
            <Input type="number" min={1} value={pricePence} onChange={(e) => setPricePence(parseInt(e.target.value || "0", 10))} className="mt-1" />
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Implied valuation</span><span className="font-semibold">{fmtGBP(supply * pricePence)}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Est. GDV</span><span>{fmtGBP(gdv * 100)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={working}>{working ? "Minting shares…" : "Fractionalize"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  token,
  property,
  mode,
  fraction,
  ownerHolding,
  onDone,
  onClose,
}: {
  token: Token;
  property: Property;
  mode: "whole" | "shares";
  fraction?: Fraction;
  ownerHolding?: Holding;
  onDone: () => void;
  onClose: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState(mode === "shares" ? Math.min(100, ownerHolding?.shares ?? 0) : 1);
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!recipient.trim()) return;
    const recipKey = recipient.startsWith("0x") ? recipient : `0x${btoa(recipient).replace(/=/g, "").slice(0, 38).padEnd(38, "0")}`;
    setWorking(true);

    if (mode === "whole") {
      const { error } = await supabase.from("tokens").update({ owner_wallet: recipKey } as never).eq("id", token.id);
      if (error) { toast.error(error.message); setWorking(false); return; }
      await supabase.from("token_transfers").insert({
        token_id: token.id,
        kind: "whole",
        from_party: SELF_WALLET,
        to_party: recipKey,
        amount: 1,
        tx_hash: fakeHash(),
      } as never);
    } else {
      if (!fraction || !ownerHolding) { toast.error("Not fractionalized"); setWorking(false); return; }
      if (amount <= 0 || amount > ownerHolding.shares) { toast.error("Invalid amount"); setWorking(false); return; }
      // decrement owner
      await supabase.from("token_holdings").update({ shares: ownerHolding.shares - amount } as never).eq("id", ownerHolding.id);
      // upsert recipient: check existing
      const { data: existing } = await supabase.from("token_holdings").select("*").eq("token_id", token.id).eq("holder", recipKey).maybeSingle();
      if (existing) {
        await supabase.from("token_holdings").update({ shares: (existing as Holding).shares + amount } as never).eq("id", (existing as Holding).id);
      } else {
        await supabase.from("token_holdings").insert({ token_id: token.id, holder: recipKey, shares: amount } as never);
      }
      await supabase.from("token_transfers").insert({
        token_id: token.id,
        kind: "shares",
        from_party: SELF_WALLET,
        to_party: recipKey,
        amount,
        tx_hash: fakeHash(),
      } as never);
    }
    toast.success("Transfer broadcast");
    onDone();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "whole" ? "Transfer deed" : "Sell shares"}</DialogTitle>
          <DialogDescription>{property.name} · {shortHash(token.token_hash)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Recipient (wallet 0x… or email)</label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0xabc… or alice@example.com" className="mt-1" />
          </div>
          {mode === "shares" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Shares to transfer (you hold {ownerHolding?.shares.toLocaleString() ?? 0})</label>
              <Input type="number" min={1} max={ownerHolding?.shares ?? 0} value={amount} onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))} className="mt-1" />
              {fraction && <p className="mt-1 text-xs text-muted-foreground">Value: {fmtGBP(amount * fraction.price_per_share_pence)}</p>}
            </div>
          )}
          <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">From:</span><span>{shortHash(SELF_WALLET)}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted-foreground">To:</span><span className="text-primary">{recipient ? shortHash(recipient.startsWith("0x") ? recipient : `0x${btoa(recipient).slice(0, 38)}`) : "—"}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={working || !recipient.trim()}>{working ? "Broadcasting…" : "Confirm transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvestorView({
  properties,
  tokens,
  fractions,
  holdingsByToken,
  onChange,
}: {
  properties: Property[];
  tokens: Token[];
  fractions: Fraction[];
  holdingsByToken: Map<string, Holding[]>;
  onChange: () => void;
}) {
  const fractList = useMemo(() => {
    return fractions
      .map((f) => {
        const token = tokens.find((t) => t.id === f.token_id);
        const property = token ? properties.find((p) => p.id === token.property_id) : undefined;
        const held = holdingsByToken.get(f.token_id) ?? [];
        const owned = held.reduce((a, h) => a + h.shares, 0);
        const available = Math.max(0, f.total_supply - owned + (held.find((h) => h.holder === SELF_WALLET)?.shares ?? 0));
        return { f, token, property, available };
      })
      .filter((r) => r.token && r.property);
  }, [fractions, tokens, properties, holdingsByToken]);

  const [buyFor, setBuyFor] = useState<typeof fractList[number] | null>(null);

  if (fractList.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No fractionalized properties on the market yet. Switch to <span className="font-semibold text-foreground">Owner</span> and fractionalize a deed.</p>
      </div>
    );
  }

  return (
    <>
      <p className="mt-6 text-sm text-muted-foreground">Browse properties that have been fractionalized and are open to investors. Each share is an ERC-20 token redeemable for a slice of the underlying deed.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fractList.map((row) => (
          <div key={row.f.token_id} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-gradient-to-br from-emerald-500/15 via-card to-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Open offering</p>
              <p className="mt-1 text-base font-bold">{row.property!.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{shortHash(row.token!.token_hash)}</p>
            </div>
            <div className="space-y-2 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Price / share</span><span className="font-semibold">{fmtGBP(row.f.price_per_share_pence)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total supply</span><span>{row.f.total_supply.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valuation</span><span className="text-emerald-300">{fmtGBP(row.f.total_supply * row.f.price_per_share_pence)}</span></div>
              <Button size="sm" className="mt-2 w-full" onClick={() => setBuyFor(row)}>Buy shares</Button>
            </div>
          </div>
        ))}
      </div>
      {buyFor && (
        <BuyDialog
          token={buyFor.token!}
          property={buyFor.property!}
          fraction={buyFor.f}
          onDone={() => { setBuyFor(null); onChange(); }}
          onClose={() => setBuyFor(null)}
        />
      )}
    </>
  );
}

function BuyDialog({ token, property, fraction, onDone, onClose }: { token: Token; property: Property; fraction: Fraction; onDone: () => void; onClose: () => void }) {
  const [investor, setInvestor] = useState("");
  const [amount, setAmount] = useState(10);
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!investor.trim() || amount <= 0) return;
    setWorking(true);
    const investorKey = investor.startsWith("0x") ? investor : `0x${btoa(investor).replace(/=/g, "").slice(0, 38).padEnd(38, "0")}`;
    // reduce owner holding
    const { data: ownerH } = await supabase.from("token_holdings").select("*").eq("token_id", token.id).eq("holder", SELF_WALLET).maybeSingle();
    if (ownerH && (ownerH as Holding).shares >= amount) {
      await supabase.from("token_holdings").update({ shares: (ownerH as Holding).shares - amount } as never).eq("id", (ownerH as Holding).id);
    }
    const { data: existing } = await supabase.from("token_holdings").select("*").eq("token_id", token.id).eq("holder", investorKey).maybeSingle();
    if (existing) {
      await supabase.from("token_holdings").update({ shares: (existing as Holding).shares + amount } as never).eq("id", (existing as Holding).id);
    } else {
      await supabase.from("token_holdings").insert({ token_id: token.id, holder: investorKey, shares: amount } as never);
    }
    await supabase.from("token_transfers").insert({
      token_id: token.id,
      kind: "shares",
      from_party: SELF_WALLET,
      to_party: investorKey,
      amount,
      tx_hash: fakeHash(),
    } as never);
    toast.success(`Bought ${amount} shares of ${property.name}`);
    onDone();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buy shares · {property.name}</DialogTitle>
          <DialogDescription>Simulated purchase — settled on base-sim.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Investor wallet or email</label>
            <Input value={investor} onChange={(e) => setInvestor(e.target.value)} placeholder="0xabc… or jane@example.com" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Number of shares</label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">Cost: {fmtGBP(amount * fraction.price_per_share_pence)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={working || !investor.trim()}>{working ? "Settling…" : "Confirm purchase"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}