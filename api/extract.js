// Función serverless (Vercel / similar). El cliente llama a POST /api/extract
// con { text } y recibe { items }. La API key se lee de la variable de entorno
// ANTHROPIC_API_KEY del servidor.
import { extractFixedItems } from "../server/anthropic.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const items = await extractFixedItems(body.text, process.env.ANTHROPIC_API_KEY);
    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Error al procesar" });
  }
}
