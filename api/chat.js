export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const DEFAULT_CATS = ['Rent','Parking','Utilities','Electricity','Internet','Loan','Groceries','Lunch','Eating outside','Savings','Other'];
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const { message, cats } = req.body;
  // Use the user's real categories (including custom ones) when the client sends them.
  let CATS = Array.isArray(cats) && cats.length ? cats.map(c => String(c).trim()).filter(Boolean) : DEFAULT_CATS;
  if (!CATS.some(c => c.toLowerCase() === 'other')) CATS = [...CATS, 'Other'];
  const today = new Date();
  const monthName = MONTHS[today.getMonth()];
  const dateStr = today.toISOString().split('T')[0];

  const systemPrompt = `You are an expense parsing assistant for Amanda's personal finance tracker. Today is ${dateStr}, month: ${monthName}.

Available categories (you MUST pick EXACTLY one, spelled exactly as shown): ${CATS.join(', ')}.

How to choose the category — be smart, use your real-world knowledge of brands and merchants:
- The user usually types just a merchant name, a brand, or a short abbreviation (e.g. "spotify", "pharma", "uber", "amzn"). Figure out what the merchant actually is, then map it to the BEST-FITTING category from the list above by its meaning. Never require the user to type the full category name.
- Match by meaning, in this order of preference, and only fall back to "Other" when truly nothing fits:
  - Streaming / subscriptions (Spotify, Netflix, Disney+, HBO Max, YouTube Premium, Apple Music/TV, Prime Video, Max, Paramount+, Hulu) → a streaming/subscription category if one exists.
  - Pharmacy / drugstore / meds / health (CVS, Walgreens, Rite Aid, "pharma", "farmácia", "remédio", "drogaria") → a pharmacy/health category if one exists.
  - Grocery stores (Harris Teeter, Whole Foods, Trader Joe's, Aldi, Walmart, Costco, Food Lion, "supermercado", "mercado") → Groceries.
  - Quick/casual daytime meals, counter service, fast food (McDonald's, Chick-fil-A, Chipotle, Subway) → Lunch.
  - Sit-down restaurants, bars, coffee shops (Starbucks), date nights, delivery apps (DoorDash, Uber Eats, iFood) → Eating outside.
  - Electric bill / "luz" / "energia elétrica" → Electricity. Water / trash / HOA / general utilities → Utilities. Internet provider / cable / wifi plan → Internet.
  - Rent / "aluguel" → Rent. Parking / garage → Parking. Loan installment / financing / credit card payment → Loan. Savings transfer / investment / 401k → Savings.
- CRITICAL: only output a category that appears in the Available categories list. If the ideal category (e.g. "Streaming") is NOT in the list, pick the closest one that IS, otherwise "Other". Do not invent categories.
- If the user explicitly names a category (even partially or misspelled), match it to the closest one in the list.

If the user is logging an expense, respond ONLY with valid JSON (no markdown, no explanation):
{"type":"expense","amount":NUMBER,"merchant":"NAME","category":"CATEGORY","notes":"","date":"${dateStr}","month":"${monthName}"}

If the user is asking for a summary or report ("how much", "resumo", "gastei", "this month"), respond with:
{"type":"summary"}

If unclear or a greeting, respond with:
{"type":"other","reply":"YOUR SHORT FRIENDLY REPLY IN ENGLISH OR PORTUGUESE"}

Never add text outside the JSON.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: systemPrompt, messages: [{ role: 'user', content: message }] })
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });

  const raw = data.content[0].text.trim();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { type: 'other', reply: raw }; }

  return res.status(200).json(parsed);
}
