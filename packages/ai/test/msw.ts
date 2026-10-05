import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

export function usarServidor(...handlers: RequestHandler[]) {
  const servidor = setupServer(...handlers);
  beforeAll(() => servidor.listen({ onUnhandledFrame: "error" }));
  afterEach(() => servidor.resetHandlers());
  afterAll(() => servidor.close());
  return servidor;
}
