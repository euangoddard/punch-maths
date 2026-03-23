import { hydrate, render } from "preact";
import App from "./App";
import "./styles/index.css";

if (typeof window !== "undefined") {
  const appEl = document.getElementById("app");
  if (appEl) {
    // Hydrate if SSR content exists, otherwise do a full client render
    if (appEl.firstChild) {
      hydrate(<App />, appEl);
    } else {
      render(<App />, appEl);
    }
  }
}

export async function prerender() {
  const { renderToString } = await import("preact-render-to-string");
  const html = renderToString(<App />);
  return { html };
}
