#!/usr/bin/env python3
"""
nav_system.py: Navigation Clock GPS Drive, Recursive Collateral Packaging,
and Eternal Ledger Sink for Distressed-to-Clean Asset Swapping.
"""

import math
import time
import hashlib
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field


@dataclass(frozen=True)
class CoordinateState:
    lat: float
    lon: float
    altitude_m: float
    epoch_timestamp: float
    quantum_tick: int


class NavClockGPS:
    """Temporal and spatial positioning engine tracking orbital/quantum drift."""

    def __init__(self, base_lat: float = 0.0, base_lon: float = 0.0, base_alt: float = 100.0):
        self.lat = base_lat
        self.lon = base_lon
        self.altitude = base_alt
        self.tick_counter = 0

    def tick(self, timestamp: Optional[float] = None) -> CoordinateState:
        self.tick_counter += 1
        now = timestamp if timestamp is not None else time.time()
        
        # Spatial coordinate vector update
        self.lat = ((self.lat + 0.0001 * math.sin(self.tick_counter)) + 90.0) % 180.0 - 90.0
        self.lon = ((self.lon + 0.0001 * math.cos(self.tick_counter)) + 180.0) % 360.0 - 180.0
        self.altitude = self.altitude + 0.5 * math.sin(self.tick_counter * 0.1)

        return CoordinateState(
            lat=round(self.lat, 6),
            lon=round(self.lon, 6),
            altitude_m=round(self.altitude, 2),
            epoch_timestamp=now,
            quantum_tick=self.tick_counter,
        )


@dataclass
class Asset:
    asset_id: str
    name: str
    nominal_value: float
    toxicity_score: float  # 0.0 (pristine/clean) to 1.0 (fully toxic/distressed)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.nominal_value < 0:
            raise ValueError(f"Nominal value must be non-negative: {self.nominal_value}")
        if not (0.0 <= self.toxicity_score <= 1.0):
            raise ValueError(f"Toxicity score must be between 0.0 and 1.0: {self.toxicity_score}")

    @property
    def clean_value(self) -> float:
        """Effective liquidation value discounting the toxic portion."""
        return self.nominal_value * (1.0 - self.toxicity_score)


@dataclass
class PlasmaPackage:
    package_id: str
    depth: int = 1
    direct_assets: List[Asset] = field(default_factory=list)
    nested_packages: List['PlasmaPackage'] = field(default_factory=list)
    signature: str = ""

    def __post_init__(self):
        if not self.signature:
            self.signature = self._generate_signature()

    def _generate_signature(self) -> str:
        asset_ids = ",".join(sorted(a.asset_id for a in self.direct_assets))
        child_ids = ",".join(sorted(p.package_id for p in self.nested_packages))
        payload = f"{self.package_id}:{self.depth}:{asset_ids}:{child_ids}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]

    def aggregate_nominal(self) -> float:
        total = sum(a.nominal_value for a in self.direct_assets)
        total += sum(p.aggregate_nominal() for p in self.nested_packages)
        return total

    def aggregate_clean_value(self) -> float:
        total = sum(a.clean_value for a in self.direct_assets)
        total += sum(p.aggregate_clean_value() for p in self.nested_packages)
        return total

    def aggregate_toxicity(self) -> float:
        nominal = self.aggregate_nominal()
        if nominal == 0.0:
            return 0.0
        toxic_mass = sum(a.nominal_value * a.toxicity_score for a in self.direct_assets)
        for p in self.nested_packages:
            toxic_mass += p.aggregate_nominal() * p.aggregate_toxicity()
        return toxic_mass / nominal


class EternalRecyclingSink:
    """Immutable ledger sink: absorbs toxic debt, mints sanitized clean units."""

    def __init__(self, reserve_pool_value: float = 1_000_000.0, max_haircut: float = 0.90):
        self.reserve_clean_pool: float = float(reserve_pool_value)
        self.max_haircut: float = max_haircut
        self.sink_burn_register: List[Dict[str, Any]] = []
        self.minted_pristine_units: float = 0.0

    def calculate_haircut(self, package: PlasmaPackage) -> float:
        """Dynamic haircut based on recursion depth and aggregate toxicity."""
        depth_penalty = 0.05 * math.log2(package.depth + 1)
        toxicity_penalty = 0.20 * package.aggregate_toxicity()
        base_haircut = 0.10
        total_haircut = base_haircut + depth_penalty + toxicity_penalty
        return min(total_haircut, self.max_haircut)

    def cleanse_and_swap(self, package: PlasmaPackage, clock_state: CoordinateState) -> Dict[str, Any]:
        nom_val = package.aggregate_nominal()
        toxicity = package.aggregate_toxicity()
        clean_val = package.aggregate_clean_value()

        if clean_val == 0.0:
            # 100% toxic / worthless package produces zero clean units
            swappable_clean_value = 0.0
            haircut = 1.0
        else:
            haircut = self.calculate_haircut(package)
            swappable_clean_value = clean_val * (1.0 - haircut)

        if swappable_clean_value > self.reserve_clean_pool:
            raise ValueError(
                f"Insufficient clean reserve liquidity: required {swappable_clean_value:.2f}, "
                f"available {self.reserve_clean_pool:.2f}"
            )

        self.reserve_clean_pool -= swappable_clean_value
        self.minted_pristine_units += swappable_clean_value

        burn_entry = {
            "timestamp": clock_state.epoch_timestamp,
            "tick": clock_state.quantum_tick,
            "gps_coordinates": (clock_state.lat, clock_state.lon, clock_state.altitude_m),
            "package_id": package.package_id,
            "depth": package.depth,
            "burnt_toxic_nominal": nom_val,
            "aggregate_toxicity": round(toxicity, 4),
            "cleansed_swapped_out": round(swappable_clean_value, 4),
            "haircut_applied": round(haircut, 4),
            "signature": package.signature,
        }
        self.sink_burn_register.append(burn_entry)

        return {
            "status": "SWAP_SUCCESS",
            "package_id": package.package_id,
            "received_clean_units": swappable_clean_value,
            "absorbed_distressed_nominal": nom_val,
            "haircut_applied": haircut,
            "sink_receipt": burn_entry,
        }


class NavEngine:
    """Master NAV system coordinating temporal drive, packages, and net value calculations."""

    def __init__(self, initial_clean_reserve: float = 5_000_000.0):
        self.clock = NavClockGPS()
        self.sink = EternalRecyclingSink(reserve_pool_value=initial_clean_reserve)
        self.active_packages: Dict[str, PlasmaPackage] = {}

    def register_package(self, package: PlasmaPackage):
        self.active_packages[package.package_id] = package

    def execute_plasma_swap(self, package_id: str) -> Dict[str, Any]:
        if package_id not in self.active_packages:
            raise KeyError(f"Package '{package_id}' is not in active registry.")

        package = self.active_packages.pop(package_id)
        current_gps = self.clock.tick()
        return self.sink.cleanse_and_swap(package, current_gps)

    def compute_nav(self) -> Dict[str, Any]:
        """Calculates global Net Asset Value (NAV) metrics across reserve and active items."""
        current_gps = self.clock.tick()
        active_nominal = sum(p.aggregate_nominal() for p in self.active_packages.values())
        active_clean = sum(p.aggregate_clean_value() for p in self.active_packages.values())
        reserve_clean = self.sink.reserve_clean_pool
        minted_pristine = self.sink.minted_pristine_units

        # NAV per share calculation
        total_underlying_clean_nav = reserve_clean + active_clean
        nav_per_share = (
            (total_underlying_clean_nav / minted_pristine)
            if minted_pristine > 0
            else 1.0
        )

        return {
            "quantum_tick": current_gps.quantum_tick,
            "epoch": current_gps.epoch_timestamp,
            "gps_lat": current_gps.lat,
            "gps_lon": current_gps.lon,
            "total_clean_nav": round(total_underlying_clean_nav, 4),
            "reserve_pool": round(reserve_clean, 4),
            "active_unswapped_clean": round(active_clean, 4),
            "active_unswapped_toxic_nominal": round(active_nominal, 4),
            "minted_pristine_shares": round(minted_pristine, 4),
            "nav_per_share": round(nav_per_share, 6),
        }
