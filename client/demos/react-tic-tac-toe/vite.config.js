import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "client/demos/react-tic-tac-toe",
  server: {
    port: 3001,
    host: true,
  },
  build: {
    outDir: "../../../dist/react-tic-tac-toe",
  },
});
