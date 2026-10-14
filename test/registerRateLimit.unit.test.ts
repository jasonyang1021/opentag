// Unit tests for the registration rate limit.
// Contract: POST /api/auth/register is capped at REGISTER_RATE_LIMIT requests per
// REGISTER_RATE_WINDOW_MS per IP, allowing colleagues behind a shared NAT to register.
//
// Run: npx tsx --test --test-force-exit test/registerRateLimit.unit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { rateLimit, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS } from "../src/server/ratelimit.ts";

test("login remains capped at ten attempts per minute, separately from registration", () => {
  const now = 5_000_000;
  for (let i = 0; i < 10; i++) assert.equal(rateLimit("login-regression", "192.0.2.50", undefined, undefined, now).ok, true);
  assert.deepEqual(rateLimit("login-regression", "192.0.2.50", undefined, undefined, now + 1000), { ok: false, retryAfter: 59 });
  assert.equal(rateLimit("registration-regression", "192.0.2.50", REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, now).ok, true);
  assert.equal(rateLimit("login-regression", "192.0.2.50", undefined, undefined, now + 60_000).ok, true);
});

test("blocked retries do not extend the registration window", () => {
  const now = 6_000_000;
  for (let i = 0; i < REGISTER_RATE_LIMIT; i++) rateLimit("retry-window", "192.0.2.51", REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, now);
  assert.deepEqual(rateLimit("retry-window", "192.0.2.51", REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, now + 60_000), { ok: false, retryAfter: 3540 });
  assert.equal(rateLimit("retry-window", "192.0.2.51", REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, now + REGISTER_RATE_WINDOW_MS).ok, true);
});

test("REGISTER_RATE_LIMIT is 50 for shared-IP invitation onboarding", () => {
  assert.equal(REGISTER_RATE_LIMIT, 50);
});

test("REGISTER_RATE_WINDOW_MS is 1 hour (3 600 000 ms)", () => {
  assert.equal(REGISTER_RATE_WINDOW_MS, 60 * 60 * 1000);
});

test("rateLimit allows up to REGISTER_RATE_LIMIT requests per IP within the window", () => {
  // Use a unique bucket suffix to avoid cross-test pollution from the shared in-memory store.
  const bucket = "auth:register:test-allow";
  const ip = "192.0.2.1";
  const t = 1_000_000; // arbitrary fixed timestamp
  for (let i = 0; i < REGISTER_RATE_LIMIT; i++) {
    const r = rateLimit(bucket, ip, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, t + i);
    assert.ok(r.ok, `request ${i + 1} of ${REGISTER_RATE_LIMIT} should be allowed`);
    assert.equal(r.retryAfter, 0);
  }
});

test("rateLimit blocks the (REGISTER_RATE_LIMIT + 1)th request from the same IP", () => {
  const bucket = "auth:register:test-block";
  const ip = "192.0.2.2";
  const t = 2_000_000;
  // Exhaust the limit
  for (let i = 0; i < REGISTER_RATE_LIMIT; i++) {
    rateLimit(bucket, ip, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, t + i);
  }
  // Next request must be blocked
  const blocked = rateLimit(bucket, ip, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, t + REGISTER_RATE_LIMIT);
  assert.ok(!blocked.ok, "request beyond the limit should be blocked");
  assert.ok(blocked.retryAfter > 0, "Retry-After must be positive when blocked");
});

test("rateLimit resets after the window expires", () => {
  const bucket = "auth:register:test-reset";
  const ip = "192.0.2.3";
  const t = 3_000_000;
  // Exhaust the limit within the window
  for (let i = 0; i < REGISTER_RATE_LIMIT; i++) {
    rateLimit(bucket, ip, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, t + i);
  }
  // Advance time past the window — a new window should open
  const afterReset = rateLimit(bucket, ip, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, t + REGISTER_RATE_WINDOW_MS + 1);
  assert.ok(afterReset.ok, "first request in a new window should be allowed");
});

test("rateLimit gives independent buckets to different IPs", () => {
  const bucket = "auth:register:test-independent";
  const t = 4_000_000;
  const ipA = "10.0.0.1";
  const ipB = "10.0.0.2";
  // Exhaust limit for ipA
  for (let i = 0; i < REGISTER_RATE_LIMIT; i++) {
    rateLimit(bucket, ipA, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, t + i);
  }
  // ipB should be unaffected
  const r = rateLimit(bucket, ipB, REGISTER_RATE_LIMIT, REGISTER_RATE_WINDOW_MS, t + REGISTER_RATE_LIMIT);
  assert.ok(r.ok, "a different IP should not share the same bucket");
});
