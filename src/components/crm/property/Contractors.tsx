import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star } from "lucide-react";
import { fmtGBP } from "./types";
import { toast } from "sonner";

type Tradesman = {
  id: string; name: string; specialities: string[];
  area: string | null; phone: string | null; email: string | null;
};
type Meta = { tradesman_id: string; rating: number | null; default_rate: number | null; preferred: boolean; total_spend: number };

export function ContractorsRoster() {
  const [tradesmen, setTradesmen] = useState<Tradesman[]>([]);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [q, setQ] = useState("");

  const load = async () => {
    const [t, m] = await Promise.all([
      supabase.from("tradesmen").select("id, name, specialities, area_covered, phone, email"),
      supabase.from("crm_contractor_meta").select("*"),
    ]);
    setTradesmen(((t.data as any[]) ?? []).map((x) => ({
      id: x.id, name: x.name, specialities: x.specialities ?? [],
      area: x.area_covered, phone: x.phone, email: x.email,
    })));
    const map: Record<string, Meta> = {};
    (m.data ?? []).forEach((x: any) => { map[x.tradesman_id] = x; });
    setMeta(map);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener("crm:data-changed", onChanged);
    return () => window.removeEventListener("crm:data-changed", onChanged);
  }, []);

  const upsertMeta = async (id: string, patch: Partial<Meta>) => {
    const next = { ...meta[id], ...patch, tradesman_id: id } as any;
    const { error } = await supabase.from("crm_contractor_meta").upsert(next, { onConflict: "tradesman_id" });
    if (error) return toast.error(error.message);
    setMeta((m) => ({ ...m, [id]: { ...(m[id] ?? { tradesman_id: id, rating: null, default_rate: null, preferred: false, total_spend: 0 }), ...patch } }));
  };

  const filtered = tradesmen.filter((t) =>
    !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.specialities.join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contractor or trade…" className="max-w-sm" />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Total spend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const m = meta[t.id];
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {t.name ?? "Unnamed"}
                    {m?.preferred && <Badge variant="outline" className="ml-2 border-amber-500/30 bg-amber-500/15 text-amber-300">★ Preferred</Badge>}
                  </TableCell>
                  <TableCell className="text-xs capitalize">{t.specialities.join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.area ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => upsertMeta(t.id, { rating: n })}>
                          <Star className={`h-4 w-4 ${m && m.rating && m.rating >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs">{m?.default_rate ? `${fmtGBP(m.default_rate)}/day` : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{fmtGBP(m?.total_spend ?? 0)}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No contractors yet — add via Tradesmen page.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}