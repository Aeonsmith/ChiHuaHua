"""
Archive Storage Synchronizer
============================
Core data synchronization layer between the Archive Tier ("Queen Elizabeth's Inheritance" Vault /
Lineage Ledger) and the Storage Module (NVMe Working Cache & Indexed DAG Store).

Implements:
- Provable lineage tracing: object -> source -> provenance -> check -> source(check)
- Bidirectional batch and delta synchronization
- Cryptographic tamper seals and integrity verifications (HMAC / SHA-256)
- Vault archiving for long-term historical records and cold-tier retention
"""

import hashlib
import hmac
import json
import os
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple

from yggdrasil_dag import DAGNode, YggdrasilDAGStore


class LineageRecord:
    """
    Encapsulates the full lineage chain:
    object -> source -> provenance -> check -> source(check)
    """

    def __init__(
        self,
        target_object_id: str,
        source_uri: str,
        provenance_chain: List[Dict[str, Any]],
        verification_check: Dict[str, Any],
        check_provenance: Dict[str, Any],
        vault_epoch: str = "QUEEN_ELIZABETH_INHERITANCE_EPOCH_1",
        created_at: Optional[float] = None,
        lineage_id: Optional[str] = None,
    ):
        self.target_object_id = target_object_id
        self.source_uri = source_uri
        self.provenance_chain = provenance_chain
        self.verification_check = verification_check
        self.check_provenance = check_provenance
        self.vault_epoch = vault_epoch
        self.created_at = created_at or time.time()
        self.lineage_id = lineage_id or self.compute_lineage_hash()

    def compute_lineage_hash(self) -> str:
        canonical = {
            "target_object_id": self.target_object_id,
            "source_uri": self.source_uri,
            "provenance_chain": self.provenance_chain,
            "verification_check": self.verification_check,
            "check_provenance": self.check_provenance,
            "vault_epoch": self.vault_epoch,
            "created_at": round(self.created_at, 4),
        }
        serialized = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lineage_id": self.lineage_id,
            "target_object_id": self.target_object_id,
            "source_uri": self.source_uri,
            "provenance_chain": self.provenance_chain,
            "verification_check": self.verification_check,
            "check_provenance": self.check_provenance,
            "vault_epoch": self.vault_epoch,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LineageRecord":
        return cls(
            target_object_id=data["target_object_id"],
            source_uri=data["source_uri"],
            provenance_chain=data.get("provenance_chain", []),
            verification_check=data.get("verification_check", {}),
            check_provenance=data.get("check_provenance", {}),
            vault_epoch=data.get("vault_epoch", "QUEEN_ELIZABETH_INHERITANCE_EPOCH_1"),
            created_at=data.get("created_at"),
            lineage_id=data.get("lineage_id"),
        )


class ArchiveStorageSynchronizer:
    """
    Coordinates data sync between the working storage DAG and the archive vault.
    """

    def __init__(
        self,
        dag_store: YggdrasilDAGStore,
        vault_db_path: str = ":memory:",
        tamper_secret: str = "vault-tamper-seal-1999-inherit",
    ):
        self.dag_store = dag_store
        self.vault_db_path = vault_db_path
        if self.vault_db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:")
            self._mem_conn.row_factory = sqlite3.Row
        else:
            self._mem_conn = None
        self.tamper_secret = tamper_secret.encode("utf-8")
        self._init_vault()

    def _get_vault_conn(self) -> sqlite3.Connection:
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(self.vault_db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_vault(self):
        with self._get_vault_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS archive_vault (
                    archive_id TEXT PRIMARY KEY,
                    node_id TEXT NOT NULL,
                    vault_epoch TEXT NOT NULL,
                    lineage_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    tamper_seal TEXT NOT NULL,
                    archived_at REAL NOT NULL,
                    FOREIGN KEY (lineage_id) REFERENCES lineage_records(lineage_id)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS lineage_records (
                    lineage_id TEXT PRIMARY KEY,
                    target_object_id TEXT NOT NULL,
                    source_uri TEXT NOT NULL,
                    vault_epoch TEXT NOT NULL,
                    record_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_checkpoints (
                    sync_scope TEXT PRIMARY KEY,
                    last_synced_node_id TEXT NOT NULL,
                    last_synced_at REAL NOT NULL,
                    synced_count INTEGER NOT NULL
                )
            """)
            conn.commit()

    def generate_tamper_seal(self, archive_id: str, payload_json: str, lineage_id: str) -> str:
        body = f"{archive_id}:{lineage_id}:{payload_json}"
        return hmac.new(self.tamper_secret, body.encode("utf-8"), hashlib.sha256).hexdigest()

    def verify_tamper_seal(self, archive_id: str, payload_json: str, lineage_id: str, seal: str) -> bool:
        expected = self.generate_tamper_seal(archive_id, payload_json, lineage_id)
        return hmac.compare_digest(expected, seal)

    def archive_node(
        self,
        node_id: str,
        source_uri: str,
        provenance_chain: List[Dict[str, Any]],
        verification_check: Dict[str, Any],
        check_provenance: Dict[str, Any],
        vault_epoch: str = "QUEEN_ELIZABETH_INHERITANCE_EPOCH_1",
    ) -> Dict[str, Any]:
        """
        Transfers an active storage DAG node into the tamper-sealed archive vault with complete lineage.
        """
        node = self.dag_store.get_node(node_id)
        if not node:
            raise ValueError(f"Node {node_id} not found in working DAG storage.")

        lineage = LineageRecord(
            target_object_id=node.node_id,
            source_uri=source_uri,
            provenance_chain=provenance_chain,
            verification_check=verification_check,
            check_provenance=check_provenance,
            vault_epoch=vault_epoch,
        )

        archive_id = f"ARCHIVE_{node.node_id[:16]}_{int(time.time())}"
        payload_json = json.dumps(node.payload, sort_keys=True)
        seal = self.generate_tamper_seal(archive_id, payload_json, lineage.lineage_id)
        archived_at = time.time()

        with self._get_vault_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO lineage_records (lineage_id, target_object_id, source_uri, vault_epoch, record_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                lineage.lineage_id,
                lineage.target_object_id,
                lineage.source_uri,
                lineage.vault_epoch,
                json.dumps(lineage.to_dict()),
                lineage.created_at,
            ))

            cursor.execute("""
                INSERT OR REPLACE INTO archive_vault (archive_id, node_id, vault_epoch, lineage_id, payload_json, tamper_seal, archived_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                archive_id,
                node.node_id,
                vault_epoch,
                lineage.lineage_id,
                payload_json,
                seal,
                archived_at,
            ))
            conn.commit()

        return {
            "status": "archived",
            "archive_id": archive_id,
            "node_id": node.node_id,
            "lineage_id": lineage.lineage_id,
            "tamper_seal": seal,
            "vault_epoch": vault_epoch,
            "archived_at": archived_at,
        }

    def sync_branch_to_archive(
        self,
        branch: str,
        source_uri: str,
        verifier_identity: str = "Archive_Provenance_Sentinel",
    ) -> Dict[str, Any]:
        """
        Synchronizes all unarchived nodes along a branch ancestry chain into the Archive Vault.
        """
        head_id = self.dag_store.get_branch_head(branch)
        if not head_id:
            return {"status": "empty_branch", "branch": branch, "synced_nodes": 0}

        ancestry = self.dag_store.get_ancestry(head_id, limit=500)
        synced_records = []

        with self._get_vault_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT node_id FROM archive_vault")
            archived_node_ids = {row["node_id"] for row in cursor.fetchall()}

        for node in reversed(ancestry):
            if node.node_id in archived_node_ids:
                continue

            provenance_chain = [
                {"step": "dag_branch", "branch": node.branch},
                {"step": "author_signature", "author": node.author},
                {"step": "temporal_anchor", "para_epoch": node.para_epoch},
            ]
            verification_check = {
                "hash_valid": node.compute_hash() == node.node_id,
                "verified_by": verifier_identity,
                "verified_timestamp": time.time(),
            }
            check_provenance = {
                "verifier": verifier_identity,
                "algorithm": "SHA256_CANONICAL_DAG",
                "ruleset": "SOURCE_THE_CHECK_V1",
            }

            res = self.archive_node(
                node_id=node.node_id,
                source_uri=source_uri,
                provenance_chain=provenance_chain,
                verification_check=verification_check,
                check_provenance=check_provenance,
            )
            synced_records.append(res)

        # Update sync checkpoint
        if synced_records:
            with self._get_vault_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT OR REPLACE INTO sync_checkpoints (sync_scope, last_synced_node_id, last_synced_at, synced_count)
                    VALUES (?, ?, ?, ?)
                """, (branch, head_id, time.time(), len(synced_records)))
                conn.commit()

        return {
            "status": "synchronized",
            "branch": branch,
            "synced_count": len(synced_records),
            "head_node_id": head_id,
            "records": synced_records,
        }

    def restore_node_from_archive(self, node_id: str, target_branch: str = "trunk") -> Optional[DAGNode]:
        """
        Validates archive tamper seal, unpacks lineage, and restores node into active working DAG.
        """
        with self._get_vault_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT v.*, l.record_json 
                FROM archive_vault v
                JOIN lineage_records l ON v.lineage_id = l.lineage_id
                WHERE v.node_id = ?
            """, (node_id,))
            row = cursor.fetchone()
            if not row:
                return None

            # Verify tamper seal
            is_valid = self.verify_tamper_seal(
                archive_id=row["archive_id"],
                payload_json=row["payload_json"],
                lineage_id=row["lineage_id"],
                seal=row["tamper_seal"],
            )
            if not is_valid:
                raise ValueError(f"Tamper seal integrity failure for archived node {node_id}")

            payload = json.loads(row["payload_json"])
            lineage_data = json.loads(row["record_json"])
            para_epoch = lineage_data.get("vault_epoch", "QUEEN_ELIZABETH_INHERITANCE_EPOCH_1")

            # Ingest into DAG
            return self.dag_store.commit(
                payload=payload,
                branch=target_branch,
                author="Archive Vault Restore",
                para_epoch=para_epoch,
            )

    def get_lineage_trace(self, node_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves full provenance and lineage chain for an archived node.
        """
        with self._get_vault_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT l.record_json, v.archive_id, v.tamper_seal, v.archived_at
                FROM archive_vault v
                JOIN lineage_records l ON v.lineage_id = l.lineage_id
                WHERE v.node_id = ?
            """, (node_id,))
            row = cursor.fetchone()
            if not row:
                return None

            record = json.loads(row["record_json"])
            record["archive_id"] = row["archive_id"]
            record["tamper_seal"] = row["tamper_seal"]
            record["archived_at"] = row["archived_at"]
            return record
