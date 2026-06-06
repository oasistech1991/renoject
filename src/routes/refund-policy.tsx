import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — HARTSTONE HOLDINGS" },
      { name: "description", content: "Hartstone Holdings 30-day money-back guarantee." },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold">Refund Policy</h1>
      <p className="text-xs text-muted-foreground">Last updated: 6 June 2026</p>

      <p className="mt-6">
        We offer a <strong>30-day money-back guarantee</strong>. If you are
        not satisfied with your Hartstone Holdings subscription, you can
        request a full refund within 30 days of your initial purchase.
      </p>

      <h2 className="mt-6 text-lg font-semibold">How to request a refund</h2>
      <p>
        Refunds are processed by our payment provider, Paddle, who acts as
        the Merchant of Record for all our orders. To request a refund:
      </p>
      <ul className="list-disc pl-5">
        <li>
          Visit{" "}
          <a className="underline" href="https://paddle.net" target="_blank" rel="noreferrer">paddle.net</a>{" "}
          and look up your order using the email address you used at checkout, or
        </li>
        <li>
          Contact us at{" "}
          <a className="underline" href="mailto:support@hartstoneholdings.com">support@hartstoneholdings.com</a>{" "}
          and we will help you raise the request.
        </li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">Cancellation</h2>
      <p>
        You can cancel your subscription at any time from the{" "}
        <strong>Account</strong> page. Cancelling stops future renewals; you
        retain access until the end of your current billing period.
      </p>
    </article>
  );
}