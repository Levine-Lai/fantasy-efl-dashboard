import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "../app/dashboard";
import data from "./dashboard.json";
import "../app/globals.css";
import type { DashboardData } from "../lib/dashboard-data";

createRoot(document.getElementById("root")!).render(<Dashboard data={data as DashboardData} />);
