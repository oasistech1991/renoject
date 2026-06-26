import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

const STORAGE_KEY = "renoject_tour_completed_v1";

type Step = {
  title: string;
  body: string;
  route?: string;
  cta?: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to Renoject",
    body: "A 60-second tour of the platform — deals, tools and your CRM. You can skip anytime.",
    cta: "Start tour",
  },
  {
    title: "Deal Feed",
    body: "Browse live and upcoming property deals from the Renoject team. React, comment, show interest or speak to the team directly on any deal.",
    route: "/feed",
  },
  {
    title: "Refinance Calculator",
    body: "Run BRRR numbers in seconds. Drag-and-drop a PDF deal pack and we'll prefill the inputs — bridging, mortgage and cash scenarios included.",
    route: "/refinance",
  },
  {
    title: "HMO Compliance",
    body: "Upload a floorplan and we'll check room sizes, fire safety and amenity ratios against UK HMO standards.",
    route: "/hmo-compliance",
  },
  {
    title: "Legal Pack Review",
    body: "Drop a legal pack PDF and get red flags, missing documents and key dates in under a minute. Ask follow-up questions inline.",
    route: "/legal",
  },
  {
    title: "Team CRM",
    body: "Your command centre — sales pipeline, active projects, lettings, contractors and leads. Built for property dev teams.",
    route: "/crm",
  },
  {
    title: "Your Profile",
    body: "Set your investor preferences, available capital and watch live progress on any projects you're invested in.",
    route: "/profile",
  },
  {
    title: "Renoject Copilot",
    body: "The orange chat icon in the bottom-right is your AI assistant — ask it anything about your deals, projects or the platform.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("renoject:start-tour", handler);
    return () => window.removeEventListener("renoject:start-tour", handler);
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const next = () => {
    const ns = step + 1;
    if (ns >= STEPS.length) {
      close();
      return;
    }
    const target = STEPS[ns];
    if (target.route) navigate({ to: target.route });
    setStep(ns);
  };

  const prev = () => {
    const ns = Math.max(0, step - 1);
    const target = STEPS[ns];
    if (target.route) navigate({ to: target.route });
    setStep(ns);
  };

  if (!open) return null;
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl">
        <button
          onClick={close}
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        <h2 className="text-xl font-bold text-foreground">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

        <div className="mt-5 flex h-1 gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            onClick={close}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={prev}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
            )}
            <Button size="sm" onClick={next} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isLast ? "Finish" : current.cta ?? "Next"}
              {!isLast && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function startOnboardingTour() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("renoject:start-tour"));
}
