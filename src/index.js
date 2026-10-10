export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("FraudShield Telegram V2 Live - Go to /setup?secret=YOUR_SECRET");

    if (url.pathname === "/setup") {
      if (url.searchParams.get("secret")!== env.BOT_SECRET) return new Response("Unauthorized", {status: 401});
      const webhookUrl = `https://${url.host}/webhook`;
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/setWebhook`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({ url: webhookUrl, secret_token: env.BOT_SECRET })
      });
      return new Response(await res.text(), {headers: {"content-type": "application/json"}});
    }

    if (url.pathname === "/webhook") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token")!== env.BOT_SECRET) return new Response("Bad secret", {status: 403});
      const update = await request.json();
      if (update.message?.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        let reply = "🛡️ FraudShield V2\nSend me a link to check.\nTry: /start";

        if (text.startsWith("/start")) {
          reply = "🛡️ FraudShield V2 is LIVE\n\nSend any website link and I will check it.\nExample: https://google.com";
        } else {
          const m = text.match(/(https?:\/\/[^\s]+|[a-z0-9.-]+\.[a-z]{2,}[^\s]*)/i);
          if (m) {
            try {
              const apiReq = new Request("https://internal/api/check/website", {
                method: "POST",
                headers: {"content-type": "application/json"},
                body: JSON.stringify({ url: m[0] })
              });
              const apiRes = await env.FRAUDSHIELD_API.fetch(apiReq);
              const data = await apiRes.json();
              reply = `🔍 Checked: ${m[0]}\n\nScore: ${data.score?? data.risk_score?? 'N/A'}\nResult: ${data.status || JSON.stringify(data).slice(0,200)}`;
            } catch (e) {
              reply = `⚠️ API Error: ${e.message}\n\nTell me your API worker name so I can fix the binding.`;
            }
          }
        }
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({ chat_id: chatId, text: reply })
        });
      }
      return new Response("OK");
    }
    return new Response("Not found", {status: 404});
  }
}
