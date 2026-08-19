import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { cancelTestRun, configureSuite, createTestRun, dashboardSnapshot, deleteReportHistory, persistReconciliation, pruneReportHistory, reconciliationEvidence, reconciliationEvidenceInputSchema, reportDeletionSchema, reportFormatSchema, reportRetentionSchema, requestReport, resumeTestRun, retryTestRun, runDetail, runHistoryPage, suiteConfigInputSchema, testRunInputSchema } from "./dashboard";
import { getSuiteConfigurations } from "./db";
import { ingestFindings, parseJunit, parseSarif, recordProxyUpgradeFinding } from "./reportIngestion";
import { enforceProxyUpgradePolicy } from "./proxyGovernance";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dashboard: router({
    snapshot: publicProcedure.query(() => dashboardSnapshot()),
    createRun: protectedProcedure.input(testRunInputSchema).mutation(({ input }) => createTestRun(input)),
    requestReport: protectedProcedure.input(reportFormatSchema).mutation(({ input }) => requestReport(input)),
    deleteReportHistory: protectedProcedure.input(reportDeletionSchema).mutation(({ ctx, input }) => { if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); return deleteReportHistory(input); }),
    pruneReportHistory: protectedProcedure.input(reportRetentionSchema).mutation(({ ctx, input }) => { if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); return pruneReportHistory(input); }),
    configureSuite: protectedProcedure.input(suiteConfigInputSchema).mutation(({ input }) => configureSuite(input)),
    suiteConfigurations: protectedProcedure.query(() => getSuiteConfigurations()),
    runHistory: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(10), offset: z.number().int().min(0).default(0) }).optional()).query(({ input }) => runHistoryPage(input?.limit ?? 10, input?.offset ?? 0)),
    runDetail: protectedProcedure.input(z.object({ runId: z.string().min(1) })).query(({ input }) => runDetail(input.runId)),
    cancelRun: protectedProcedure.input(z.object({ runId: z.string().min(1) })).mutation(({ input }) => cancelTestRun(input.runId)),
    retryRun: protectedProcedure.input(z.object({ runId: z.string().min(1) })).mutation(({ input }) => retryTestRun(input.runId)),
    resumeRun: protectedProcedure.input(z.object({ runId: z.string().min(1) })).mutation(({ input }) => resumeTestRun(input.runId)),
    persistReconciliation: protectedProcedure.input(reconciliationEvidenceInputSchema).mutation(({ input }) => persistReconciliation(input)),
    reconciliationEvidence: protectedProcedure.query(() => reconciliationEvidence()),
    ingestSarif: protectedProcedure.input(z.object({ content: z.string().min(1) })).mutation(({ input }) => ingestFindings(parseSarif(input.content))),
    ingestJunit: protectedProcedure.input(z.object({ content: z.string().min(1) })).mutation(({ input }) => ingestFindings(parseJunit(input.content))),
    recordProxyUpgradeFinding: protectedProcedure.input(z.object({ proxyAddress: z.string().min(1), implementation: z.string().min(1), reason: z.enum(["UNAUTHORIZED_CALLER", "IMPLEMENTATION_NOT_ALLOWLISTED"]) })).mutation(({ input }) => recordProxyUpgradeFinding(input)),
    enforceProxyUpgrade: protectedProcedure.input(z.object({ proxyAddress: z.string().min(1), caller: z.string().min(1), admin: z.string().min(1), implementation: z.string().min(1), allowlisted: z.boolean() })).mutation(({ input }) => enforceProxyUpgradePolicy(input)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
