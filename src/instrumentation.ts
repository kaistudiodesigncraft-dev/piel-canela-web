import type { Instrumentation } from "next";
import { createSupportCode, reportOperationalEvent } from "@/lib/observability";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // Instrumentation can execute in the Edge runtime, where Node's crypto module
  // is unavailable. Web Crypto is present in both supported runtimes.
  reportOperationalEvent({
    event: "request_error",
    stage: `${context.routerKind}:${request.method}:${context.routePath}`,
    code: error instanceof Error ? error.name : "unknown",
    supportCode: createSupportCode(),
  });
};
