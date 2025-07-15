import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "client/demos/react-tic-tac-toe",
  server: {
    port: 3001,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "../../../dist/react-tic-tac-toe",
  },
});
