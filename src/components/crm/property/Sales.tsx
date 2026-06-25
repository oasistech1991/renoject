import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, MapPin, Home } from "lucide-react";
import {
  type Property, type PropertyStatus,
  PROPERTY_STATUSES, PROPERTY_STATUS_LABEL, PROPERTY_STATUS_COLOR, fmtGBP,
} from "./types";

const SOURCING_STAGES: PropertyStatus[] = ["sourcing", "under_offer", "owned"];

export function SalesBoard({ onOpenProperty }: { onOpenProperty: (id: string) => void }) {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("crm_properties").select("*").order("created_at", { ascending: false });
    setItems((data as Property[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onAdd = (e: Event) => { if ((e as CustomEvent).detail === "sales") setNewOpen(true); };
    const onChanged = () => load();
    window.addEventListener("crm:open-add", onAdd);
    window.addEventListener("crm:data-changed", onChanged);
    return () => {
      window.removeEventListener("crm:open-add", onAdd);
      window.removeEventListener("crm:data-changed", onChanged);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(SOURCING_STAGES.map((s) => [s, [] as Property[]])) as Record<PropertyStatus, Property[]>;
    items.forEach((p) => { if (SOURCING_STAGES.includes(p.status)) map[p.status].push(p); });
    return map;
  }, [items]);

  const move = async (id: string, status: PropertyStatus) => {
    const { error } = await supabase.from("crm_properties").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const totalGDV = items.reduce((a, b) => a + (b.current_value ?? 0), 0);
  const totalCost = items.reduce((a, b) => a + (b.purchase_price ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span><span className="text-foreground font-semibold">{items.length}</span> properties</span>
          <span>Pipeline GDV: <span className="text-foreground font-semibold">{fmtGBP(totalGDV)}</span></span>
          <span>Total cost: <span className="text-foreground font-semibold">{fmtGBP(totalCost)}</span></span>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New property</Button></DialogTrigger>
          <DialogContent><NewPropertyForm onCreated={() => { setNewOpen(false); load(); }} /></DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SOURCING_STAGES.map((stage) => (
          <div key={stage} className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="outline" className={PROPERTY_STATUS_COLOR[stage]}>{PROPERTY_STATUS_LABEL[stage]}</Badge>
              <span className="text-xs text-muted-foreground">{grouped[stage].length}</span>
            </div>
            <div className="space-y-2">
              {grouped[stage].map((p) => (
                <Card key={p.id} className="cursor-pointer p-3 hover:bg-accent/30" onClick={() => onOpenProperty(p.id)}>
                  <div className="flex items-start gap-2">
                    <Home className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.address}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtGBP(p.purchase_price)} → {fmtGBP(p.current_value)}
                      </p>
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <Select value={p.status} onValueChange={(v) => move(p.id, v as PropertyStatus)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROPERTY_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{PROPERTY_STATUS_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {!loading && grouped[stage].length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No properties</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewPropertyForm({ onCreated }: { onCreated: () => void }) {
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [propertyType, setPropertyType] = useState<"btl" | "hmo" | "flip" | "commercial" | "mixed" | "dev_site" | "other">("btl");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!address.trim()) return toast.error("Address required");
    setSaving(true);
    const { error } = await supabase.from("crm_properties").insert({
      address: address.trim(),
      postcode: postcode.trim() || null,
      property_type: propertyType,
      purchase_price: price ? Number(price) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Property added");
    onCreated();
  };

  return (
    <>
      <DialogHeader><DialogTitle>New property</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><label className="text-xs text-muted-foreground">Address *</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Town" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Postcode</label>
            <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="SW1 1AA" /></div>
          <div><label className="text-xs text-muted-foreground">Type</label>
            <Select value={propertyType} onValueChange={(v) => setPropertyType(v as typeof propertyType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="btl">Buy-to-let</SelectItem>
                <SelectItem value="hmo">HMO</SelectItem>
                <SelectItem value="flip">Flip</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="mixed">Mixed-use</SelectItem>
                <SelectItem value="dev_site">Dev site</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select></div>
        </div>
        <div><label className="text-xs text-muted-foreground">Purchase price (£)</label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250000" /></div>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </div>
      </div>
    </>
  );
}