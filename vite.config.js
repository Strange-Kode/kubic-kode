import { defineConfig } from "vite";

export default defineConfig({
  root: "client/demos/tic-tac-toe",
  publicDir: "assets",
  server: {
    open: true,
  },
  build: {
    outDir: "../../../dist-frontend/tic-tac-toe",
    emptyOutDir: true,
  },
});
