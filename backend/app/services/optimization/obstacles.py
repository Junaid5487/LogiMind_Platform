"""Persistence helpers for driver-reported path obstacles (route blockages).

Shared by the routes API (fleet-level optimize/list/resolve) and the driver
API (report + immediate re-optimization) so both sides always read the same
ACTIVE obstacle set.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.db.models import RouteObstacle

# Canonical taxonomy shown in driver/fleet UIs.
OBSTACLE_TYPES = (
    "ROAD_CLOSED",
    "ACCIDENT",
    "FLOODING",
    "CONSTRUCTION",
    "TRAFFIC_JAM",
    "DEBRIS",
    "PUBLIC_EVENT",
    "OTHER",
)

MIN_RADIUS_KM = 0.1
MAX_RADIUS_KM = 50.0


def validate_obstacle_input(obstacle_type: str, radius_km: float) -> str:
    """Normalize the type label and bounds-check the radius.

    Returns the canonical UPPERCASE type. Raises ``ValueError`` on bad input;
    API routers translate that into HTTP 400 responses.
    """
    ob_type = (obstacle_type or "").strip().upper().replace(" ", "_")
    if ob_type not in OBSTACLE_TYPES:
        raise ValueError(
            f"Unknown obstacle type '{obstacle_type}'. Use: {', '.join(OBSTACLE_TYPES)}."
        )
    if radius_km < MIN_RADIUS_KM or radius_km > MAX_RADIUS_KM:
        raise ValueError(f"radius_km must be between {MIN_RADIUS_KM} and {MAX_RADIUS_KM} km.")
    return ob_type


def obstacle_to_dict(obstacle: RouteObstacle) -> Dict[str, Any]:
    return {
        "obstacle_id": obstacle.obstacle_id,
        "obstacle_type": obstacle.obstacle_type,
        "description": obstacle.description,
        "latitude": obstacle.latitude,
        "longitude": obstacle.longitude,
        "radius_km": obstacle.radius_km,
        "reported_by": obstacle.reported_by,
        "vehicle_id": obstacle.vehicle_id,
        "status": obstacle.status,
        "created_at": obstacle.created_at.isoformat() if obstacle.created_at else None,
        "resolved_at": obstacle.resolved_at.isoformat() if obstacle.resolved_at else None,
    }


def load_obstacles(db: Session, status: Optional[str] = "ACTIVE") -> List[Dict[str, Any]]:
    """Obstacle dicts for the solver/UI. Newest reports first."""
    query = db.query(RouteObstacle)
    if status and status != "ALL":
        query = query.filter(RouteObstacle.status == status)
    rows = query.order_by(RouteObstacle.created_at.desc(), RouteObstacle.obstacle_id.asc()).all()
    return [obstacle_to_dict(row) for row in rows]


def create_obstacle(
    db: Session,
    *,
    obstacle_type: str,
    latitude: float,
    longitude: float,
    radius_km: float,
    description: Optional[str] = None,
    reported_by: Optional[str] = None,
    vehicle_id: Optional[str] = None,
) -> Dict[str, Any]:
    obstacle = RouteObstacle(
        obstacle_type=obstacle_type,
        description=(description or "").strip() or None,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        reported_by=reported_by,
        vehicle_id=vehicle_id,
        status="ACTIVE",
    )
    db.add(obstacle)
    db.commit()
    db.refresh(obstacle)
    return obstacle_to_dict(obstacle)


def resolve_obstacle(db: Session, obstacle_id: str) -> Optional[Dict[str, Any]]:
    """Mark a blockage as cleared. Returns None when the id is unknown."""
    row = db.query(RouteObstacle).filter(RouteObstacle.obstacle_id == obstacle_id).first()
    if row is None:
        return None
    if row.status != "RESOLVED":
        row.status = "RESOLVED"
        row.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
    return obstacle_to_dict(row)
