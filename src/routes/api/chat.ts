import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { calculateRefinance, type RefinanceInputs } from "@/lib/refinance";

const SYSTEM_PROMPT = `You are Renoject Copilot — a friendly, concise UK property development assistant inside the Renoject app.

You help with:
- Deals (BRRR, HMO, BTL, flips), refinance maths, ROI, cash-left-in
- The user's portfolio, free capital, upcoming refinance events
- Navigating Renoject (calculators, CRM, feed, legal review, construction timeline, market search)
- General UK property questions (SDLT, HMO licensing, Section 24, etc.)

Key Renoject routes you can suggest with the navigate tool:
/ (home), /refinance (BRRR calc), /properties (deals), /feed (client deal feed),
/crm (sales/portfolio/projects/lettings/leads), /construction-timeline, /legal (legal PDF review),
/hmo-compliance, /market (Rightmove search), /tradesmen, /messages, /profile, /forecast.

Style: short, direct, numeric when relevant. Use £ and %. Prefer bullet points. Never invent figures — ask first.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as { messages?: UIMessage[] };
        const incoming = Array.isArray(body.messages) ? body.messages : [];
        if (incoming.length === 0) {
          return new Response("Messages required", { status: 400 });
        }
        const lastUser = [...incoming].reverse().find((m) => m.role === "user");

        // Persist user message
        if (lastUser) {
          await supabase.from("copilot_messages" as never).insert({
            user_id: userId,
            role: "user",
            parts: lastUser.parts as unknown as object,
          } as never);
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          navigate: tool({
            description:
              "Suggest navigating the user to a Renoject route. The UI will show a 'Take me there' button.",
            inputSchema: z.object({
              path: z.string().describe("App path starting with /, e.g. /refinance"),
              label: z.string().describe("Short label, e.g. 'Open refinance calculator'"),
            }),
            execute: async ({ path, label }) => ({ path, label, kind: "navigate" }),
          }),
          getMyDeals: tool({
            description:
              "List the signed-in user's saved property deals with key inputs (address, purchase price, GDV, rent).",
            inputSchema: z.object({}),
            execute: async () => {
              const { data, error } = await supabase
                .from("properties")
                .select("id,inputs,results,created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(25);
              if (error) return { error: error.message };
              return {
                count: data?.length ?? 0,
                deals: (data ?? []).map((d: any) => ({
                  id: d.id,
                  address: d.inputs?.address ?? "Unnamed",
                  purchasePrice: d.inputs?.purchasePrice ?? null,
                  gdv: d.inputs?.gdv ?? null,
                  monthlyRent: d.inputs?.monthlyRent ?? null,
                  cashLeftIn: d.results?.cashLeftIn ?? null,
                  roiOnCashLeftIn: d.results?.roiOnCashLeftIn ?? null,
                })),
              };
            },
          }),
          getPortfolioSnapshot: tool({
            description:
              "Get the user's portfolio capital settings, upcoming refinance entries and total free capital.",
            inputSchema: z.object({}),
            execute: async () => {
              const [{ data: settings }, { data: injections }] = await Promise.all([
                supabase.from("portfolio_capital_settings").select("*").eq("user_id", userId).maybeSingle(),
                supabase
                  .from("portfolio_capital_injections")
                  .select("amount,date,label")
                  .eq("user_id", userId)
                  .limit(50),
              ]);
              return {
                startingCapital: (settings as any)?.starting_capital ?? 0,
                injections: injections ?? [],
              };
            },
          }),
          runRefinance: tool({
            description:
              "Run a quick BRRR refinance calculation. Provide minimum: purchasePrice, refurbCost, gdv, monthlyRent. Other fields use sensible defaults.",
            inputSchema: z.object({
              purchasePrice: z.number(),
              refurbCost: z.number(),
              gdv: z.number(),
              monthlyRent: z.number(),
              refiLtv: z.number().optional().describe("Refi LTV %, default 75"),
              refiRate: z.number().optional().describe("Refi rate %, default 5.5"),
              refurbMonths: z.number().optional().describe("Default 4"),
            }),
            execute: async (args) => {
              const inputs: RefinanceInputs = {
                purchasePrice: args.purchasePrice,
                deposit: 0,
                depositPct: 25,
                depositIsPct: true,
                stampDuty: 0,
                legalFees: 1500,
                surveyFees: 600,
                purchaseRate: 5.5,
                fixturesFittings: 0,
                furnishing: 0,
                brokerFees: 500,
                lenderFee: 0,
                additionalFees: 0,
                auctionFees: 0,
                sourcingFee: 0,
                refurbCost: args.refurbCost,
                refurbMonths: args.refurbMonths ?? 4,
                holdingMonthly: 250,
                useBridge: false,
                bridgeLoanPct: 70,
                bridgeFundsRefurb: false,
                bridgeRate: 9,
                bridgeRatePCM: 0.75,
                bridgeRateIsPCM: false,
                bridgeTermMonths: 12,
                bridgeArrangementPct: 2,
                bridgeArrangementIsPct: true,
                bridgeArrangementAmount: 0,
                bridgeExitPct: 1,
                bridgeInterestRolled: true,
                gdv: args.gdv,
                refiLtv: args.refiLtv ?? 75,
                refiRate: args.refiRate ?? 5.5,
                refiTermYears: 25,
                refiFees: 1500,
                lettableUnits: 1,
                currentMonthlyRent: 0,
                monthlyRent: args.monthlyRent,
                managementPct: 10,
                maintenancePct: 5,
                voidsPct: 5,
                insurance: 25,
                groundRent: 0,
                otherMonthly: 0,
                flipEnabled: false,
                flipSalePrice: 0,
                flipLegalFees: 0,
                flipAgencyFee: 0,
              };
              const r = calculateRefinance(inputs);
              return {
                verdict: r.verdictLabel,
                totalCashIn: Math.round(r.totalCashIn),
                cashReleased: Math.round(r.cashReleased),
                cashLeftIn: Math.round(r.cashLeftIn),
                capitalRecycledPct: Math.round(r.capitalRecycledPct),
                newLoan: Math.round(r.newLoan),
                monthlyCashflowIO: Math.round(r.monthlyCashflowIO),
                grossYield: Number(r.grossYield.toFixed(2)),
                roiOnCashLeftIn: Number.isFinite(r.roiOnCashLeftIn) ? Number(r.roiOnCashLeftIn.toFixed(1)) : null,
                profitOnPaper: Math.round(r.profitOnPaper),
              };
            },
          }),
        };

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(incoming),
          tools,
          stopWhen: stepCountIs(50),
          onError({ error }) {
            console.error("[copilot] streamText error", error);
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: incoming,
          onFinish: async ({ responseMessage }) => {
            try {
              await supabase.from("copilot_messages" as never).insert({
                user_id: userId,
                role: responseMessage.role,
                parts: responseMessage.parts as unknown as object,
              } as never);
            } catch (e) {
              console.error("[copilot] persist assistant message failed", e);
            }
          },
        });

        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});