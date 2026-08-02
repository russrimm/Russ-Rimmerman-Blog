const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const {
  handler,
  resetRateLimitsForTests,
} = require("../src/functions/subscribe.js");

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function request({
  body = "",
  headers = {},
  method = "POST",
  url = "https://www.russrimmerman.com/api/subscribe",
} = {}) {
  const encodedBody = new TextEncoder().encode(body);
  return {
    method,
    url,
    headers: new Headers(headers),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encodedBody);
        controller.close();
      },
    }),
    text: async () => body,
  };
}

const context = {
  error() {},
  warn() {},
};

beforeEach(() => {
  resetRateLimitsForTests();
  delete process.env.NEWSLETTER_PROVIDER;
  delete process.env.BUTTONDOWN_API_KEY;
  delete process.env.MAILCHIMP_API_KEY;
  delete process.env.MAILCHIMP_LIST_ID;
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test("rejects cross-origin subscription requests", async () => {
  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
      },
    }),
    context
  );

  assert.equal(response.status, 403);
});

test("requires JSON and bounds the request body", async () => {
  const wrongType = await handler(
    request({
      body: "email=reader@example.com",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }),
    context
  );
  assert.equal(wrongType.status, 415);

  const oversized = await handler(
    request({
      body: JSON.stringify({ email: `${"a".repeat(1_024)}@example.com` }),
      headers: { "content-type": "application/json" },
    }),
    context
  );
  assert.equal(oversized.status, 413);
});

test("rate limits repeated subscription attempts by forwarded client", async () => {
  const makeAttempt = () =>
    handler(
      request({
        body: JSON.stringify({ email: "invalid" }),
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.10",
        },
      }),
      context
    );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await makeAttempt()).status, 400);
  }
  const limited = await makeAttempt();
  assert.equal(limited.status, 429);
  assert.match(limited.headers["Retry-After"], /^\d+$/);
});

test("normalizes email before forwarding it to the provider", async () => {
  process.env.NEWSLETTER_PROVIDER = "buttondown";
  process.env.BUTTONDOWN_API_KEY = "test-key";
  global.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), {
      email_address: "reader@example.com",
    });
    return new Response(null, { status: 201 });
  };

  const response = await handler(
    request({
      body: JSON.stringify({ email: " Reader@Example.COM " }),
      headers: { "content-type": "application/json; charset=utf-8" },
    }),
    context
  );

  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.ok, true);
});
