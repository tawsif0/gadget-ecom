import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import compression from "vite-plugin-compression";

export default defineConfig({
  plugins: [react(), tailwindcss(), compression()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          animation: ["framer-motion"],
          charts: ["recharts", "apexcharts", "react-apexcharts"],
          pdf: ["jspdf", "jspdf-autotable", "html2canvas"],
          three: ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
  },
});
