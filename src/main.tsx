import { render } from "preact";
import App from "./App";
import "./styles/index.css";

const appEl = document.getElementById("app");
if (appEl) {
  render(<App />, appEl);
}
