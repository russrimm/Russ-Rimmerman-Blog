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
  // Static Web Apps proxies /api to a managed Functions host, so the handler
  // sees an internal URL rather than the public one the browser requested.
  url = "http://127.0.0.1:7071/api/subscribe",
} = {}) {
  const encodedBody = new TextEncoder().encode(body);
  const merged = new Headers({
    origin: "https://www.russrimmerman.com",
    "x-forwarded-host": "www.russrimmerman.com",
  });
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) merged.delete(key);
    else merged.set(key, value);
  }
  return {
    method,
    url,
    headers: merged,
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
  delete process.env.ALLOWED_ORIGINS;
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test("rejects subscription requests with no Origin", async () => {
  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: {
        "content-type": "application/json",
        origin: null,
      },
    }),
    context
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
});

test("rejects cross-origin subscription requests", async () => {
  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
        "x-forwarded-host": "www.russrimmerman.com",
      },
    }),
    context
  );

  assert.equal(response.status, 403);
});

test("accepts same-origin requests proxied through Static Web Apps", async () => {
  process.env.NEWSLETTER_PROVIDER = "buttondown";
  process.env.BUTTONDOWN_API_KEY = "test-key";
  global.fetch = async () => new Response(null, { status: 201 });

  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: {
        "content-type": "application/json",
        // A browser always sends Origin on POST, even same-origin.
        origin: "https://www.russrimmerman.com",
        "x-forwarded-host": "www.russrimmerman.com",
        host: "russrimmerman-blog.azurewebsites.net",
      },
    }),
    context
  );

  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.ok, true);
});

test("honors an explicit ALLOWED_ORIGINS allowlist", async () => {
  process.env.NEWSLETTER_PROVIDER = "buttondown";
  process.env.BUTTONDOWN_API_KEY = "test-key";
  process.env.ALLOWED_ORIGINS =
    "https://www.russrimmerman.com, russrimmerman.com";
  global.fetch = async () => new Response(null, { status: 201 });

  const allowed = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: {
        "content-type": "application/json",
        origin: "https://russrimmerman.com",
        host: "russrimmerman-blog.azurewebsites.net",
      },
    }),
    context
  );
  assert.equal(allowed.status, 200);

  const blocked = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: {
        "content-type": "application/json",
        origin: "https://not-my-site.example",
        host: "russrimmerman-blog.azurewebsites.net",
      },
    }),
    context
  );
  assert.equal(blocked.status, 403);
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

test("rate limits malformed JSON before parsing it", async () => {
  const makeAttempt = () =>
    handler(
      request({
        body: "{",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.11",
        },
      }),
      context
    );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await makeAttempt()).status, 400);
  }
  assert.equal((await makeAttempt()).status, 429);
});

test("keys the rate limit on the platform client IP, not a spoofed forwarded hop", async () => {
  const makeAttempt = forwardedFor =>
    handler(
      request({
        body: JSON.stringify({ email: "invalid" }),
        headers: {
          "content-type": "application/json",
          "x-azure-clientip": "198.51.100.20",
          "x-forwarded-for": forwardedFor,
        },
      }),
      context
    );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await makeAttempt("203.0.113.9")).status, 400);
  }
  assert.equal((await makeAttempt("198.51.100.99")).status, 429);

  const otherClient = await handler(
    request({
      body: JSON.stringify({ email: "invalid" }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.50, 10.0.0.4",
      },
    }),
    context
  );
  assert.equal(otherClient.status, 400);
});

test("asks the reader to confirm an unactivated Buttondown signup", async () => {
  process.env.NEWSLETTER_PROVIDER = "buttondown";
  process.env.BUTTONDOWN_API_KEY = "test-key";
  global.fetch = async () =>
    new Response(JSON.stringify({ type: "unactivated" }), { status: 201 });

  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: { "content-type": "application/json" },
    }),
    context
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.jsonBody.message,
    "Check your inbox to confirm your subscription."
  );
});

test("asks Mailchimp subscribers to confirm before they are on the list", async () => {
  process.env.NEWSLETTER_PROVIDER = "mailchimp";
  process.env.MAILCHIMP_API_KEY = "abc123-us21";
  process.env.MAILCHIMP_LIST_ID = "list 1";
  let calledUrl = "";
  global.fetch = async url => {
    calledUrl = url;
    return new Response(JSON.stringify({ status: "pending" }), { status: 200 });
  };

  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: { "content-type": "application/json" },
    }),
    context
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.jsonBody.message,
    "Check your inbox to confirm your subscription."
  );
  assert.equal(
    calledUrl,
    "https://us21.api.mailchimp.com/3.0/lists/list%201/members"
  );
});

test("treats a Buttondown duplicate as success", async () => {
  process.env.NEWSLETTER_PROVIDER = "buttondown";
  process.env.BUTTONDOWN_API_KEY = "test-key";
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "email_already_exists",
        detail:
          "That email address (reader@example.com) is already subscribed (id=abc).",
      }),
      { status: 400 }
    );

  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: { "content-type": "application/json" },
    }),
    context
  );

  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.ok, true);
});

test("does not report a blocked Buttondown signup as success", async () => {
  process.env.NEWSLETTER_PROVIDER = "buttondown";
  process.env.BUTTONDOWN_API_KEY = "test-key";
  // The literal body Buttondown returns for a firewall block. The word
  // "subscriber_blocked" contains "subscrib", which a loose text match would
  // wrongly read as "already subscribed".
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "subscriber_blocked",
        detail: "This subscriber was blocked by your firewall.",
        metadata: {},
      }),
      { status: 400 }
    );

  const response = await handler(
    request({
      body: JSON.stringify({ email: "reader@example.com" }),
      headers: { "content-type": "application/json" },
    }),
    context
  );

  assert.equal(response.status, 502);
  assert.equal(response.jsonBody.ok, false);
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
