import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "../app/dashboard";
import data from "./dashboard.json";
import "../app/globals.css";
import type { DashboardData } from "../lib/dashboard-data";

if (location.hash === "#personal") location.replace(new URL("./personal.html", location.href).href);
else createRoot(document.getElementById("root")!).render(<Dashboard data={data as DashboardData} />);
