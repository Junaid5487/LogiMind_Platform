# LogiMind Platform – README

## Overview
**LogiMind** is a logistics‑intelligence platform that combines:
- Digital‑twin Monte‑Carlo simulation for what‑if scenario analysis
- SHAP‑based Explainable AI (XAI) for IoT fleet‑health risk scoring
- Demand forecasting with Prophet + LightGBM
- Clarke‑Wright + 2‑opt vehicle‑route optimisation
- Interactive React dashboards (Leaflet, Recharts)

It helps operators reduce travel distance, lower fuel costs, improve SLAs and perform proactive maintenance.

## Architecture
```
Front‑end (React + Vite + Tailwind)  <-->  API (runSimulation, fetchVehicleHealth)  <-->  IoT data sources (telematics)
```
- **Key pages**: DigitalTwinConsole, FleetHealthPanel, ExecutiveDashboard.
- **Charts**: Recharts (demand, fleet distribution); Leaflet (live routes).
- **Monte‑Carlo**: 1 000 trials, parameters: demand_multiplier, fuel_price_usd, disabled warehouse/vehicle.
- **SHAP risk**: Random‑Forest model, top‑5 feature attributions per vehicle.
- **Demand forecast**: Prophet hourly seasonality + LightGBM meta‑learner, 7‑day horizon, ~94 % confidence.
- **Route optimisation**: Clarke‑Wright initial solution + 2‑opt local search; typical 10‑15 % distance reduction.

## Installation & Running
1. Clone / navigate to `C:\Users\Junaid\OneDrive\Desktop\LogiMind_Platform`.
2. Install front‑end dependencies:
   ```bash
   cd frontend
   npm install   # or yarn install
   ```
3. Start development server:
   ```bash
   npm run dev   # Vite, usually http://localhost:5173
   ```
4. (Optional) Add a lightweight Express back‑end to serve `runSimulation` and `fetchVehicleHealth`; the front‑end proxies to `http://localhost:8080`.
5. Build for production:
   ```bash
   cd frontend
   npm run build   # outputs static files under dist/
   ```

## Usage Scenarios
| Goal | UI |
|------|----|
| What‑if capacity planning (warehouse outage, fuel price spike) | **DigitalTwinConsole** – adjust sliders, run 1 000 Monte‑Carlo trials, view distance/fuel/SLA deltas |
| Fleet‑health monitoring & SHAP drivers | **FleetHealthPanel** – select a vehicle, see risk %, component risks, top SHAP features |
| Executive KPI snapshot, demand trend, fleet status | **ExecutiveDashboard** – top‑level KPIs, area‑chart demand forecast, bar‑chart fleet distribution, risk warnings |

## Project Structure (high‑level)
```
LogiMind_Platform/
├─ frontend/                   # React Vite app
│  ├─ src/
│  │   ├─ components/         # DigitalTwinConsole, FleetHealthPanel, ExecutiveDashboard, etc.
│  │   ├─ services/          # api.ts
│  │   ├─ types/            # TypeScript interfaces
│  │   └─ main.tsx
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ tailwind.config.js
├─ README.txt                 # this file
└─ (possible back‑end/docs)
```

## Future Work
1. Edge‑device Monte‑Carlo for real‑time what‑if analysis.
2. Dynamic re‑optimisation every few minutes as vehicle locations update.
3. Multi‑objective optimisation (distance, fuel, carbon).
4. Counterfactual XAI alongside SHAP.
5. Cloud IoT integration (Azure/AWS).

---
*Generated 2025‑08‑24 for the LogiMind Platform.*

## Features
- **Monte‑Carlo What‑If Simulation** – 1,000 random trials adjusting demand multiplier, fuel price, and disabled warehouses/vehicles; outputs deltas for total distance, fuel cost, and SLA impact.
- **SHAP‑Based Fleet Health Risk Scoring** – Random‑Forest model predicts overall failure risk per vehicle; top‑5 feature attributions (engine cooling, tires/suspension, battery health, etc.) displayed with SHAP values.
- **Prophet + LightGBM Demand Forecasting** – Prophet captures hourly/weekly seasonality; LightGBM meta‑learner refines residuals; 7‑day forecast with ~94 % confidence intervals.
- **Clarke‑Wright + 2‑Opt Route Optimisation** – Clarke‑Wright savings algorithm generates initial routes; 2‑opt local search improves total distance; typical 10‑15 % reduction vs. baseline.
- **Interactive Dashboards**
  - *Digital Twin Console*: scenario title, disabled node/vehicle selectors, sliders for demand/fuel price, live Monte‑Carlo results panel showing cost/SLA/distance deltas.
  - *Fleet Health Panel*: vehicle registry, overall failure risk percentage, component‑level risk gauges, SHAP feature attribution list.
  - *Executive Dashboard*: KPIs (total distance, fuel cost, on‑time SLA), demand‑trend area chart (Prophet + LightGBM), fleet distribution bar chart, real‑time risk warnings.
- **Live Route Visualisation** – Leaflet map displaying current vehicle routes, status icons, and clickable vehicle markers.
- **Scenario Planner** – UI to set a scenario title, select a disrupted warehouse or vehicle, and adjust what‑if parameters (demand multiplier, fuel price).
- **Warehouse & Fleet Hubs** – Detailed views of warehouse layout and full vehicle list with status badges.
- **Savings Banner** – Summarises cost savings achieved relative to the baseline after a simulation or optimisation run.
- **Navigation Bar & Auth Modal** – Global navigation links and a placeholder authentication modal.
- **Tech‑Stack Integration** – Built with React 18 + TypeScript, Vite build tool, TailwindCSS for styling, Leaflet for maps, Recharts for charts, and Lucide‑React for icons.

---
*Generated 2025‑08‑24 for the LogiMind Platform.*