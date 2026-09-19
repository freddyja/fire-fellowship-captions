import { startApp } from "./app";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app");
startApp(root);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional */
    });
  });
}
