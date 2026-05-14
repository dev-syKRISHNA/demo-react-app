import { createRoot } from "react-dom/client";
import { init } from "@cognior/iap-sdk";
import App from "./App.tsx";
import "./index.css";

// Dynamically load the unbroken UMD bundle to bypass webpack/obfuscator issues
const script = document.createElement('script');
script.src = "https://iapsdk.cognior.com/v0.2.26/index.umd.js";
script.onload = () => {
  if ((window as any).DAP && (window as any).DAP.init) {
    (window as any).DAP.init({
      configUrl: "/iap-config.json",
      debug: true
    }).catch((err: any) => console.error("SDK initialization failed:", err));
  }
};
document.head.appendChild(script);

// // Initialize SDK
// init({
//   configUrl: "/iap-config.json",
//   debug: true
// }).catch(err => {
//   console.error("SDK initialization failed:", err);
// });


createRoot(document.getElementById("root")!).render(<App />);
