import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, FileText } from "lucide-react";
import { DOCUMENT_KINDS, type CrmDocument, type Property } from "./types";

export function DocumentsView() {
  const [items, setItems] = useState<CrmDocument[]>([]);
  const [props, setProps] = useState<Record<string, Property>>({});
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [d, p] = await Promise.all([
      supabase.from("crm_documents").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("crm_properties").select("*"),
    ]);
    setItems((d.data as CrmDocument[]) ?? []);
    const pm: Record<string, Property> = {}; (p.data ?? []).forEach((x: any) => { pm[x.id] = x; });
    setProps(pm);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onAdd = (e: Event) => { if ((e as CustomEvent).detail === "documents") setOpen(true); };
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
        <span className="text-sm text-muted-foreground">{items.length} documents</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add document</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New document</DialogTitle></DialogHeader>
            <NewDoc props={Object.values(props)} onCreated={() => { setOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.name}</TableCell>
                <TableCell className="capitalize">{d.kind.replace(/_/g, " ")}</TableCell>
                <TableCell>{props[d.property_id]?.address ?? "—"}</TableCell>
                <TableCell>{new Date(d.uploaded_at).toLocaleDateString()}</TableCell>
                <TableCell><a className="text-orange-400 underline" href={d.file_url} target="_blank" rel="noreferrer">Open</a></TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No documents</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function NewDoc({ props, onCreated }: { props: Property[]; onCreated: () => void }) {
  const [propertyId, setPropertyId] = useState(props[0]?.id ?? "");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("other");
  const [url, setUrl] = useState("");

  const submit = async () => {
    if (!propertyId || !name || !url) return toast.error("Property, name and link are required");
    const { error } = await supabase.from("crm_documents").insert({
      property_id: propertyId, name, kind, file_url: url,
    });
    if (error) return toast.error(error.message);
    toast.success("Document added");
    onCreated();
  };

  return (
    <div className="space-y-3">
      <Select value={propertyId} onValueChange={setPropertyId}>
        <SelectTrigger><SelectValue placeholder="Property" /></SelectTrigger>
        <SelectContent>{props.map((p) => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
      </Select>
      <Input placeholder="Document name" value={name} onChange={(e) => setName(e.target.value)} />
      <Select value={kind} onValueChange={setKind}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{DOCUMENT_KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
      </Select>
      <Input placeholder="File URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Button onClick={submit} className="w-full">Save</Button>
    </div>
  );
}