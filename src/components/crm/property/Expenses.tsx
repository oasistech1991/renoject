import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { fmtGBP, EXPENSE_CATEGORIES, type Expense, type Property } from "./types";

export function ExpensesView() {
  const [items, setItems] = useState<Expense[]>([]);
  const [props, setProps] = useState<Record<string, Property>>({});
  const [q, setQ] = useState("");
  const [propFilter, setPropFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [e, p] = await Promise.all([
      supabase.from("crm_expenses").select("*").order("date", { ascending: false }),
      supabase.from("crm_properties").select("*"),
    ]);
    setItems((e.data as Expense[]) ?? []);
    const pm: Record<string, Property> = {}; (p.data ?? []).forEach((x: any) => { pm[x.id] = x; });
    setProps(pm);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => {
    if (propFilter !== "all" && i.property_id !== propFilter) return false;
    if (!q) return true;
    return [i.category, i.notes, props[i.property_id]?.address].some((s) => s?.toLowerCase().includes(q.toLowerCase()));
  });

  const total = useMemo(() => filtered.reduce((a, b) => a + (b.amount ?? 0), 0), [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="max-w-xs" />
          <Select value={propFilter} onValueChange={setPropFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {Object.values(props).map((p) => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmtGBP(total)}</span></span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
              <NewExpense props={Object.values(props)} onCreated={() => { setOpen(false); load(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{new Date(i.date).toLocaleDateString()}</TableCell>
                <TableCell>{props[i.property_id]?.address ?? "—"}</TableCell>
                <TableCell className="capitalize">{i.category.replace(/_/g, " ")}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{i.notes ?? ""}</TableCell>
                <TableCell className="text-right">{fmtGBP(i.vat_amount)}</TableCell>
                <TableCell className="text-right font-semibold">{fmtGBP(i.amount)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No expenses</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function NewExpense({ props, onCreated }: { props: Property[]; onCreated: () => void }) {
  const [propertyId, setPropertyId] = useState(props[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<string>("maintenance");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!propertyId) return toast.error("Pick a property");
    const { error } = await supabase.from("crm_expenses").insert({
      property_id: propertyId, date, category, amount: Number(amount || 0), vat_amount: Number(vat || 0), notes: notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Expense added");
    onCreated();
  };

  return (
    <div className="space-y-3">
      <Select value={propertyId} onValueChange={setPropertyId}>
        <SelectTrigger><SelectValue placeholder="Property" /></SelectTrigger>
        <SelectContent>{props.map((p) => <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>)}</SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input type="number" placeholder="VAT" value={vat} onChange={(e) => setVat(e.target.value)} />
      </div>
      <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button onClick={submit} className="w-full">Save</Button>
    </div>
  );
}