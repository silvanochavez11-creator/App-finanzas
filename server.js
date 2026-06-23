// Servidor de producción para Hostinger (plan Business, apps Node.js).
// Sirve el frontend ya compilado (dist/) y expone el proxy del Asistente IA.
// La API key se toma de la variable de entorno ANTHROPIC_API_KEY (panel de Hostinger).
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFixedItems } from "./server/anthropic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "1mb" }));

// Proxy del Asistente IA: la key nunca llega al navegador.
app.post("/api/extract", async (req, res) => {
  try {
    const items = await extractFixedItems(req.body?.text, process.env.ANTHROPIC_API_KEY);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Error al procesar" });
  }
});

// Frontend estático (resultado de `npm run build`).
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));

// Fallback SPA: cualquier otra ruta devuelve el index.
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Tu Ruta Financiera corriendo en el puerto ${port}`);
});
