"""CVRPLIB (Augerat A-set) instance download + TSPLIB-style .vrp parser."""
from __future__ import annotations

import urllib.request
from pathlib import Path

import numpy as np

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def download(name: str) -> Path:
    config.VRP_DIR.mkdir(parents=True, exist_ok=True)
    path = config.VRP_DIR / f"{name}.vrp"
    if not path.exists():
        url = config.VRP_MIRROR.format(name)
        print(f"[cvrplib] downloading {url}")
        urllib.request.urlretrieve(url, path)
    return path


def parse_vrp(path: Path) -> dict:
    """Parse a TSPLIB-format CVR instance.

    Returns dict: name, coords (n x 2), dist (n x n float matrix),
    demands (list), capacity (int), vehicles (k parsed from name),
    n_customers (n-1).
    """
    coords: dict[int, tuple[float, float]] = {}
    demands: dict[int, int] = {}
    capacity = None
    section = None
    name = path.stem

    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line:
            continue
        if line in ("NODE_COORD_SECTION", "DEMAND_SECTION", "DEPOT_SECTION",
                    "DISPLAY_DATA_SECTION", "EOF"):
            if line == "EOF":
                break
            section = line
            continue
        if line.endswith(":") and line.replace(" ", "").isupper():
            section = line
            continue
        if line.startswith("CAPACITY"):
            capacity = int(line.split(":")[1])
        elif line.startswith("NAME"):
            name = line.split(":")[1].strip()
        elif section == "NODE_COORD_SECTION":
            i, x, y = line.split()
            coords[int(i)] = (float(x), float(y))
        elif section == "DEMAND_SECTION":
            i, d = line.split()
            demands[int(i)] = int(d)
        elif section == "DEPOT_SECTION":
            if line == "-1":
                section = None

    idx = sorted(coords)                      # node ids are 1..n -> 0..n-1
    pts = np.array([coords[i] for i in idx], dtype=float)
    n = len(idx)
    diff = pts[:, None, :] - pts[None, :, :]
    matrix = np.hypot(diff[:, :, 0], diff[:, :, 1])
    np.fill_diagonal(matrix, 0.0)
    dem = [demands[i] for i in idx]
    k = int(name.split("-k")[-1]) if "-k" in name else 1

    assert dem[0] == 0, "depot must be node 1 (index 0 after reindexing)"
    assert capacity and capacity > 0, "CAPACITY missing from .vrp file"
    return {
        "name": name, "coords": pts, "dist": matrix, "demands": dem,
        "capacity": int(capacity), "vehicles": k, "n_customers": n - 1,
    }


def load_instance(name: str) -> dict:
    return parse_vrp(download(name))


def load_all(names: list[str] | None = None) -> list[dict]:
    out, failed = [], []
    for nm in (names or config.INSTANCES):
        try:
            out.append(load_instance(nm))
        except Exception as e:               # noqa: BLE001
            print(f"[cvrplib] SKIP {nm}: {e}")
            failed.append(nm)
    if failed:
        print(f"[cvrplib] {len(failed)} instance(s) unavailable: {failed}")
    return out
