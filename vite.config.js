import { defineConfig } from "vite";

export default defineConfig({
  root: "client/demos/react-tic-tac-toe",
  publicDir: "assets",
  server: {
    open: true,
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
    emptyOutDir: true,
  },
});
