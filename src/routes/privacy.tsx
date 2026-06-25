import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — HARTSTONE HOLDINGS" },
      { name: "description", content: "How Hartstone Holdings handles your personal data." },
      { property: "og:url", content: "https://hartstoneholdings.com/privacy" },
    ],
    links: [
      { rel: "canonical", href: "https://hartstoneholdings.com/privacy" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">Privacy Notice</h1>
      <p className="text-xs text-muted-foreground">Last updated: 6 June 2026</p>

      <h2 className="mt-6 text-lg font-semibold">1. Who we are</h2>
      <p>
        Hartstone Holdings ("we", "us") provides the Hartstone Holdings
        property investment tools. For data we process about you in
        connection with the Service, we act as the data controller.
      </p>

      <h2 className="mt-6 text-lg font-semibold">2. Personal data we collect</h2>
      <ul className="list-disc pl-5">
        <li><strong>Account data</strong> — email address, password hash, profile.</li>
        <li><strong>Usage data</strong> — pages visited, features used, calculations saved, search queries.</li>
        <li><strong>Device &amp; technical data</strong> — IP address, browser type, device identifiers, cookies.</li>
        <li><strong>Support communications</strong> — emails and messages you send us.</li>
        <li><strong>Payment data</strong> — handled directly by Paddle; we receive only subscription status and the last four digits / brand of your card from Paddle for billing display purposes.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">3. Why we use it</h2>
      <ul className="list-disc pl-5">
        <li>Creating and operating your account (contract performance).</li>
        <li>Providing and improving the Service (legitimate interests).</li>
        <li>Security, fraud prevention and abuse detection (legitimate interests).</li>
        <li>Responding to support requests (contract performance / legitimate interests).</li>
        <li>Sending operational emails (legitimate interests) and marketing where you have consented (consent).</li>
        <li>Meeting legal obligations.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">4. Who we share data with</h2>
      <ul className="list-disc pl-5">
        <li><strong>Hosting &amp; infrastructure</strong> — cloud providers we use to run the Service.</li>
        <li><strong>Analytics &amp; support tooling</strong> — providers that help us understand and improve usage.</li>
        <li><strong>Professional advisers</strong> — legal and accounting, where required.</li>
        <li><strong>Authorities</strong> — where required by law.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">5. International transfers</h2>
      <p>
        Some recipients may be based outside the UK / EEA. Where this
        happens, we rely on appropriate safeguards such as Standard
        Contractual Clauses or UK/EU adequacy decisions.
      </p>

      <h2 className="mt-6 text-lg font-semibold">6. Retention</h2>
      <p>
        We keep account data while your account is active and for a
        reasonable period afterwards to comply with legal obligations and
        resolve disputes. We delete or anonymise data when it is no longer
        needed.
      </p>

      <h2 className="mt-6 text-lg font-semibold">7. Your rights</h2>
      <p>
        Under UK / EU GDPR you have the right to access, rectify, erase,
        restrict or object to processing of your personal data, the right to
        data portability, the right to withdraw consent at any time, and the
        right to lodge a complaint with a supervisory authority (e.g. the UK
        ICO). We will respond to requests within one month.
      </p>

      <h2 className="mt-6 text-lg font-semibold">8. Security</h2>
      <p>
        We use appropriate technical and organisational measures including
        encryption in transit, access controls, and least-privilege roles for
        our staff.
      </p>

      <h2 className="mt-6 text-lg font-semibold">9. Cookies</h2>
      <p>
        We use essential cookies to keep you signed in and analytics cookies
        to understand how the Service is used. You can manage cookies in your
        browser settings.
      </p>

      <h2 className="mt-6 text-lg font-semibold">10. Contact</h2>
      <p>
        For any privacy question or to exercise your rights, email{" "}
        <a className="underline" href="mailto:privacy@hartstoneholdings.com">privacy@hartstoneholdings.com</a>.
      </p>
    </article>
  );
}