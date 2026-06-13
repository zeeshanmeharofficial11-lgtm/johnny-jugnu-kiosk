import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Kitchen from "./Kitchen.jsx";
import Manager from "./Manager.jsx";
import "./input.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/manager" element={<Manager />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
