import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Property Calculator — Hartstone Holdings" },
      { name: "description", content: "UK property investment calculator — BTL, BRRR, mortgage and cash purchase models." },
      { property: "og:title", content: "Property Calculator" },
      { property: "og:description", content: "BTL, BRRR, mortgage and cash purchase modelling in one tool." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Navigate to="/refinance" />;
}
