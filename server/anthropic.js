// Lógica compartida del proxy de IA. Framework-agnóstica: la usan tanto la
// función serverless (api/extract.js) como el middleware del dev server de Vite.
// La API key vive SOLO aquí (servidor), nunca llega al cliente.

const SYSTEM_PROMPT =
  "Extraes ingresos y gastos FIJOS (recurrentes mensuales) de una descripción en español. " +
  "Responde SOLO con un arreglo JSON, sin texto adicional, sin markdown, sin backticks. " +
  'Cada elemento: {"type":"income"|"expense","category":string,"amount":number,"note":string}. ' +
  "Usa montos mensuales (si dan algo semanal o quincenal, conviértelo a mensual, dividiendo o multiplicando segun corresponda). " +
  "Para 'category' usa una etiqueta corta y clara en español basada en lo que describe " +
  "(ej. 'Salario', 'Renta', 'Comida', 'Deuda', 'Servicios', 'Transporte'). " +
  "Si no hay info suficiente para un monto, no inventes esa entrada.";

export async function extractFixedItems(text, apiKey) {
  if (!apiKey) {
    throw new Error("Falta ANTHROPIC_API_KEY en el servidor");
  }
  if (!text || !String(text).trim()) {
    throw new Error("Texto vacío");
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: String(text) }],
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`Error de la API (${r.status}): ${detail.slice(0, 200)}`);
  }

  const data = await r.json();
  const out = (data.content || []).map((b) => b.text || "").join("\n");
  const clean = out.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    throw new Error("La IA no devolvió un JSON válido");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("La respuesta no es un arreglo");
  }

  // Normaliza y descarta entradas inválidas en el servidor.
  return parsed
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      type: p.type === "income" ? "income" : "expense",
      category: String(p.category || "Otro").slice(0, 40),
      amount: Number(p.amount) || 0,
      note: String(p.note || "").slice(0, 120),
    }))
    .filter((p) => p.amount > 0);
}
