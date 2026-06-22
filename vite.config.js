import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Sirve POST /api/extract durante `npm run dev` reusando la MISMA lógica que
// la función serverless de producción (server/anthropic.js).
function devApiPlugin() {
  return {
    name: "dev-api-extract",
    configureServer(server) {
      server.middlewares.use("/api/extract", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Método no permitido");
          return;
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", async () => {
          res.setHeader("Content-Type", "application/json");
          try {
            const { text } = JSON.parse(body || "{}");
            const { extractFixedItems } = await import("./server/anthropic.js");
            const items = await extractFixedItems(text, process.env.ANTHROPIC_API_KEY);
            res.end(JSON.stringify({ items }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e?.message || "Error al procesar" }));
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carga .env (sin filtro de prefijo) y la expone al middleware del dev server.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  }

  return {
    plugins: [react(), devApiPlugin()],
    build: {
      target: "es2020",
      cssMinify: true,
      // recharts es grande por diseño pero se carga bajo demanda (lazy), no en el arranque.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Separa librerias pesadas en chunks propios para mejor cacheo y carga.
          manualChunks: {
            react: ["react", "react-dom"],
            charts: ["recharts"],
            vendor: ["papaparse", "lucide-react"],
          },
        },
      },
    },
  };
});
