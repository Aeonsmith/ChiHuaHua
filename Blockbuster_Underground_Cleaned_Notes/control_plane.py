"""
System Control Plane - Blockbuster Underground / Project 35
============================================================
Unified orchestrator integrating:
1. Atlantis Ingress Gateway (Tor Onion v3 boundary & Zero-Trust Authentication)
2. Yggdrasil DAG State Store (Content-Addressed Dual-Timestamped State Engine)
3. Storage Fabric (Working NVMe Cache & Branch Manager)
4. Archive Vault Tier ("Queen Elizabeth's Inheritance" Lineage Ledger & Tamper Sealing)
5. Capital Recycling & Debt Restructuring Lineage Pipeline
"""

import json
import os
import time
from typing import Any, Dict, List, Optional

from archive_sync import ArchiveStorageSynchronizer, LineageRecord
from atlantis_gateway import AtlantisAuthError, AtlantisGateway
from yggdrasil_dag import DAGNode, YggdrasilDAGStore


class SystemControlPlane:
    """
    Main entry point and orchestration engine for the ChiHuaHua system.
    """

    def __init__(
        self,
        storage_db_path: str = "storage_dag.db",
        archive_vault_db_path: str = "archive_vault.db",
        boundary_secret_key: str = "saturn-blackbox-boundary-key-1999",
        tamper_secret: str = "vault-tamper-seal-1999-inherit",
        onion_address: str = "atlantis777chi777underground.onion",
        socks5_proxy: str = "127.0.0.1:9050",
    ):
        self.storage_db_path = storage_db_path
        self.archive_vault_db_path = archive_vault_db_path

        # 1. Initialize Working Storage (Yggdrasil DAG)
        self.dag_store = YggdrasilDAGStore(db_path=self.storage_db_path)

        # 2. Initialize Ingress Gateway (Atlantis Tor boundary)
        self.gateway = AtlantisGateway(
            dag_store=self.dag_store,
            boundary_secret_key=boundary_secret_key,
            onion_address=onion_address,
            socks5_proxy=socks5_proxy,
        )

        # 3. Initialize Archive Sync Layer (Queen Elizabeth's Inheritance Vault)
        self.synchronizer = ArchiveStorageSynchronizer(
            dag_store=self.dag_store,
            vault_db_path=self.archive_vault_db_path,
            tamper_secret=tamper_secret,
        )

    def register_operator(self, key_id: str, identity_name: str):
        """Registers an authorized agent/operator with the gateway."""
        self.gateway.register_authorized_entity(key_id=key_id, identity_name=identity_name)

    def generate_token(self, key_id: str, para_epoch: str = "1999.OCT.28") -> str:
        """Generates an authenticated boundary crossing token."""
        return self.gateway.generate_ingress_token(key_id=key_id, para_epoch=para_epoch)

    def execute_financial_loop(
        self,
        token: str,
        loop_name: str,
        transaction_data: Dict[str, Any],
        branch: str = "trunk",
        auto_archive: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes a financial/recovery loop:
        1. Validates Tor boundary token
        2. Commits payload to working DAG storage
        3. Automatically preserves full lineage in Queen Elizabeth's Inheritance vault
        """
        key_id, para_epoch = self.gateway.verify_ingress_token(token)
        author = self.gateway.authorized_keys.get(key_id, "Unknown Operator")

        payload = {
            "loop_type": loop_name,
            "data": transaction_data,
            "recorded_by": author,
            "timestamp": time.time(),
        }

        # Step 1: Ingest into working DAG
        node = self.dag_store.commit(
            payload=payload,
            branch=branch,
            author=author,
            para_epoch=para_epoch,
        )

        archive_result = None
        if auto_archive:
            provenance_chain = [
                {"step": "ingress_gateway", "onion": self.gateway.onion_address},
                {"step": "working_dag_commit", "node_id": node.node_id, "branch": branch},
                {"step": "financial_loop_bay", "loop": loop_name},
            ]
            verification_check = {
                "hash_valid": node.compute_hash() == node.node_id,
                "verified_by": f"ControlPlane_Sentinel_{key_id}",
                "timestamp": time.time(),
            }
            check_provenance = {
                "verifier_key": key_id,
                "ruleset": "SOURCE_THE_CHECK_V1",
                "vault_tier": "QUEEN_ELIZABETH_INHERITANCE",
            }

            archive_result = self.synchronizer.archive_node(
                node_id=node.node_id,
                source_uri=f"tor://{self.gateway.onion_address}/loop/{loop_name}/{node.node_id}",
                provenance_chain=provenance_chain,
                verification_check=verification_check,
                check_provenance=check_provenance,
            )

        return {
            "status": "success",
            "node_id": node.node_id,
            "branch": branch,
            "author": author,
            "archive_result": archive_result,
        }

    def sync_branch(self, branch: str = "trunk") -> Dict[str, Any]:
        """Synchronizes all branch history into the vault."""
        return self.synchronizer.sync_branch_to_archive(
            branch=branch,
            source_uri=f"tor://{self.gateway.onion_address}/branches/{branch}",
        )

    def audit_node_lineage(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Audits complete lineage and tamper seal for a specific node."""
        return self.synchronizer.get_lineage_trace(node_id)

    def status_summary(self) -> Dict[str, Any]:
        """Returns real-time status of all active control plane modules."""
        branches = self.dag_store.list_branches()
        return {
            "gateway": {
                "onion_address": self.gateway.onion_address,
                "authorized_operators_count": len(self.gateway.authorized_keys),
            },
            "storage_dag": {
                "active_branches": list(branches.keys()),
                "total_branches": len(branches),
            },
            "archive_vault": {
                "tier": "QUEEN_ELIZABETH_INHERITANCE",
                "status": "online",
            },
        }
