from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.services.simulation.digital_twin import DigitalTwinSimulator

router = APIRouter(prefix="", tags=["Digital Twin Simulation"])

class SimulationParamsRequest(BaseModel):
    scenario_name: str
    disabled_warehouse_id: Optional[str] = None
    disabled_vehicle_id: Optional[str] = None
    demand_multiplier: Optional[float] = 1.0
    fuel_price_usd: Optional[float] = 4.20
    # What-if: open a new satellite hub (name shown in the summary narrative).
    new_hub_name: Optional[str] = None
    # Carbon price used for the cost/carbon ledger line (USD per metric ton).
    carbon_price_usd_per_ton: Optional[float] = 0.0

@router.post("/simulate", response_model=Dict[str, Any])
def run_digital_twin_simulation(req: SimulationParamsRequest):
    simulator = DigitalTwinSimulator()
    return simulator.run_simulation(req.model_dump())
