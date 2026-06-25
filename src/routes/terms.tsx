import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — HARTSTONE HOLDINGS" },
      { name: "description", content: "Hartstone Holdings terms of service." },
      { property: "og:url", content: "https://hartstoneholdings.com/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://hartstoneholdings.com/terms" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">Terms &amp; Conditions</h1>
      <p className="text-xs text-muted-foreground">Last updated: 6 June 2026</p>

      <h2 className="mt-8 text-lg font-semibold">1. Who we are</h2>
      <p>
        These terms govern your use of the Hartstone Holdings property
        investment tools (the "Service"), operated by Hartstone Holdings
        ("we", "us"). By creating an account or continuing to use the Service
        you agree to these terms.
      </p>

      <h2 className="mt-6 text-lg font-semibold">2. The Service</h2>
      <p>
        The Service provides UK buy-to-let, HMO, refinance and renovation
        calculators, market search tooling and an internal tradesman
        directory. Calculations are illustrative only and do not constitute
        financial, tax, legal or investment advice. You are responsible for
        verifying any figures before acting on them.
      </p>

      <h2 className="mt-6 text-lg font-semibold">3. Acceptable use</h2>
      <p>You must not:</p>
      <ul className="list-disc pl-5">
        <li>use the Service unlawfully or for fraudulent activity;</li>
        <li>infringe anyone's intellectual property rights;</li>
        <li>upload malware or attempt to probe, scan or breach security;</li>
        <li>scrape, resell or redistribute the Service or its content;</li>
        <li>reverse engineer or circumvent technical limits.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">4. Intellectual property</h2>
      <p>
        We retain ownership of the Service, including its software, content,
        branding and documentation. You receive a limited, non-exclusive,
        non-transferable right to use the Service within your active plan.
      </p>

      <h2 className="mt-6 text-lg font-semibold">5. Accounts</h2>
      <p>
        You are responsible for keeping your credentials confidential and for
        all activity under your account. You must provide accurate
        information and keep it up to date.
      </p>

      <h2 className="mt-6 text-lg font-semibold">6. Service level</h2>
      <p>
        We provide the Service "as is" and do not guarantee that it will be
        uninterrupted, error-free, or that any specific result will be
        achieved. To the fullest extent permitted by law we disclaim all
        implied warranties, including merchantability and fitness for a
        particular purpose.
      </p>

      <h2 className="mt-6 text-lg font-semibold">8. Liability</h2>
      <p>
        To the fullest extent permitted by law, our aggregate liability for
        any claims arising from your use of the Service is limited to the
        fees you paid us in the 12 months before the claim. We are not liable
        for indirect, consequential or special damages, including loss of
        profits, data or goodwill. Nothing in these terms excludes liability
        for fraud, death or personal injury where it cannot lawfully be
        excluded.
      </p>

      <h2 className="mt-6 text-lg font-semibold">9. Suspension &amp; termination</h2>
      <p>
        We may suspend or terminate access for material breach of these
        terms, non-payment, suspected fraud or security risk, or repeated
        policy violations. When access ends you may export any data you have
        saved within 30 days; after that we may delete it.
      </p>

      <h2 className="mt-6 text-lg font-semibold">10. Governing law</h2>
      <p>
        These terms are governed by the laws of England &amp; Wales, and the
        courts of England &amp; Wales have exclusive jurisdiction.
      </p>

      <h2 className="mt-6 text-lg font-semibold">11. Changes</h2>
      <p>
        We may update these terms from time to time. Material changes will be
        notified by email or in-app banner.
      </p>
    </article>
  );
}