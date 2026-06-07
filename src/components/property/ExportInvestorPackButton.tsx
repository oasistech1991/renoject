import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportInvestorPack } from "@/lib/investor-pdf";
import { FileDown } from "lucide-react";

interface Props {
  propertyId: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  label?: string;
  className?: string;
}

export function ExportInvestorPackButton({
  propertyId,
  size = "sm",
  variant = "outline",
  label = "Export investor pack",
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const id = toast.loading("Generating investor pack…");
    try {
      await exportInvestorPack(propertyId);
      toast.success("Investor pack downloaded", { id });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate PDF", { id });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={busy}
      className={className}
    >
      <FileDown className="mr-1.5 h-3.5 w-3.5" />
      {busy ? "Generating…" : label}
    </Button>
  );
}