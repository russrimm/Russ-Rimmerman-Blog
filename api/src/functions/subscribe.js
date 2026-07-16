const { app } = require("@azure/functions");

// Basic RFC-5322-ish email sanity check. The provider does the authoritative
// validation; this just avoids obviously bad input reaching the API.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Subscribe an email address to the configured newsletter provider.
 *
 * The provider API key is read from Azure app settings (environment variables)
 * so it is never exposed to the browser. Configure ONE provider:
 *
 *   Buttondown:
 *     NEWSLETTER_PROVIDER=buttondown
 *     BUTTONDOWN_API_KEY=<token>
 *
 *   Mailchimp:
 *     NEWSLETTER_PROVIDER=mailchimp
 *     MAILCHIMP_API_KEY=<key-with-dc-suffix, e.g. abc123-us21>
 *     MAILCHIMP_LIST_ID=<audience id>
 *
 * If no provider is configured the endpoint returns 501 and the form shows a
 * friendly "not available yet" message — it never silently discards a signup.
 */
async function subscribeButtondown(email) {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) {
    return { ok: false, status: 501, message: "Newsletter is not configured." };
  }

  const res = await fetch("https://api.buttondown.email/v1/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email_address: email }),
  });

  if (res.ok) {
    return { ok: true, status: 200, message: "You're subscribed. Thanks for joining!" };
  }

  let detail = "";
  try {
    detail = JSON.stringify(await res.json());
  } catch {
    detail = await res.text().catch(() => "");
  }

  // Buttondown returns 400 with a "already subscribed" style message.
  if (res.status === 400 && /already|exists|subscrib/i.test(detail)) {
    return { ok: true, status: 200, message: "You're already on the list." };
  }

  return { ok: false, status: 502, message: "Subscription failed. Please try again later.", detail };
}

async function subscribeMailchimp(email) {
  const key = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  if (!key || !listId) {
    return { ok: false, status: 501, message: "Newsletter is not configured." };
  }

  const dc = key.split("-")[1];
  if (!dc) {
    return { ok: false, status: 500, message: "Newsletter is misconfigured." };
  }

  const res = await fetch(
    `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${key}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: email, status: "subscribed" }),
    },
  );

  if (res.ok) {
    return { ok: true, status: 200, message: "You're subscribed. Thanks for joining!" };
  }

  let body = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }

  if (res.status === 400 && body.title === "Member Exists") {
    return { ok: true, status: 200, message: "You're already on the list." };
  }

  return {
    ok: false,
    status: 502,
    message: "Subscription failed. Please try again later.",
    detail: body.detail || "",
  };
}

app.http("subscribe", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "subscribe",
  handler: async (request, context) => {
    const json = (status, payload) => ({
      status,
      headers: { "Content-Type": "application/json" },
      jsonBody: payload,
    });

    let data;
    try {
      data = await request.json();
    } catch {
      return json(400, { ok: false, message: "Invalid request." });
    }

    // Honeypot: real users leave this empty. Bots fill it in.
    if (data && typeof data.website === "string" && data.website.trim() !== "") {
      // Pretend success so bots don't learn they were caught.
      return json(200, { ok: true, message: "You're subscribed. Thanks for joining!" });
    }

    const email = typeof data?.email === "string" ? data.email.trim() : "";
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return json(400, { ok: false, message: "Please enter a valid email address." });
    }

    const provider = (process.env.NEWSLETTER_PROVIDER || "").toLowerCase();

    let result;
    try {
      if (provider === "buttondown") {
        result = await subscribeButtondown(email);
      } else if (provider === "mailchimp") {
        result = await subscribeMailchimp(email);
      } else {
        result = {
          ok: false,
          status: 501,
          message: "Newsletter sign-up isn't available yet — check back soon.",
        };
      }
    } catch (err) {
      context.error("Newsletter subscription error", err);
      return json(502, {
        ok: false,
        message: "Subscription failed. Please try again later.",
      });
    }

    if (!result.ok && result.detail) {
      context.warn(`Newsletter provider rejected signup: ${result.detail}`);
    }

    return json(result.status, { ok: result.ok, message: result.message });
  },
});
