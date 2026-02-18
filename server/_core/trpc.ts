import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ENV } from "./env";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
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
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // Check admin JWT token from Authorization header
    const authHeader = ctx.req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { jwtVerify } = await import("jose");
        const secret = new TextEncoder().encode(ENV.adminJwtSecret);
        const token = authHeader.slice(7);
        const { payload } = await jwtVerify(token, secret);
        if (payload.role === "admin") {
          return next({ ctx });
        }
      } catch {
        // Token invalid, fall through to other checks
      }
    }

    // DEV MODE: Skip auth check in development
    if (!ENV.isProduction) {
      return next({ ctx });
    }

    // Existing OAuth check
    if (!ctx.user || ctx.user.role !== 'admin') {
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
