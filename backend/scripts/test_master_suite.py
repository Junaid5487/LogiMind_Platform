import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import engine, Base, SessionLocal
from app.db.models import User, Vehicle, Warehouse
from app.services.optimization.vrp_solver import VRPOptimizer, obstacle_aware_leg
from app.services.optimization.inventory_lp import InventoryLPOptimizer
from app.services.optimization.obstacles import load_obstacles, resolve_obstacle
from app.services.ml.risk_analyzer import RiskAnalyzer
from app.services.simulation.digital_twin import DigitalTwinSimulator
from app.services.genai.copilot import LogisticsCopilotAgent


def _point_to_segment_km(plat, plng, alat, alng, blat, blng) -> float:
    """Shortest distance (km) from a point to the segment A→B.

    Local equirectangular frame — accurate at city scale, which is all the
    demo-coordinate assertion needs.
    """
    import math
    lat_ref = (plat + alat + blat) / 3.0
    cos_ref = math.cos(math.radians(lat_ref)) or 1e-9
    k = 111.32  # km per degree of latitude

    def to_xy(lat, lng):
        return ((lng - lat_ref) * k * cos_ref, (lat - lat_ref) * k)

    px, py = to_xy(plat, plng)
    ax, ay = to_xy(alat, alng)
    bx, by = to_xy(blat, blng)
    dx, dy = bx - ax, by - ay
    seg2 = dx * dx + dy * dy
    if seg2 == 0.0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


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

    # -- Driver-reported obstacle re-optimization --------------------------
    def test_stage_2a_obstacle_leg_detour(self):
        """A blocked leg must detour around the obstacle circle, symmetrically."""
        obstacles = [{"obstacle_id": "ob-leg", "obstacle_type": "ROAD_CLOSED",
                      "latitude": 19.288, "longitude": 72.8777, "radius_km": 10.0,
                      "status": "ACTIVE"}]
        straight = obstacle_aware_leg(19.0760, 72.8777, 19.5000, 72.8777, None)
        detoured = obstacle_aware_leg(19.0760, 72.8777, 19.5000, 72.8777, obstacles)
        # Clear leg → plain haversine, no vias.
        self.assertEqual(straight[1], [])
        self.assertEqual(straight[2], [])
        # Blocked leg → strictly longer path + detour via-point + avoided id.
        self.assertGreater(detoured[0], straight[0])
        self.assertEqual(len(detoured[1]), 1)
        self.assertEqual(detoured[2], ["ob-leg"])
        # The via must sit outside the obstacle clearance zone.
        via_lat, via_lng = detoured[1][0]
        from app.services.optimization.vrp_solver import haversine_distance_km
        self.assertGreater(
            haversine_distance_km(via_lat, via_lng, 19.288, 72.8777), 10.0 * 1.15 - 1e-6
        )
        # Detour cost is symmetric (A→B == B→A) so distance matrices stay symmetric.
        reverse = obstacle_aware_leg(19.5000, 72.8777, 19.0760, 72.8777, obstacles)
        self.assertAlmostEqual(detoured[0], reverse[0], places=6)

    def test_stage_2b_vrp_reroutes_around_obstacle(self):
        """Optimizer must produce a DIFFERENT, cheaper (obstacle-aware) stop order."""
        whs = [{"id": "w1", "lat": 19.0, "lng": 72.0}]
        orders = [
            {"id": "A", "dest_lat": 19.6, "dest_lng": 71.8, "weight_kg": 50.0},
            {"id": "B", "dest_lat": 19.3, "dest_lng": 72.5, "weight_kg": 50.0},
            {"id": "C", "dest_lat": 19.7, "dest_lng": 72.4, "weight_kg": 50.0},
        ]
        vehs = [{"id": "v1", "capacity_kg": 5000.0}]
        obstacles = [{"obstacle_id": "ob-reseq", "obstacle_type": "ACCIDENT",
                      "latitude": 19.21, "longitude": 71.93, "radius_km": 18.0,
                      "status": "ACTIVE"}]

        base = VRPOptimizer(whs, orders, vehs).solve_vrp()
        avoid = VRPOptimizer(whs, orders, vehs, obstacles=obstacles).solve_vrp()
        self.assertEqual(base["status"], "SUCCESS")
        self.assertEqual(avoid["status"], "SUCCESS")

        base_order = [s["order_id"] for s in base["routes"][0]["stops"]]
        new_order = [s["order_id"] for s in avoid["routes"][0]["stops"]]

        # The reported blockage sits on the old optimal path → new stop order.
        self.assertNotEqual(base_order, new_order)

        # Obstacle metadata is surfaced on the response.
        self.assertEqual(avoid["obstacles_considered"], 1)
        self.assertIn("Obstacle Avoidance", avoid["solver_engine"])
        route = avoid["routes"][0]
        self.assertIsInstance(route["obstacles_avoided"], list)
        # All new legs are clear of the blockage → plain geometry (depot + 3 stops),
        # no detour via-points required.
        self.assertEqual(len(route["geometry"]), 4)
        self.assertEqual(route["obstacles_avoided"], [])

        # The chosen order must be strictly cheaper under the obstacle-aware
        # metric than continuing on the old order.
        def order_cost(order_ids, obs):
            by_id = {o["id"]: o for o in orders}
            pts = [(19.0, 72.0)] + [
                (by_id[i]["dest_lat"], by_id[i]["dest_lng"]) for i in order_ids
            ]
            return sum(
                obstacle_aware_leg(a[0], a[1], b[0], b[1], obs)[0]
                for a, b in zip(pts[:-1], pts[1:])
            )

        # Old order crosses the reported blockage (must pay detours)…
        self.assertGreater(order_cost(base_order, obstacles), order_cost(base_order, None))
        # …the new order completely avoids the no-go zone (cost unchanged).
        self.assertAlmostEqual(
            order_cost(new_order, obstacles), order_cost(new_order, None), places=6
        )
        self.assertLess(order_cost(new_order, obstacles), order_cost(base_order, obstacles))
        # Reported distance matches the obstacle-aware cost of the new order.
        self.assertAlmostEqual(avoid["total_distance_km"], order_cost(new_order, obstacles), delta=0.01)

        # RESOLVED obstacles are ignored entirely.
        resolved = VRPOptimizer(
            whs, orders, vehs, obstacles=[dict(obstacles[0], status="RESOLVED")]
        ).solve_vrp()
        self.assertEqual(resolved["obstacles_considered"], 0)
        self.assertEqual(resolved["total_distance_km"], base["total_distance_km"])

    def test_stage_2c_driver_report_obstacle_endpoint(self):
        """POST /driver/report-obstacle: persist + re-optimize remaining stops."""
        import copy
        from app.api.v1.driver import DRIVER_SHIFTS, ObstacleReportRequest, report_path_obstacle
        from app.services.optimization.vrp_solver import haversine_distance_km

        snapshot = copy.deepcopy(DRIVER_SHIFTS)
        db = SessionLocal()
        try:
            before = len(load_obstacles(db, status="ACTIVE"))
            req = ObstacleReportRequest(
                obstacle_type="accident",  # case-insensitive normalization
                description="Overturned truck ahead on the flyover",
                radius_km=3.0,
            )
            res = report_path_obstacle(req=req, driver_id="DRV-01", db=db)

            # 1. Obstacle persisted and reported back (ACTIVE).
            self.assertEqual(res["status"], "SUCCESS")
            self.assertEqual(res["obstacle"]["status"], "ACTIVE")
            self.assertEqual(res["obstacle"]["obstacle_type"], "ACCIDENT")
            self.assertEqual(res["obstacle"]["reported_by"], "DRV-01")
            self.assertEqual(len(load_obstacles(db, status="ACTIVE")), before + 1)

            # 2. Reroute summary: detour distance + avoided blockage surfaced.
            reroute = res["reroute"]
            self.assertEqual(reroute["previous_order"], ["ORD-102"])
            self.assertEqual(reroute["new_order"], ["ORD-102"])
            self.assertFalse(reroute["stops_resequenced"])
            self.assertTrue(reroute["obstacles_avoided"])
            # Obstacle sits mid-leg → obstacle-aware remainder > straight line.
            straight = haversine_distance_km(18.9220, 72.8347, 19.2183, 72.9781)
            self.assertGreater(reroute["new_remaining_km"], straight)

            # 3. Updated shift: delivered stop pinned first, pending renumbered,
            #    route totals recomputed.
            stops = res["updated_shift"]["assigned_route"]["stops"]
            self.assertEqual(stops[0]["order_id"], "ORD-101")
            self.assertEqual(stops[0]["status"], "DELIVERED")
            self.assertEqual(stops[0]["sequence"], 1)
            self.assertEqual(stops[1]["order_id"], "ORD-102")
            self.assertEqual(stops[1]["sequence"], 2)
            self.assertTrue(stops[1]["eta"])
            self.assertGreater(res["updated_shift"]["assigned_route"]["total_distance_km"], 0)

            # 4. Bad obstacle type → HTTP 400.
            from fastapi import HTTPException
            with self.assertRaises(HTTPException) as ctx:
                report_path_obstacle(
                    req=ObstacleReportRequest(obstacle_type="ALIEN_INVASION", radius_km=1.0),
                    driver_id="DRV-01", db=db,
                )
            self.assertEqual(ctx.exception.status_code, 400)

            # 5. Clean up: resolve every obstacle this test created.
            for ob in load_obstacles(db, status="ACTIVE"):
                if ob.get("reported_by") == "DRV-01" and "flyover" in (ob.get("description") or ""):
                    resolve_obstacle(db, ob["obstacle_id"])
        finally:
            DRIVER_SHIFTS.clear()
            DRIVER_SHIFTS.update(snapshot)
            db.close()

    def test_stage_2e_demo_coordinates_and_explicit_report(self):
        """GET /driver/demo-coordinates: random point ON the path + explicit report.

        The demo coordinate must land on a route leg (so the blockage actually
        clips the path), be different on every call, and — when reported with
        explicit coordinates — produce a detour geometry in the response.
        """
        import copy
        from app.api.v1.driver import (
            DRIVER_SHIFTS, ObstacleReportRequest, demo_coordinates, report_path_obstacle,
        )
        from app.services.optimization.vrp_solver import haversine_distance_km
        from app.services.optimization.obstacles import load_obstacles

        snapshot = copy.deepcopy(DRIVER_SHIFTS)
        db = SessionLocal()
        try:
            # 1. Demo coordinates are valid and sit on the path.
            demo = demo_coordinates("DRV-01")
            self.assertTrue(-90 <= demo["latitude"] <= 90)
            self.assertTrue(-180 <= demo["longitude"] <= 180)
            self.assertGreater(demo["leg_distance_km"], 0)
            self.assertGreaterEqual(demo["position_on_leg"], 0.2)
            self.assertLessEqual(demo["position_on_leg"], 0.8)

            # The point must be close to the leg it claims to sit on.
            shift = DRIVER_SHIFTS["DRV-01"]
            route = shift["assigned_route"]
            pending = [s for s in route["stops"] if s.get("status") != "DELIVERED"]
            delivered = [s for s in route["stops"] if s.get("status") == "DELIVERED"]
            cur = (delivered[-1]["dest_lat"], delivered[-1]["dest_lng"]) if delivered \
                else (route["origin_lat"], route["origin_lng"])
            legs = []
            for stop in pending:
                legs.append((cur, (stop["dest_lat"], stop["dest_lng"])))
                cur = (stop["dest_lat"], stop["dest_lng"])
            min_to_leg = min(
                _point_to_segment_km(
                    demo["latitude"], demo["longitude"], a[0], a[1], b[0], b[1]
                )
                for a, b in legs
            )
            # Inside the demo radius (2 km) → the blockage clips the path.
            self.assertLess(min_to_leg, demo["radius_km"])

            # 2. Each call returns a DIFFERENT point (random each time).
            seen = {(demo["latitude"], demo["longitude"])}
            for _ in range(5):
                nxt = demo_coordinates("DRV-01")
                seen.add((nxt["latitude"], nxt["longitude"]))
            self.assertGreater(len(seen), 1)

            # 3. Reporting with those explicit coordinates re-routes and
            #    returns detour geometry.
            res = report_path_obstacle(
                req=ObstacleReportRequest(
                    obstacle_type="ROAD_CLOSED",
                    description="demo-coordinate blockage",
                    radius_km=demo["radius_km"],
                    latitude=demo["latitude"],
                    longitude=demo["longitude"],
                ),
                driver_id="DRV-01", db=db,
            )
            self.assertEqual(res["status"], "SUCCESS")
            # The obstacle is stored at the coordinates the driver supplied.
            self.assertAlmostEqual(res["obstacle"]["latitude"], demo["latitude"], places=4)
            self.assertAlmostEqual(res["obstacle"]["longitude"], demo["longitude"], places=4)

            reroute = res["reroute"]
            assigned = res["updated_shift"]["assigned_route"]
            # Detour is longer than the straight-line path.
            self.assertGreater(reroute["new_remaining_km"], reroute["straight_remaining_km"])
            # Geometry carries the detour via-points (more than origin + stops).
            geometry = assigned.get("geometry") or []
            straight = assigned.get("straight_geometry") or []
            self.assertGreater(len(geometry), len(straight))
            # Straight path = current position + one point per pending stop.
            pending_count = len([s for s in assigned["stops"] if s.get("status") != "DELIVERED"])
            self.assertEqual(len(straight), 1 + pending_count)
            # The blockage is reported as avoided on this leg.
            self.assertTrue(reroute["obstacles_avoided"])

            # 4. Clean up every obstacle this test created.
            for ob in load_obstacles(db, status="ACTIVE"):
                if ob.get("description") == "demo-coordinate blockage":
                    resolve_obstacle(db, ob["obstacle_id"])
        finally:
            DRIVER_SHIFTS.clear()
            DRIVER_SHIFTS.update(snapshot)
            db.close()

    def test_stage_2f_unknown_api_path_returns_404_not_null(self):
        """Regression: unmatched /api/* paths must 404, never answer 200 `null`.

        The SPA catch-all used to `return None` for `api/` paths, so a request
        for a route missing from a stale backend build came back as HTTP 200
        with a literal ``null`` body. The frontend then dereferenced it
        ("Cannot read properties of null (reading 'latitude')") instead of
        seeing a clean 404.
        """
        from fastapi import HTTPException
        from app.main import app

        # Locate the SPA catch-all route registered on the app.
        catch_all = None
        for route in app.routes:
            if getattr(route, "path", None) == "/{full_path:path}":
                catch_all = route
                break
        self.assertIsNotNone(catch_all, "SPA catch-all route is missing")

        # An unmatched /api/* path must raise a 404, NOT return None.
        with self.assertRaises(HTTPException) as ctx:
            catch_all.endpoint("api/v1/driver/does-not-exist")
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("Unknown API endpoint", str(ctx.exception.detail))

        # A non-API SPA path must still fall through to the frontend handler
        # (it must NOT raise).
        try:
            catch_all.endpoint("some/spa/route")
        except HTTPException as exc:
            self.assertNotEqual(exc.status_code, 404)

    def test_stage_2f2_demo_coordinates_route_is_registered(self):
        """The demo-coordinates route must exist on the driver router.

        A stale backend build silently 404'd this route, which is what
        produced the null body the portal crashed on.
        """
        from app.main import app
        paths = set(app.openapi().get("paths", {}).keys())
        self.assertIn("/api/v1/driver/demo-coordinates", paths)
        self.assertIn("/api/v1/driver/report-obstacle", paths)

    def test_stage_2g_obstacle_summary_skips_null_coordinates(self):
        """Regression: `obstacles_avoided` must never contain a null point.

        `dict.get(key, fallback)` only falls back when the key is ABSENT, so a
        present-but-None `latitude` used to leak into the response and crash
        every client that reads `.latitude` directly.
        """
        solver = VRPOptimizer(
            warehouses=[{"id": "w1", "lat": 19.0, "lng": 72.0}],
            orders=[{"id": "o1", "dest_lat": 19.1, "dest_lng": 72.1, "weight_kg": 10.0}],
            vehicles=[{"id": "v1", "capacity_kg": 500.0}],
            obstacles=[
                # Present-but-None coordinates: must be dropped, not emitted.
                {"obstacle_id": "ob-null", "obstacle_type": "ROAD_CLOSED",
                 "latitude": None, "longitude": None, "radius_km": 2.0},
                # Absent coordinates entirely: must be dropped too.
                {"obstacle_id": "ob-absent", "obstacle_type": "ACCIDENT",
                 "radius_km": 2.0},
                # A null entry in the obstacle list itself.
                None,
            ],
        )
        summary = solver._obstacle_summary(["ob-null", "ob-absent", "ob-missing"])
        self.assertEqual(summary, [])
        for item in summary:
            self.assertIsNotNone(item.get("latitude"))
            self.assertIsNotNone(item.get("longitude"))

    def test_stage_2h_obstacle_summary_uses_lat_lng_fallback(self):
        """The `lat`/`lng` alias fallback must still work for real obstacles."""
        solver = VRPOptimizer(
            warehouses=[{"id": "w1", "lat": 19.0, "lng": 72.0}],
            orders=[{"id": "o1", "dest_lat": 19.1, "dest_lng": 72.1, "weight_kg": 10.0}],
            vehicles=[{"id": "v1", "capacity_kg": 500.0}],
            obstacles=[{"obstacle_id": "ob-alias", "obstacle_type": "FLOODING",
                        "lat": 19.05, "lng": 72.05, "radius_km": 1.5}],
        )
        summary = solver._obstacle_summary(["ob-alias"])
        self.assertEqual(len(summary), 1)
        self.assertAlmostEqual(summary[0]["latitude"], 19.05, places=6)
        self.assertAlmostEqual(summary[0]["longitude"], 72.05, places=6)
        self.assertEqual(summary[0]["obstacle_type"], "FLOODING")
        self.assertAlmostEqual(summary[0]["radius_km"], 1.5, places=6)

    def test_stage_2d_obstacle_crud_endpoints(self):
        """GET/POST/DELETE /routes/obstacles round-trip + validation."""
        from fastapi import HTTPException
        from app.api.v1.routes import (
            ObstacleCreateRequest, list_path_obstacles, clear_path_obstacle,
        )
        from app.api.v1.routes import report_path_obstacle as create_endpoint

        db = SessionLocal()
        try:
            created = create_endpoint(
                req=ObstacleCreateRequest(
                    obstacle_type="FLOODING",
                    latitude=19.10, longitude=72.90,
                    radius_km=4.0, description="Waterlogging under flyover",
                    reported_by="DRV-02", vehicle_id="V-102",
                ),
                db=db,
            )
            self.assertEqual(created["status"], "ACTIVE")
            self.assertEqual(created["obstacle_type"], "FLOODING")

            active = list_path_obstacles(status="ACTIVE", db=db)
            self.assertTrue(any(o["obstacle_id"] == created["obstacle_id"] for o in active))

            cleared = clear_path_obstacle(obstacle_id=created["obstacle_id"], db=db)
            self.assertEqual(cleared["status"], "RESOLVED")
            remaining = [o for o in list_path_obstacles(status="ACTIVE", db=db)
                         if o["obstacle_id"] == created["obstacle_id"]]
            self.assertEqual(remaining, [])

            with self.assertRaises(HTTPException) as ctx:
                clear_path_obstacle(obstacle_id="does-not-exist", db=db)
            self.assertEqual(ctx.exception.status_code, 404)

            with self.assertRaises(HTTPException) as ctx:
                create_endpoint(
                    req=ObstacleCreateRequest(obstacle_type="METEOR", latitude=1.0, longitude=1.0),
                    db=db,
                )
            self.assertEqual(ctx.exception.status_code, 400)

            with self.assertRaises(HTTPException) as ctx:
                create_endpoint(
                    req=ObstacleCreateRequest(obstacle_type="ACCIDENT", latitude=1.0,
                                              longitude=1.0, radius_km=999.0),
                    db=db,
                )
            self.assertEqual(ctx.exception.status_code, 400)
        finally:
            db.close()

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
