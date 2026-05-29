export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const CATS = ['Rental','Insurance','Energy','Supermarket','Eating outside','Hanging out','Transportation','Assinaturas','Furniture','Outros'];
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const { message } = req.body;
  const today = new Date();
  const monthName = MONTHS[today.getMonth()];
  const dateStr = today.toISOString().split('T')[0];

  const systemPrompt = `You are an expense parsing assistant for Amanda's personal finance tracker. Today is ${dateStr}, month: ${monthName}.

Available categories: ${CATS.join(', ')}.

Category rules:
- Supermarket: grocery stores (Harris Teeter, Walmart, Whole Foods, Food Lion, Trader Joe's, etc.)
- Eating outside: restaurants, cafes, coffee, bars, food delivery, fast food, Shake Shack, Starbucks
- Hanging out: travel, trips, events, entertainment, shows, parties
- Transportation: Uber, Lyft, gas, parking, flights (unless part of a trip)
- Assinaturas: subscriptions (Netflix, Spotify, etc.)
- Rental: rent
- Insurance: insurance payments
- Energy: electricity, utilities, internet
- Furniture: home goods, furniture, decor
- Outros: everything else that doesn't fit

If the user is logging an expense, respond ONLY with valid JSON:
{"type":"expense","amount":NUMBER,"merchant":"NAME","category":"CATEGORY","notes":"","date":"${dateStr}","month":"${monthName}"}

If the user is asking for a summary/report (e.g. "how much this month", "show summary", "what did I spend"), respond with:
{"type":"summary"}

If unclear or a greeting, respond with:
{"type":"other","reply":"YOUR SHORT FRIENDLY REPLY IN ENGLISH"}

Never add markdown, explanation, or any text outside the JSON.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({ error: data.error?.message || 'API error' });
  }

  const raw = data.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : { type: 'other', reply: raw };
  }

  return res.status(200).json(parsed);
}
