"""
Comprehensive test suite including Archive Storage Synchronizer.
"""

import os
import unittest
from atlantis_gateway import AtlantisGateway, AtlantisAuthError
from yggdrasil_dag import DAGNode, YggdrasilDAGStore
from archive_sync import ArchiveStorageSynchronizer, LineageRecord


class TestArchiveStorageSynchronizer(unittest.TestCase):
    def setUp(self):
        self.dag_store = YggdrasilDAGStore(":memory:")
        self.synchronizer = ArchiveStorageSynchronizer(
            dag_store=self.dag_store,
            vault_db_path=":memory:",
            tamper_secret="test-tamper-secret-1999",
        )

    def test_archive_node_and_lineage_trace(self):
        node = self.dag_store.commit(
            payload={"financial_asset": "Treasury Refinance Bond", "principal": 10000000},
            branch="trunk",
            author="Queen Elizabeth Vault Custodian",
            para_epoch="1999.OCT.28",
        )

        provenance_chain = [
            {"step": "debt_restructure_bench", "analyst": "Saturn_Ops"},
            {"step": "capital_recycling_loop", "allocation_id": "RECYCLE_009"},
        ]
        verification_check = {
            "verified": True,
            "method": "double_entry_balance",
            "verifier": "Auditor_Sentinel",
        }
        check_provenance = {
            "verifier_identity": "Auditor_Sentinel",
            "evidence_hash": "a1b2c3d4e5f6",
            "ruleset": "SOURCE_THE_CHECK_V1",
        }

        archive_res = self.synchronizer.archive_node(
            node_id=node.node_id,
            source_uri="tor://atlantis777chi777underground.onion/vault/asset/001",
            provenance_chain=provenance_chain,
            verification_check=verification_check,
            check_provenance=check_provenance,
            vault_epoch="QUEEN_ELIZABETH_INHERITANCE_EPOCH_1",
        )

        self.assertEqual(archive_res["status"], "archived")
        self.assertEqual(archive_res["node_id"], node.node_id)
        self.assertIsNotNone(archive_res["tamper_seal"])

        # Trace lineage
        trace = self.synchronizer.get_lineage_trace(node.node_id)
        self.assertIsNotNone(trace)
        self.assertEqual(trace["target_object_id"], node.node_id)
        self.assertEqual(trace["verification_check"]["verifier"], "Auditor_Sentinel")
        self.assertEqual(trace["check_provenance"]["ruleset"], "SOURCE_THE_CHECK_V1")

    def test_sync_branch_to_archive(self):
        node1 = self.dag_store.commit(payload={"step": 1}, branch="trunk")
        node2 = self.dag_store.commit(payload={"step": 2}, branch="trunk")
        node3 = self.dag_store.commit(payload={"step": 3}, branch="trunk")

        sync_res = self.synchronizer.sync_branch_to_archive(
            branch="trunk",
            source_uri="tor://atlantis777chi777underground.onion/branch/trunk",
        )

        self.assertEqual(sync_res["status"], "synchronized")
        self.assertEqual(sync_res["synced_count"], 3)

        # Re-running sync should sync 0 new items
        sync_res2 = self.synchronizer.sync_branch_to_archive(
            branch="trunk",
            source_uri="tor://atlantis777chi777underground.onion/branch/trunk",
        )
        self.assertEqual(sync_res2["synced_count"], 0)

    def test_restore_node_from_archive(self):
        node = self.dag_store.commit(
            payload={"secret_reserve": 5000000},
            branch="archive_source",
        )
        self.synchronizer.archive_node(
            node_id=node.node_id,
            source_uri="tor://atlantis777chi777underground.onion/reserve",
            provenance_chain=[{"step": "ledger_entry"}],
            verification_check={"verified": True},
            check_provenance={"verifier": "Test_Verifier"},
        )

        restored_node = self.synchronizer.restore_node_from_archive(node.node_id, target_branch="restored_branch")
        self.assertIsNotNone(restored_node)
        self.assertEqual(restored_node.payload["secret_reserve"], 5000000)
        self.assertEqual(restored_node.branch, "restored_branch")


if __name__ == "__main__":
    unittest.main()
