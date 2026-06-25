import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { COMPLIANCE_TYPES, expiryStatus, type ComplianceItem, type Property } from "./types";

export function ComplianceView() {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [props, setProps] = useState<Record<string, Property>>({});
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [c, p] = await Promise.all([
      supabase.from("crm_compliance_items").select("*").order("expires_on", { ascending: true, nullsFirst: false }),
      supabase.from("crm_properties").select("*"),
    ]);
    setItems((c.data as ComplianceItem[]) ?? []);
    const pm: Record<string, Property> = {}; (p.data ?? []).forEach((x: any) => { pm[x.id] = x; });
    setProps(pm);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onAdd = (e: Event) => { if ((e as CustomEvent).detail === "compliance") setOpen(true); };
    const onChanged = () => load();
    window.addEventListener("crm:open-add", onAdd);
    window.addEventListener("crm:data-changed", onChanged);
    return () => {
      window.removeEventListener("crm:open-add", onAdd);
      window.removeEventListener("crm:data-changed", onChanged);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{items.length} certificates</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add certificate</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New certificate</DialogTitle></DialogHeader>
            <NewCert props={Object.values(props)} onCreated={() => { setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Document</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => {
              const s = expiryStatus(c.expires_on);
              return (
                <TableRow key={c.id}>
                  <TableCell>{props[c.property_id]?.address ?? "—"}</TableCell>
                  <TableCell className="font-medium">{c.type}</TableCell>
                  <TableCell>{c.issued_on ? new Date(c.issued_on).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{c.expires_on ? new Date(c.expires_on).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={s.color}>{s.label}</Badge></TableCell>
                  <TableCell>{c.document_url ? <a className="text-orange-400 underline" href={c.document_url} target="_blank" rel="noreferrer">View</a> : "—"}</TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No certificates logged</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function NewCert({ props, onCreated }: { props: Property[]; onCreated: () => void }) {
  const [propertyId, setPropertyId] = useState(props[0]?.id ?? "");
  const [type, setType] = useState<string>(COMPLIANCE_TYPES[0]);
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [url, setUrl] = useState("");

  const submit = async () => {
    if (!propertyId) return toast.error("Pick a property");
    const { error } = await supabase.from("crm_compliance_items").insert({
      property_id: propertyId, type, issued_on: issuedOn || null, expires_on: expiresOn || null, document_url: url || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Certificate added");
    onCreated();
  };

  return (
    <div className="space-y-3">
      <Select value={propertyId} onValueChange={setPropertyId}>
        <SelectTrigger><SelectValue placeholder="Property" /></SelectTrigger>
        <SelectContent>{props.map((p) => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={type} onValueChange={setType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{COMPLIANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-xs text-muted-foreground">Issued</label><Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Expires</label><Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></div>
      </div>
      <Input placeholder="Document URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button onClick={submit} className="w-full">Save</Button>
    </div>
  );
}