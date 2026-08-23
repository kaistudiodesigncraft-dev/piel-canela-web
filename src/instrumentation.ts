import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  console.error("request_error", {
    message: error instanceof Error ? error.message : String(error),
    route: context.routePath,
    routerKind: context.routerKind,
    method: request.method,
    path: request.path,
  });
};
