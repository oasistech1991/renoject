import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HARTSTONE HOLDINGS" },
      { name: "description", content: "Every Hartstone Holdings tool is free to use — no subscription required." },
      { property: "og:url", content: "https://hartstoneholdings.com/pricing" },
    ],
    links: [
      { rel: "canonical", href: "https://hartstoneholdings.com/pricing" },
    ],
  }),
  component: PricingPage,
});

const FEATURES = [
  "Property Calculator & Refinance modelling",
  "BTL, HMO & Renovation calculators",
  "Forecast tools",
  "Saved deals",
  "Market Search with investor filters",
  "Tradesmen directory",
  "Background checks on companies & directors",
];

function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Everything is free</h1>
        <p className="mt-3 text-muted-foreground">
          Every Hartstone Holdings tool is free to use — no subscription required.
        </p>
      </div>

      <div className="mt-12 rounded-xl border border-primary bg-card p-8 shadow-lg">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">£0</span>
          <span className="ml-1 text-sm text-muted-foreground">forever</span>
        </div>
        <ul className="mt-6 space-y-2 text-sm">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Button asChild className="w-full"><Link to="/">Open the tools</Link></Button>
        </div>
      </div>
    </div>
  );
}