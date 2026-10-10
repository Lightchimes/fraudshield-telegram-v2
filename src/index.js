export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Telegram webhook will POST here
    if (request.method === "POST") {
      try {
        const update = await request.json();
        const message = update.message || update.edited_message;
        if (!message ||!message.text) return new Response("ok");

        const chatId = message.chat.id;
        const text = message.text.trim();
        const token = env.BOT_TOKEN;

        // /start command
        if (text.startsWith("/start")) {
          await sendMessage(token, chatId, "🛡️ *FraudShield Bot is Live!*\n\nSend me any link and I will check if it's a scam.\n\nExample: `https://example.com`", "Markdown");
          return new Response("ok");
        }

        // Extract URL from text
        const urlMatch = text.match(/https?:\/\/[^\s]+/i);
        if (!urlMatch) {
          await sendMessage(token, chatId, "Please send a valid link starting with http:// or https://");
          return new Response("ok");
        }

        const checkUrl = urlMatch[0];
        await sendMessage(token, chatId, `🔍 Checking:\n${checkUrl}\nPlease wait...`);

        // Call your FraudShield API via service binding
        let result;
        try {
          // Try service binding first
          const apiReq = new Request(`https://api.fraudshield/check?url=${encodeURIComponent(checkUrl)}`);
          const apiRes = await env.FRAUDSHIELD_API.fetch(apiReq);
          result = await apiRes.json();
        } catch (e) {
          // Fallback to direct fetch if binding fails
          const apiRes = await fetch(`https://fraudshield-api.lightchimes.workers.dev/check?url=${encodeURIComponent(checkUrl)}`, {
            headers: { "x-api-key": env.API_KEY || "" }
          });
          result = await apiRes.json();
        }

        const isScam = result.isScam || result.risk === "high" || result.score > 70;
        const score = result.score || result.riskScore || "N/A";

        let reply = "";
        if (isScam) {
          reply = `🚨 *SCAM DETECTED!*\n\n🔗 ${checkUrl}\n⚠️ Risk: HIGH\n📊 Score: ${score}\n\n❌ Do NOT visit this link!\nReason: ${result.reason || result.message || "Flagged by FraudShield"}`;
        } else {
          reply = `✅ *Seems Safe*\n\n🔗 ${checkUrl}\n📊 Score: ${score}\n\nThis link looks clean, but always be careful.`;
        }

        await sendMessage(token, chatId, reply, "Markdown");

      } catch (err) {
        console.error(err);
      }
      return new Response("ok");
    }

    // GET - for setting webhook
    if (url.pathname === "/setwebhook") {
      const webhookUrl = `${url.origin}`;
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
      const data = await res.json();
      return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("FraudShield Telegram Bot is running. Use /setwebhook to set webhook.");
  }
}

async function sendMessage(token, chatId, text, parse_mode) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode })
  });
}
