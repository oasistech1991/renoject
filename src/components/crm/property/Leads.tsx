import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Mail, Phone } from "lucide-react";
import {
  type Lead, type LeadStatus, type LeadSource,
  LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_STATUS_COLOR, fmtGBP,
} from "./types";

export function LeadsInbox() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onAdd = (e: Event) => { if ((e as CustomEvent).detail === "leads") setOpen(true); };
    const onChanged = () => load();
    window.addEventListener("crm:open-add", onAdd);
    window.addEventListener("crm:data-changed", onChanged);
    return () => {
      window.removeEventListener("crm:open-add", onAdd);
      window.removeEventListener("crm:data-changed", onChanged);
    };
  }, []);

  const setStatus = async (id: string, status: LeadStatus) => {
    const { error } = await supabase.from("crm_leads").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setLeads((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          {LEAD_STATUSES.map((s) => (
            <span key={s}>{LEAD_STATUS_LABEL[s]}: <span className="text-foreground font-semibold">{leads.filter((l) => l.status === s).length}</span></span>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New lead</Button></DialogTrigger>
          <DialogContent><NewLeadForm onCreated={() => { setOpen(false); load(); }} /></DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Budget</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}<div className="text-xs text-muted-foreground">{l.interested_in ?? ""}</div></TableCell>
                <TableCell>
                  <div className="text-xs space-y-0.5">
                    {l.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{l.email}</div>}
                    {l.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{l.phone}</div>}
                  </div>
                </TableCell>
                <TableCell className="text-xs capitalize">{l.source}</TableCell>
                <TableCell>
                  <Select value={l.status} onValueChange={(v) => setStatus(l.id, v as LeadStatus)}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{LEAD_STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right text-xs">
                  {fmtGBP(l.budget_min)}{l.budget_max ? ` – ${fmtGBP(l.budget_max)}` : ""}
                </TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No leads yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function NewLeadForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<LeadSource>("website");
  const [interest, setInterest] = useState("");
  const [bmin, setBmin] = useState("");
  const [bmax, setBmax] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await supabase.from("crm_leads").insert({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      source, interested_in: interest.trim() || null,
      budget_min: bmin ? Number(bmin) : null,
      budget_max: bmax ? Number(bmax) : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lead added");
    onCreated();
  };

  return (
    <>
      <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="feed">Feed</SelectItem>
              <SelectItem value="portal">Portal</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="cold">Cold</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Interested in (e.g. HMO, BTL)" value={interest} onChange={(e) => setInterest(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Budget min £" type="number" value={bmin} onChange={(e) => setBmin(e.target.value)} />
          <Input placeholder="Budget max £" type="number" value={bmax} onChange={(e) => setBmax(e.target.value)} />
        </div>
        <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create"}</Button></div>
      </div>
    </>
  );
}