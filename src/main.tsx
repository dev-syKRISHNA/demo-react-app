import { createRoot } from "react-dom/client";
import { init } from "@cognior/iap-sdk";
import App from "./App.tsx";
import "./index.css";

// Initialize SDK
init({
  configUrl: "/iap-config.json",
  debug: true
}).catch(err => {
  console.error("SDK initialization failed:", err);
});


createRoot(document.getElementById("root")!).render(<App />);
