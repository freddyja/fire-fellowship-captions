import { startApp } from "./app";
import { initInstallCapture } from "./install";
import "./styles.css";

initInstallCapture();

// Pre-meeting wake: the free Render host sleeps when idle. Opening the app
// starts it waking now, so the first caption is not the one that waits.
if (import.meta.env.PROD) {
  void fetch("/health", { cache: "no-store" }).catch((err) => console.warn("[wake] /health", err));
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app");
startApp(root);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      /* optional */
    });
  });
}
