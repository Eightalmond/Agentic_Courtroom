import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { demoPresets, getCustomerPersona, getCustomerTask, MAX_ACTIONS, MIN_ACTIONS } from "@/lib/test-runs";
import {
  DEFAULT_COURTROOM_RATE_LIMIT,
  DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
  DEFAULT_SIMULATION_RATE_LIMIT,
  parseDemoConfiguration,
  parseDemoMode,
} from "./config";
import { toDisplayError } from "./errors";
import { SECURITY_HEADERS } from "./security";
import {
  acquireProviderRequest,
  consumeRateLimit,
  createRateLimitStore,
  executeRateLimited,
  getPrivacySafeClientKey,
} from "@/lib/server/rate-limit";
import { assertSameOrigin, readBoundedJson, RequestBoundaryError } from "@/lib/server/request-boundary";
import nextConfig from "../../next.config";

function request(address = "203.0.113.41") {
  return new Request("https://demo.example/api/simulations/step", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "demo-test",
      "x-vercel-forwarded-for": address,
    },
    body: "{}",
  });
}

const limiterEnvironment = {
  VERCEL: "1",
  SIMULATION_RATE_LIMIT: "2",
  COURTROOM_RATE_LIMIT: "1",
  RATE_LIMIT_WINDOW_SECONDS: "10",
};

describe("public demo configuration", () => {
  it("parses true and false and defaults to the visible demo mode", () => {
    expect(parseDemoMode("true")).toBe(true);
    expect(parseDemoMode("FALSE")).toBe(false);
    expect(parseDemoMode(undefined)).toBe(true);
  });

  it("handles unknown and malformed values with safe defaults", () => {
    expect(parseDemoMode("sometimes")).toBe(true);
    expect(parseDemoConfiguration({ SIMULATION_RATE_LIMIT: "0", COURTROOM_RATE_LIMIT: "many", RATE_LIMIT_WINDOW_SECONDS: "-1" })).toEqual({
      demoMode: true,
      simulationRateLimit: DEFAULT_SIMULATION_RATE_LIMIT,
      courtroomRateLimit: DEFAULT_COURTROOM_RATE_LIMIT,
      windowSeconds: DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    });
  });

  it("keeps every recommended preset tied to valid bounded configuration", () => {
    expect(demoPresets).toHaveLength(3);
    for (const preset of demoPresets) {
      expect(getCustomerTask(preset.taskId)).toBeDefined();
      expect(getCustomerPersona(preset.personaId)).toBeDefined();
      expect(preset.maxActions).toBeGreaterThanOrEqual(MIN_ACTIONS);
      expect(preset.maxActions).toBeLessThanOrEqual(MAX_ACTIONS);
    }
  });
});

describe("best-effort application rate limiting", () => {
  it("limits simulation requests and returns a sensible retry window", () => {
    const store = createRateLimitStore();
    expect(consumeRateLimit(request(), "simulation", { now: 1_000, store, environment: limiterEnvironment })).toMatchObject({ allowed: true, remaining: 1 });
    expect(consumeRateLimit(request(), "simulation", { now: 1_100, store, environment: limiterEnvironment })).toMatchObject({ allowed: true, remaining: 0 });
    expect(consumeRateLimit(request(), "simulation", { now: 1_200, store, environment: limiterEnvironment })).toMatchObject({ allowed: false, retryAfterSeconds: 10 });
  });

  it("keeps simulation, courtroom, and different-client buckets independent", () => {
    const store = createRateLimitStore();
    consumeRateLimit(request(), "courtroom", { now: 1_000, store, environment: limiterEnvironment });
    expect(consumeRateLimit(request(), "courtroom", { now: 1_100, store, environment: limiterEnvironment }).allowed).toBe(false);
    expect(consumeRateLimit(request(), "simulation", { now: 1_100, store, environment: limiterEnvironment }).allowed).toBe(true);
    expect(consumeRateLimit(request("198.51.100.20"), "courtroom", { now: 1_100, store, environment: limiterEnvironment }).allowed).toBe(true);
  });

  it("resets an expired fixed window", () => {
    const store = createRateLimitStore();
    consumeRateLimit(request(), "courtroom", { now: 1_000, store, environment: limiterEnvironment });
    expect(consumeRateLimit(request(), "courtroom", { now: 11_001, store, environment: limiterEnvironment })).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("does not invoke an expensive operation after the limit is reached", async () => {
    const store = createRateLimitStore();
    const provider = vi.fn().mockResolvedValue("unused");
    await executeRateLimited(request(), "courtroom", provider, { now: 1_000, store, environment: limiterEnvironment });
    const limited = await executeRateLimited(request(), "courtroom", provider, { now: 1_100, store, environment: limiterEnvironment });
    expect(limited.allowed).toBe(false);
    expect(provider).toHaveBeenCalledOnce();
  });

  it("rejects overlapping same-instance provider work for one client and run", () => {
    const first = acquireProviderRequest(request(), "simulation", "run-concurrency-test", limiterEnvironment);
    expect(first).toBeTypeOf("function");
    expect(acquireProviderRequest(request(), "simulation", "run-concurrency-test", limiterEnvironment)).toBeNull();
    first?.();
    const afterRelease = acquireProviderRequest(request(), "simulation", "run-concurrency-test", limiterEnvironment);
    expect(afterRelease).toBeTypeOf("function");
    afterRelease?.();
  });

  it("hashes a coarsened trusted Vercel address and never returns the raw address", () => {
    const first = getPrivacySafeClientKey(request("203.0.113.41"), { VERCEL: "1" });
    const sameNetwork = getPrivacySafeClientKey(request("203.0.113.99"), { VERCEL: "1" });
    expect(first).toBe(sameNetwork);
    expect(first).not.toContain("203.0.113");
  });
});

describe("public request and response safeguards", () => {
  it("requires same-origin JSON and rejects oversized bodies before parsing", async () => {
    expect(() => assertSameOrigin(new Request("https://demo.example/api", { headers: { origin: "https://evil.example" } }))).toThrow(RequestBoundaryError);
    await expect(readBoundedJson(new Request("https://demo.example/api", { method: "POST", body: "{}" }), 100)).rejects.toMatchObject({ code: "INVALID_CONTENT_TYPE" });
    await expect(readBoundedJson(request(), 1)).rejects.toMatchObject({ code: "REQUEST_TOO_LARGE" });
  });

  it("configures the expected application security headers", async () => {
    const expected = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      "X-Frame-Options": "DENY",
    };
    expect(Object.fromEntries(SECURITY_HEADERS.map((header) => [header.key, header.value]))).toEqual(expected);
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = await nextConfig.headers?.();
    expect(rules?.[0]).toMatchObject({ source: "/:path*", headers: [...SECURITY_HEADERS] });
  });

  it("turns technical provider failures into human-readable primary messages", () => {
    const rateLimit = toDisplayError({ code: "GROQ_RATE_LIMITED", message: "raw", retryAfterSeconds: 8 });
    expect(rateLimit.message).toContain("No customer action was consumed");
    expect(rateLimit.retryAfterSeconds).toBe(8);
    expect(toDisplayError({ code: "OPENAI_API_KEY_MISSING", message: "raw" }).message).toContain("not configured");
    expect(toDisplayError({ code: "PROVIDER_TIMEOUT", message: "raw" }).message).toContain("did not respond in time");
  });
});
