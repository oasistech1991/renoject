import { ReactNode } from "react";

// All features are free — this component is a pass-through.
export function PaywallGate({ children }: { children: ReactNode; feature?: string }) {
  return <>{children}</>;
}