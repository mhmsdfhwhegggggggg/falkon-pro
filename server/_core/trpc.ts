import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const licenseProtectedProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const { licenseManager } = await import("../services/license-manager");

    // Fetch hardware ID from headers if available
    const hwid = ctx.req?.headers["x-hwid"] as string;

    // Fetch the active license for the current user from DB
    const license = await licenseManager.getUserActiveLicense(ctx.user!.id);

    if (!license || license.status !== "active") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "A valid and active license is required to access this feature.",
      });
    }

    // Check HWID if license is bound
    if (license.hardwareId && hwid && license.hardwareId !== hwid) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "License is bound to another device.",
        });
    }

    return next({
      ctx: {
        ...ctx,
        license,
      },
    });
  }),
);
