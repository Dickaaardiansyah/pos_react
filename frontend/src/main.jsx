// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Setiap file CSS punya tanggung jawab semantik tersendiri (lihat src/styles/).
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/cashier.css";
import "./styles/labarugi.css";
import "./styles/login.css";
import "./styles/pages.css";
import "./styles/stock-ops.css";
import "./styles/purchase.css";
import "./styles/shift.css";
import "./styles/product-form.css";
import "./styles/dashboard.css";
import "./styles/product-options.css";
import "./styles/reports.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);