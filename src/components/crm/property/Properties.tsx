import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import {
  type Property, PROPERTY_STATUS_LABEL, PROPERTY_STATUS_COLOR, fmtGBP,
} from "./types";

export function PropertiesTable({ onOpenProperty }: { onOpenProperty: (id: string) => void }) {
  const [items, setItems] = useState<Property[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("crm_properties").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as Property[]) ?? []));
  }, []);

  const filtered = items.filter((p) =>
    !q || p.address.toLowerCase().includes(q.toLowerCase()) || (p.postcode ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const totalValue = filtered.reduce((a, b) => a + (b.current_value ?? 0), 0);
  const totalEquity = filtered.reduce((a, b) => a + (b.equity ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address or postcode…" className="max-w-sm" />
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{filtered.length} properties</span>
          <span>Value: <span className="text-foreground font-semibold">{fmtGBP(totalValue)}</span></span>
          <span>Equity: <span className="text-foreground font-semibold">{fmtGBP(totalEquity)}</span></span>
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Bought</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Equity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpenProperty(p.id)}>
                <TableCell className="font-medium">{p.address}<div className="text-xs text-muted-foreground">{p.postcode ?? ""}</div></TableCell>
                <TableCell className="text-xs uppercase">{p.property_type}</TableCell>
                <TableCell><Badge variant="outline" className={PROPERTY_STATUS_COLOR[p.status]}>{PROPERTY_STATUS_LABEL[p.status]}</Badge></TableCell>
                <TableCell className="text-right">{fmtGBP(p.purchase_price)}</TableCell>
                <TableCell className="text-right">{fmtGBP(p.current_value)}</TableCell>
                <TableCell className="text-right">{fmtGBP(p.equity)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No properties yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}