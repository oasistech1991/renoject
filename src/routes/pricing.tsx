import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HARTSTONE HOLDINGS" },
      { name: "description", content: "Unlock Market Search and Tradesmen background checks for £1/month." },
    ],
  }),
  component: PricingPage,
});

const FEATURES_FREE = [
  "BTL, HMO & Renovation calculators",
  "Property Calculator & Refinance modelling",
  "Forecast tools",
  "Saved deals",
];
const FEATURES_PRO = [
  "Everything in Free",
  "Market Search with investor filters",
  "Tradesmen directory",
  "Background checks on companies & directors",
  "Cancel any time",
];

function PricingPage() {
  const ent = useEntitlement();
  const navigate = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();

  const onSubscribe = async () => {
    if (!ent.isAuthenticated) {
      navigate({ to: "/auth", search: { redirect: "/pricing" } });
      return;
    }
    await openCheckout({
      priceId: "hartstone_pro_monthly",
      customerEmail: ent.email ?? undefined,
      customData: { userId: ent.userId! },
      successUrl: `${window.location.origin}/account?checkout=success`,
    });
  };

  return (
    <>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Simple pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade to Pro to unlock Market Search and Tradesmen background checks.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Plan
            name="Free"
            price="£0"
            cadence="forever"
            features={FEATURES_FREE}
            cta={<Button variant="outline" asChild className="w-full"><Link to="/">Open tools</Link></Button>}
          />
          <Plan
            highlight
            name="Hartstone Pro"
            price="£1"
            cadence="per month"
            features={FEATURES_PRO}
            cta={
              ent.isSubscriber ? (
                <Button asChild className="w-full"><Link to="/account">Manage subscription</Link></Button>
              ) : (
                <Button onClick={onSubscribe} disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Subscribe
                </Button>
              )
            }
          />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Payments handled by Paddle as our Merchant of Record. See our{" "}
          <Link to="/terms" className="underline">Terms</Link>,{" "}
          <Link to="/refund-policy" className="underline">Refund Policy</Link> and{" "}
          <Link to="/privacy" className="underline">Privacy Notice</Link>.
        </p>
      </div>
    </>
  );
}

function Plan({
  name, price, cadence, features, cta, highlight,
}: { name: string; price: string; cadence: string; features: string[]; cta: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-8 ${highlight ? "border-primary bg-card shadow-lg" : "border-border bg-card/50"}`}>
      <h3 className="text-lg font-semibold">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}