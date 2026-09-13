#!/usr/bin/env python3
"""
test_nav_system.py: Unit tests for NAV, GPS clock, recursive package evaluation,
and toxic-for-clean asset swapping logic.
"""

import unittest
from nav_system import (
    NavClockGPS,
    Asset,
    PlasmaPackage,
    EternalRecyclingSink,
    NavEngine,
)


class TestNavClockGPS(unittest.TestCase):
    def test_clock_tick_increments_and_bounds(self):
        clock = NavClockGPS(base_lat=45.0, base_lon=90.0, base_alt=200.0)
        state1 = clock.tick(timestamp=1000.0)
        state2 = clock.tick(timestamp=1001.0)

        self.assertEqual(state1.quantum_tick, 1)
        self.assertEqual(state2.quantum_tick, 2)
        self.assertEqual(state1.epoch_timestamp, 1000.0)
        self.assertEqual(state2.epoch_timestamp, 1001.0)
        self.assertTrue(-90.0 <= state2.lat <= 90.0)
        self.assertTrue(-180.0 <= state2.lon <= 180.0)


class TestAssetAndPlasmaPackage(unittest.TestCase):
    def test_asset_validation(self):
        with self.assertRaises(ValueError):
            Asset("BAD-1", "Negative Asset", nominal_value=-100.0, toxicity_score=0.5)

        with self.assertRaises(ValueError):
            Asset("BAD-2", "Invalid Toxicity", nominal_value=100.0, toxicity_score=1.5)

    def test_single_asset_clean_value(self):
        pristine = Asset("A1", "Pristine Bond", nominal_value=1000.0, toxicity_score=0.0)
        distressed = Asset("A2", "Subprime Loan", nominal_value=1000.0, toxicity_score=0.8)
        worthless = Asset("A3", "Zero Recovery", nominal_value=1000.0, toxicity_score=1.0)

        self.assertAlmostEqual(pristine.clean_value, 1000.0, places=4)
        self.assertAlmostEqual(distressed.clean_value, 200.0, places=4)
        self.assertAlmostEqual(worthless.clean_value, 0.0, places=4)

    def test_recursive_nested_packages(self):
        # Leaf package
        leaf_assets = [
            Asset("L1", "Junk Debt", nominal_value=10_000.0, toxicity_score=0.7),
            Asset("L2", "Distressed Note", nominal_value=10_000.0, toxicity_score=0.9),
        ]
        leaf = PlasmaPackage(package_id="LEAF-1", depth=1, direct_assets=leaf_assets)

        # Root package containing direct assets and the leaf package
        root_assets = [
            Asset("R1", "Grade-B Loan", nominal_value=30_000.0, toxicity_score=0.2),
        ]
        root = PlasmaPackage(
            package_id="ROOT-1",
            depth=2,
            direct_assets=root_assets,
            nested_packages=[leaf],
        )

        # Total nominal = 30k + 10k + 10k = 50k
        self.assertEqual(root.aggregate_nominal(), 50_000.0)

        # Clean value = (30k * 0.8) + (10k * 0.3) + (10k * 0.1) = 24k + 3k + 1k = 28k
        self.assertEqual(root.aggregate_clean_value(), 28_000.0)

        # Toxic mass = (30k * 0.2) + (10k * 0.7) + (10k * 0.9) = 6k + 7k + 9k = 22k
        # Aggregate toxicity = 22k / 50k = 0.44
        self.assertAlmostEqual(root.aggregate_toxicity(), 0.44, places=4)


class TestEternalRecyclingSinkAndSwapping(unittest.TestCase):
    def setUp(self):
        self.clock = NavClockGPS()
        self.sink = EternalRecyclingSink(reserve_pool_value=500_000.0)

    def test_cleanse_and_swap_standard_package(self):
        assets = [
            Asset("TOX-1", "Distressed Asset", nominal_value=100_000.0, toxicity_score=0.5)
        ]
        package = PlasmaPackage(package_id="PKG-SWAP-1", depth=1, direct_assets=assets)
        clock_state = self.clock.tick()

        # Clean value = 50,000
        # Haircut = 0.10 + 0.05*log2(2) + 0.20*0.5 = 0.10 + 0.05 + 0.10 = 0.25 (25%)
        # Clean swapped out = 50,000 * (1 - 0.25) = 37,500
        result = self.sink.cleanse_and_swap(package, clock_state)

        self.assertEqual(result["status"], "SWAP_SUCCESS")
        self.assertEqual(result["absorbed_distressed_nominal"], 100_000.0)
        self.assertAlmostEqual(result["received_clean_units"], 37_500.0, places=2)
        self.assertEqual(self.sink.reserve_clean_pool, 500_000.0 - 37_500.0)
        self.assertEqual(self.sink.minted_pristine_units, 37_500.0)
        self.assertEqual(len(self.sink.sink_burn_register), 1)

    def test_swap_zero_clean_value_package(self):
        assets = [
            Asset("DEAD-1", "Completely Defaulted", nominal_value=50_000.0, toxicity_score=1.0)
        ]
        package = PlasmaPackage(package_id="PKG-DEAD", depth=1, direct_assets=assets)
        clock_state = self.clock.tick()

        result = self.sink.cleanse_and_swap(package, clock_state)
        self.assertEqual(result["status"], "SWAP_SUCCESS")
        self.assertEqual(result["received_clean_units"], 0.0)
        self.assertEqual(self.sink.minted_pristine_units, 0.0)
        self.assertEqual(self.sink.reserve_clean_pool, 500_000.0)

    def test_swap_insufficient_reserves_raises_error(self):
        sink = EternalRecyclingSink(reserve_pool_value=1_000.0)
        assets = [
            Asset("BIG-1", "Prime Clean Asset", nominal_value=100_000.0, toxicity_score=0.0)
        ]
        package = PlasmaPackage(package_id="PKG-BIG", depth=1, direct_assets=assets)
        clock_state = self.clock.tick()

        with self.assertRaises(ValueError):
            sink.cleanse_and_swap(package, clock_state)


class TestNavEngineIntegration(unittest.TestCase):
    def test_nav_lifecycle_and_accounting(self):
        engine = NavEngine(initial_clean_reserve=1_000_000.0)

        # Initial clean NAV state before packages
        init_nav = engine.compute_nav()
        self.assertEqual(init_nav["total_clean_nav"], 1_000_000.0)
        self.assertEqual(init_nav["nav_per_share"], 1.0)

        # Register package
        assets = [
            Asset("T-1", "Distressed Mortgage", nominal_value=200_000.0, toxicity_score=0.5)
        ]
        pkg = PlasmaPackage(package_id="PKG-INTEG-1", depth=1, direct_assets=assets)
        engine.register_package(pkg)

        # Check NAV includes unswapped clean collateral
        pre_swap_nav = engine.compute_nav()
        self.assertEqual(pre_swap_nav["active_unswapped_clean"], 100_000.0)
        self.assertEqual(pre_swap_nav["total_clean_nav"], 1_100_000.0)

        # Execute Swap
        swap_res = engine.execute_plasma_swap("PKG-INTEG-1")
        self.assertEqual(swap_res["status"], "SWAP_SUCCESS")

        # Post-swap NAV verification
        post_swap_nav = engine.compute_nav()
        self.assertEqual(post_swap_nav["active_unswapped_clean"], 0.0)
        self.assertTrue(post_swap_nav["minted_pristine_shares"] > 0)
        self.assertTrue(post_swap_nav["nav_per_share"] > 0)


if __name__ == "__main__":
    unittest.main()
