// Netlify Functions entry point.
//
// Reuses the same Express app (tRPC router + OAuth routes) that already
// powers the Vercel deployment in `api/index.ts`, wrapped with
// `serverless-http` so it can run inside an AWS-Lambda-style handler.
//
// Netlify routes `/api/*` requests here (see redirects in netlify.toml).
// The redirect target keeps the `/api/...` prefix in the "splat" so that,
// after Netlify prepends the function path, we can strip the function's own
// prefix back off and hand the Express app the exact same path it already
// expects (e.g. `/api/trpc/...`, `/api/auth/google`, ...).
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import serverless from "serverless-http";
import app from "../../api/index.js";

const serverlessHandler = serverless(app);

const FUNCTION_PREFIX = "/.netlify/functions/api";

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const path = event.path.startsWith(FUNCTION_PREFIX)
    ? event.path.slice(FUNCTION_PREFIX.length) || "/"
    : event.path;

  // @ts-expect-error - serverless-http's typings expect the raw Lambda event shape
  return serverlessHandler({ ...event, path }, context);
};
