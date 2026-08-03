export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const CATS = ['Rent','Parking','Utilities','Electricity','Internet','Loan','Groceries','Lunch','Eating outside','Savings','Other'];
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const { message } = req.body;
  const today = new Date();
  const monthName = MONTHS[today.getMonth()];
  const dateStr = today.toISOString().split('T')[0];

  const systemPrompt = `You are an expense parsing assistant for Amanda's personal finance tracker. Today is ${dateStr}, month: ${monthName}.

Available categories: ${CATS.join(', ')}.

Category rules:
- Rent: rent payment, "aluguel"
- Parking: parking fees, garage
- Utilities: water bill, trash, HOA, general utilities (NOT electricity or internet)
- Electricity: electric bill, "luz", "energia elétrica"
- Internet: internet provider, cable, wifi plan
- Loan: loan installments, credit card payment, financing
- Groceries: grocery stores — Harris Teeter, Whole Foods, Trader Joe's, Aldi, Walmart, Costco, Food Lion, supermarket
- Lunch: quick/casual daytime meals, counter service, fast food (McDonald's, Chick-fil-A, Chipotle, Subway, etc.)
- Eating outside: sit-down restaurants, bars, Starbucks and coffee shops, date nights, social dining, Shake Shack, delivery apps (DoorDash/Uber Eats/etc.)
- Savings: savings transfer, investment deposit, 401k
- Other: everything else (pharmacy, clothing, home goods, health, Amazon, gifts, etc.)

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
