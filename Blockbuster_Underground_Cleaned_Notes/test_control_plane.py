"""
Unit Tests for System Control Plane Integration
===============================================
"""

import unittest
from control_plane import SystemControlPlane


class TestSystemControlPlane(unittest.TestCase):
    def setUp(self):
        self.control_plane = SystemControlPlane(
            storage_db_path=":memory:",
            archive_vault_db_path=":memory:",
            boundary_secret_key="test-key-saturn",
            tamper_secret="test-seal-inherit",
            onion_address="atlantis777chi777underground.onion",
        )
        self.control_plane.register_operator("op_01", "Chief Garage Architect")

    def test_status_summary(self):
        summary = self.control_plane.status_summary()
        self.assertEqual(summary["gateway"]["onion_address"], "atlantis777chi777underground.onion")
        self.assertEqual(summary["gateway"]["authorized_operators_count"], 1)
        self.assertEqual(summary["archive_vault"]["tier"], "QUEEN_ELIZABETH_INHERITANCE")
        self.assertEqual(summary["archive_vault"]["status"], "online")

    def test_execute_financial_loop_and_lineage_audit(self):
        token = self.control_plane.generate_token("op_01", para_epoch="1999.OCT.28")
        result = self.control_plane.execute_financial_loop(
            token=token,
            loop_name="DEBT_RESTRUCTURE_CYCLE_01",
            transaction_data={
                "asset": "Convertible Debenture 1999",
                "refinance_rate": 0.052,
                "amount": 25000000,
            },
            branch="finance_core",
            auto_archive=True,
        )

        self.assertEqual(result["status"], "success")
        node_id = result["node_id"]
        self.assertIsNotNone(node_id)
        self.assertEqual(result["archive_result"]["status"], "archived")

        # Audit Lineage
        audit = self.control_plane.audit_node_lineage(node_id)
        self.assertIsNotNone(audit)
        self.assertEqual(audit["target_object_id"], node_id)
        self.assertEqual(audit["verification_check"]["verified_by"], "ControlPlane_Sentinel_op_01")
        self.assertEqual(audit["check_provenance"]["ruleset"], "SOURCE_THE_CHECK_V1")


if __name__ == "__main__":
    unittest.main()
