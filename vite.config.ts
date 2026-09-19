import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";
import { attachCaptionRelay } from "./server/relay";

function captionRelay(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    attachCaptionRelay(server.httpServer);
  };

  return {
    name: "fire-fellowship-caption-relay",
    configureServer(server) {
      attach(server);
      return () => attach(server);
    },
    configurePreviewServer(server) {
      attach(server);
      return () => attach(server);
    },
  };
}

const useHttps = process.env.FF_HTTPS !== "0";

export default defineConfig({
  plugins: [...(useHttps ? [basicSsl()] : []), captionRelay()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
