import { type Instrumentation } from "next";
import { reportError } from "@/lib/error-report";

// Every error the server hits that nobody caught lands in the internal error log, whatever page or action it came from.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  await reportError(`${context.routeType}`, message, { path: request.path, digest });
};
