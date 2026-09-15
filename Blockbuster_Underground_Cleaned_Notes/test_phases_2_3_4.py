"""
Unit & Integration Tests for Project 35 Phases 2, 3, and 4
=========================================================
"""

import unittest
from affiliate_engine import AffiliateDistributionEngine
from archive_sync import ArchiveStorageSynchronizer
from atlantis_gateway import AtlantisGateway
from control_plane import SystemControlPlane
from financial_recovery import FinancialRecoveryAndNAVEngine
from remote_mesh import MultiDeviceRemoteMesh
from yggdrasil_dag import YggdrasilDAGStore


class TestProject35Phases(unittest.TestCase):
    def setUp(self):
        self.control_plane = SystemControlPlane(
            storage_db_path=":memory:",
            archive_vault_db_path=":memory:",
            boundary_secret_key="secret-phase-tests",
            tamper_secret="tamper-phase-tests",
            onion_address="atlantis777chi777underground.onion",
        )
        self.control_plane.register_operator("lead_architect", "Lead Garage Architect")

    # --- Phase 2: Affiliate Engine Tests ---
    def test_affiliate_conversion_and_lineage(self):
        engine = AffiliateDistributionEngine(
            dag_store=self.control_plane.dag_store,
            archive_sync=self.control_plane.synchronizer,
            gateway=self.control_plane.gateway,
            commission_rate_default=0.20,
        )
        partner = engine.register_partner(
            partner_id="partner_007",
            name="Alpha Media Loop",
            payout_address="0xABC123...PAYOUT",
        )
        self.assertEqual(partner["partner_id"], "partner_007")

        link = engine.generate_referral_link("partner_007", campaign="tor_recovery")
        self.assertIn("tor://atlantis777chi777underground.onion/ref/partner_007/tor_recovery", link)

        conv = engine.record_conversion(
            partner_id="partner_007",
            conversion_value=1000.0,
            customer_ref="cust_9981",
        )
        self.assertEqual(conv["status"], "conversion_processed")
        self.assertEqual(conv["commission_amount"], 200.0)
        self.assertEqual(conv["capital_recycled"], 800.0)
        self.assertIsNotNone(conv["tamper_seal"])

        # Audit Lineage
        trace = self.control_plane.audit_node_lineage(conv["node_id"])
        self.assertIsNotNone(trace)
        self.assertEqual(trace["verification_check"]["verifier"], "Affiliate_Ledger_Sentinel")

    # --- Phase 3: Multi-Device Remote Control Tests ---
    def test_multi_device_pairing_and_rpc_dispatch(self):
        mesh = MultiDeviceRemoteMesh(control_plane=self.control_plane)
        device = mesh.pair_device(
            device_id="iphone_15_pro",
            device_name="Lead iPhone Controller",
            device_type="iPhone",
            operator_key_id="lead_architect",
        )
        self.assertEqual(device["device_type"], "iPhone")

        token = self.control_plane.generate_token("lead_architect")
        dispatch_res = mesh.dispatch_remote_command(
            device_id="iphone_15_pro",
            token=token,
            action="status_summary",
            payload={},
        )
        self.assertEqual(dispatch_res["status"], "success")
        self.assertEqual(dispatch_res["result"]["archive_vault"]["tier"], "QUEEN_ELIZABETH_INHERITANCE")

        telemetry = mesh.get_dashboard_telemetry()
        self.assertEqual(len(telemetry["devices"]), 1)
        self.assertEqual(telemetry["recent_commands_count"], 1)

    # --- Phase 4: Financial Recovery & NAV Optimization Tests ---
    def test_nav_computation_and_debt_restructuring(self):
        engine = FinancialRecoveryAndNAVEngine(
            dag_store=self.control_plane.dag_store,
            archive_sync=self.control_plane.synchronizer,
        )
        engine.register_asset("asset_1", "Real Estate Portfolio", quantity=10, unit_price=200000.0, asset_type="property")
        engine.register_asset("asset_2", "Liquid Reserve", quantity=500000, unit_price=1.0, asset_type="cash")
        engine.register_liability("liab_1", "Senior Secured Debt", principal=1000000.0, interest_rate=0.08, term_months=24)

        nav_initial = engine.compute_nav()
        self.assertEqual(nav_initial["total_assets"], 2500000.0)
        self.assertEqual(nav_initial["total_liabilities"], 1000000.0)
        self.assertEqual(nav_initial["nav"], 1500000.0)

        sim = engine.simulate_debt_restructure(
            liability_id="liab_1",
            new_interest_rate=0.04,
            new_term_months=36,
            consolidation_subsidy=100000.0,
        )
        self.assertTrue(sim["feasible"])
        self.assertGreater(sim["projected_savings"], 0)

        exec_res = engine.execute_restructure_commit(
            liability_id="liab_1",
            new_interest_rate=0.04,
            new_term_months=36,
            consolidation_subsidy=100000.0,
            operator_key="lead_architect",
        )
        self.assertEqual(exec_res["status"], "restructure_committed")
        self.assertIsNotNone(exec_res["tamper_seal"])
        self.assertEqual(exec_res["nav_snapshot"]["total_liabilities"], 900000.0)


if __name__ == "__main__":
    unittest.main()
