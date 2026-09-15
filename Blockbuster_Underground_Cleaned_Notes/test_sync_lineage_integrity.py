"""
Comprehensive Unit Tests for Archive-Storage Synchronization & Lineage Integrity
================================================================================
Validates:
1. End-to-end lineage chain integrity: object -> source -> provenance -> check -> source(check)
2. Tamper seal detection and anti-tampering enforcement
3. Corrupted payload rejection during vault restoration
4. Multi-branch delta synchronization and checkpoint accuracy
5. Ancestry chain provenance retention across forks and merges
6. Non-existent node handling and edge-case boundary validation
"""

import json
import sqlite3
import time
import unittest
from typing import Any, Dict, List

from archive_sync import ArchiveStorageSynchronizer, LineageRecord
from yggdrasil_dag import DAGNode, YggdrasilDAGStore


class TestArchiveSyncLineageIntegrity(unittest.TestCase):
    def setUp(self):
        self.dag_store = YggdrasilDAGStore(":memory:")
        self.tamper_secret = "vault-tamper-secret-lineage-1999"
        self.synchronizer = ArchiveStorageSynchronizer(
            dag_store=self.dag_store,
            vault_db_path=":memory:",
            tamper_secret=self.tamper_secret,
        )

    def test_lineage_chain_full_structure(self):
        """
        Verify that LineageRecord captures and hashes the full sequence:
        object -> source -> provenance -> check -> source(check)
        """
        node = self.dag_store.commit(
            payload={"financial_loop": "Capital_Recycle_Alpha", "yield": 0.0815},
            branch="trunk",
            author="Saturn Custodian",
            para_epoch="1999.OCT.28",
        )

        provenance_chain = [
            {"hop": 1, "bay": "debt_restructure_bench", "analyst": "Saturn_Ops"},
            {"hop": 2, "bay": "capital_recycling_loop", "allocation_ref": "REC_9021"},
            {"hop": 3, "bay": "storage_fabric_nvme", "block_addr": "0x4FA3"},
        ]
        verification_check = {
            "verified": True,
            "hash_match": True,
            "algorithm": "SHA256",
            "verifier": "Lineage_Sentinel_01",
        }
        check_provenance = {
            "verifier_agent": "Lineage_Sentinel_01",
            "verifier_signature": "HMAC_SIG_SENTINEL_01",
            "evidence_chain": "evidence_block_999",
            "ruleset": "SOURCE_THE_CHECK_V1",
        }

        archived = self.synchronizer.archive_node(
            node_id=node.node_id,
            source_uri="tor://atlantis777chi777underground.onion/capital/recycle/01",
            provenance_chain=provenance_chain,
            verification_check=verification_check,
            check_provenance=check_provenance,
            vault_epoch="QUEEN_ELIZABETH_INHERITANCE_EPOCH_1",
        )

        self.assertEqual(archived["status"], "archived")
        self.assertEqual(archived["node_id"], node.node_id)
        self.assertTrue(archived["tamper_seal"])

        # Fetch and verify full lineage trace
        trace = self.synchronizer.get_lineage_trace(node.node_id)
        self.assertIsNotNone(trace)
        self.assertEqual(trace["target_object_id"], node.node_id)
        self.assertEqual(trace["source_uri"], "tor://atlantis777chi777underground.onion/capital/recycle/01")
        self.assertEqual(len(trace["provenance_chain"]), 3)
        self.assertEqual(trace["provenance_chain"][0]["bay"], "debt_restructure_bench")
        self.assertEqual(trace["verification_check"]["verifier"], "Lineage_Sentinel_01")
        self.assertEqual(trace["check_provenance"]["ruleset"], "SOURCE_THE_CHECK_V1")
        self.assertEqual(trace["check_provenance"]["verifier_agent"], "Lineage_Sentinel_01")

    def test_tamper_detection_on_vault_tampering(self):
        """
        Verify that modifying archived payloads in the database triggers a tamper seal failure.
        """
        node = self.dag_store.commit(
            payload={"balance": 1000000},
            branch="trunk",
            author="Vault Master",
        )
        self.synchronizer.archive_node(
            node_id=node.node_id,
            source_uri="tor://atlantis777chi777underground.onion/vault/balance",
            provenance_chain=[{"action": "initial_deposit"}],
            verification_check={"valid": True},
            check_provenance={"verifier": "Auditor"},
        )

        # Directly tamper with payload in the vault database
        with self.synchronizer._get_vault_conn() as conn:
            cursor = conn.cursor()
            tampered_payload = json.dumps({"balance": 999999999}, sort_keys=True)
            cursor.execute(
                "UPDATE archive_vault SET payload_json = ? WHERE node_id = ?",
                (tampered_payload, node.node_id),
            )
            conn.commit()

        # Restoring tampered node must fail with integrity failure
        with self.assertRaises(ValueError) as ctx:
            self.synchronizer.restore_node_from_archive(node.node_id, target_branch="restored")
        self.assertIn("Tamper seal integrity failure", str(ctx.exception))

    def test_lineage_hash_determinism(self):
        """
        Verify LineageRecord hash is strictly deterministic based on canonical serialization.
        """
        record1 = LineageRecord(
            target_object_id="node_abc",
            source_uri="tor://onion/resource",
            provenance_chain=[{"step": 1}, {"step": 2}],
            verification_check={"ok": True},
            check_provenance={"verifier": "agent_x"},
            created_at=1000000.0,
        )
        record2 = LineageRecord(
            target_object_id="node_abc",
            source_uri="tor://onion/resource",
            provenance_chain=[{"step": 1}, {"step": 2}],
            verification_check={"ok": True},
            check_provenance={"verifier": "agent_x"},
            created_at=1000000.0,
        )
        self.assertEqual(record1.lineage_id, record2.lineage_id)

    def test_delta_sync_across_forks_and_ancestry(self):
        """
        Verify that synchronizing a forked branch archives the full ancestral lineage.
        """
        # Create trunk history
        root = self.dag_store.commit(payload={"version": "1.0"}, branch="trunk")
        trunk1 = self.dag_store.commit(payload={"version": "1.1"}, branch="trunk")

        # Fork to recovery branch
        self.dag_store.fork_branch("trunk", "recovery_bay")
        rec1 = self.dag_store.commit(payload={"action": "restructure_loan"}, branch="recovery_bay")
        rec2 = self.dag_store.commit(payload={"action": "redeploy_capital"}, branch="recovery_bay")

        sync_result = self.synchronizer.sync_branch_to_archive(
            branch="recovery_bay",
            source_uri="tor://atlantis777chi777underground.onion/recovery_bay",
        )

        self.assertEqual(sync_result["status"], "synchronized")
        # Should have synced root, trunk1, rec1, rec2
        self.assertEqual(sync_result["synced_count"], 4)

        # Verify lineage traces for root and leaf in vault
        root_trace = self.synchronizer.get_lineage_trace(root.node_id)
        leaf_trace = self.synchronizer.get_lineage_trace(rec2.node_id)

        self.assertIsNotNone(root_trace)
        self.assertIsNotNone(leaf_trace)
        self.assertEqual(root_trace["target_object_id"], root.node_id)
        self.assertEqual(leaf_trace["target_object_id"], rec2.node_id)

    def test_archive_nonexistent_node_raises_error(self):
        """
        Verify archiving a non-existent node ID raises a ValueError.
        """
        with self.assertRaises(ValueError) as ctx:
            self.synchronizer.archive_node(
                node_id="non_existent_node_id_999",
                source_uri="tor://invalid",
                provenance_chain=[],
                verification_check={},
                check_provenance={},
            )
        self.assertIn("not found in working DAG storage", str(ctx.exception))

    def test_restore_nonexistent_node_returns_none(self):
        """
        Verify restoring a node not present in vault returns None.
        """
        result = self.synchronizer.restore_node_from_archive("missing_node_id")
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
