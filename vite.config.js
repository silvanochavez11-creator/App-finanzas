import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
});
