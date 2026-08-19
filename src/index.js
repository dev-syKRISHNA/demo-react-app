import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';



// --- APPROACH 2 (CDN Dynamic Loading) ---
// To use the CDN instead of the local index.umd.js, uncomment this block
// and remove the <script> tags from public/index.html

const SDK_URL = "https://iapsdk.cognior.com/v0.2.33/index.umd.js";

if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
  const script = document.createElement("script");
  script.src = SDK_URL;
  script.onload = () => {
    const DAP = window.DAP;
    if (DAP && DAP.init) {
      DAP.init({
        configUrl: "/iap-config.json",
        debug: true,
      }).catch((err) => console.error("SDK initialization failed:", err));
    } else {
      console.error("DAP global not found after script load");
    }
  };
  script.onerror = () => console.error("Failed to load DAP SDK script");
  document.head.appendChild(script);
}


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
