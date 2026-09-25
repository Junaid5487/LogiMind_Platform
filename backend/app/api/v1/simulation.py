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

@router.post("/simulate", response_model=Dict[str, Any])
def run_digital_twin_simulation(req: SimulationParamsRequest):
    simulator = DigitalTwinSimulator()
    return simulator.run_simulation(req.model_dump())
