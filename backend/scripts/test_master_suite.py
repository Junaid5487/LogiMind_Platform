import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import engine, Base, SessionLocal
from app.db.models import User, Vehicle, Warehouse
from app.services.optimization.vrp_solver import VRPOptimizer
from app.services.optimization.inventory_lp import InventoryLPOptimizer
from app.services.ml.risk_analyzer import RiskAnalyzer
from app.services.simulation.digital_twin import DigitalTwinSimulator
from app.services.genai.copilot import LogisticsCopilotAgent

class TestLogiMindMasterSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def test_stage_1_db_liveness(self):
        db = SessionLocal()
        try:
            val = db.execute(Base.metadata.tables['roles'].select()).fetchall()
            self.assertIsNotNone(val)
        finally:
            db.close()

    def test_stage_2_vrp_solver(self):
        whs = [{"id": "w1", "lat": 40.7128, "lng": -74.0060}]
        orders = [{"id": "o1", "dest_lat": 40.7357, "dest_lng": -74.1724, "weight_kg": 50.0}]
        vehs = [{"id": "v1", "capacity_kg": 1500.0}]
        solver = VRPOptimizer(whs, orders, vehs)
        res = solver.solve_vrp()
        self.assertIn("routes", res)
        self.assertEqual(res["status"], "SUCCESS")

    def test_stage_3_inventory_lp(self):
        whs = [{"id": "w1", "location_lat": 40.71, "location_lng": -74.00}, {"id": "w2", "location_lat": 40.73, "location_lng": -74.17}]
        inv = [{"sku": "SKU-101", "warehouse_id": "w1", "quantity": 140, "reorder_threshold": 30}, {"sku": "SKU-101", "warehouse_id": "w2", "quantity": 12, "reorder_threshold": 30}]
        lp = InventoryLPOptimizer(whs, inv)
        res = lp.optimize_rebalance()
        self.assertIn("recommendations", res)

    def test_stage_4_risk_analyzer(self):
        veh = {"id": "V-104", "engine_temp_c": 98.5, "mileage_km": 60000.0}
        analyzer = RiskAnalyzer()
        res = analyzer.analyze_vehicle_health(veh, [])
        self.assertEqual(res["status"], "CRITICAL")

    def test_stage_5_digital_twin(self):
        sim = DigitalTwinSimulator()
        res = sim.run_simulation({"scenario_name": "Test Sim", "disabled_warehouse_id": "w2"})
        self.assertIn("deltas", res)

    def test_stage_6_copilot(self):
        db = SessionLocal()
        try:
            copilot = LogisticsCopilotAgent(db=db)
            res = copilot.process_query("Why is V-104 flagged for maintenance?")
            self.assertIn("citations", res)
        finally:
            db.close()

if __name__ == "__main__":
    unittest.main()
