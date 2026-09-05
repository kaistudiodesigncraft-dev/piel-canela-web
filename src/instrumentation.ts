import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // Instrumentation can execute in the Edge runtime, where Node's crypto module
  // is unavailable. Web Crypto is present in both supported runtimes.
  const incidentId = globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
  console.error("request_error", {
    incidentId,
    errorName: error instanceof Error ? error.name : "unknown",
    route: context.routePath,
    routerKind: context.routerKind,
    method: request.method,
  });
};
