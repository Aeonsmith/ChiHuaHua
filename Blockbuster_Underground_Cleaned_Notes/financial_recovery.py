"""
Financial Recovery, NAV Optimization & Vault Compaction (Phase 4)
=================================================================
Implements the Debt Restructuring Bench, Dynamic Net Asset Value (NAV)
Valuation, Capital Recycling Optimizer, and Vault Tier Compaction.
"""

import json
import time
from typing import Any, Dict, List, Optional, Tuple

from archive_sync import ArchiveStorageSynchronizer, LineageRecord
from yggdrasil_dag import DAGNode, YggdrasilDAGStore


class FinancialRecoveryAndNAVEngine:
    """
    Manages debt restructuring simulations, asset allocation swaps, and NAV evaluations.
    """

    def __init__(
        self,
        dag_store: YggdrasilDAGStore,
        archive_sync: ArchiveStorageSynchronizer,
    ):
        self.dag_store = dag_store
        self.archive_sync = archive_sync
        self.holdings: Dict[str, Dict[str, Any]] = {}
        self.liabilities: Dict[str, Dict[str, Any]] = {}

    def register_asset(self, asset_id: str, name: str, quantity: float, unit_price: float, asset_type: str):
        """Registers or updates a portfolio asset."""
        self.holdings[asset_id] = {
            "asset_id": asset_id,
            "name": name,
            "quantity": quantity,
            "unit_price": unit_price,
            "market_value": quantity * unit_price,
            "asset_type": asset_type,
            "updated_at": time.time(),
        }

    def register_liability(self, liability_id: str, name: str, principal: float, interest_rate: float, term_months: int):
        """Registers a liability or debt instrument on the restructuring bench."""
        self.liabilities[liability_id] = {
            "liability_id": liability_id,
            "name": name,
            "principal": principal,
            "interest_rate": interest_rate,
            "term_months": term_months,
            "status": "active",
            "updated_at": time.time(),
        }

    def compute_nav(self) -> Dict[str, Any]:
        """Calculates total assets, total liabilities, and Net Asset Value (NAV)."""
        total_assets = sum(h["quantity"] * h["unit_price"] for h in self.holdings.values())
        total_liabilities = sum(l["principal"] for l in self.liabilities.values() if l["status"] in ("active", "restructured"))
        nav = total_assets - total_liabilities

        return {
            "total_assets": round(total_assets, 2),
            "total_liabilities": round(total_liabilities, 2),
            "nav": round(nav, 2),
            "assets_count": len(self.holdings),
            "liabilities_count": len(self.liabilities),
            "timestamp": time.time(),
        }

    def simulate_debt_restructure(
        self,
        liability_id: str,
        new_interest_rate: float,
        new_term_months: int,
        consolidation_subsidy: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Simulates debt refinance and restructuring on the bench.
        Calculates savings and recycled capital gain.
        """
        if liability_id not in self.liabilities:
            raise ValueError(f"Liability {liability_id} not found.")

        current = self.liabilities[liability_id]
        orig_principal = current["principal"]
        orig_rate = current["interest_rate"]
        orig_term = current["term_months"]

        # Simple annualized interest approximation
        orig_total_cost = orig_principal * (1 + orig_rate * (orig_term / 12.0))
        new_principal = orig_principal - consolidation_subsidy
        new_total_cost = new_principal * (1 + new_interest_rate * (new_term_months / 12.0))
        recycled_savings = orig_total_cost - new_total_cost

        return {
            "liability_id": liability_id,
            "orig_total_cost": round(orig_total_cost, 2),
            "new_total_cost": round(new_total_cost, 2),
            "projected_savings": round(recycled_savings, 2),
            "effective_subsidy": consolidation_subsidy,
            "feasible": recycled_savings > 0,
        }

    def execute_restructure_commit(
        self,
        liability_id: str,
        new_interest_rate: float,
        new_term_months: int,
        consolidation_subsidy: float = 0.0,
        operator_key: str = "saturn_ops",
        branch: str = "finance_recovery",
    ) -> Dict[str, Any]:
        """
        Applies restructure to the ledger, commits to DAG, and seals into the Archive Vault.
        """
        sim = self.simulate_debt_restructure(
            liability_id=liability_id,
            new_interest_rate=new_interest_rate,
            new_term_months=new_term_months,
            consolidation_subsidy=consolidation_subsidy,
        )

        # Apply updates
        liability = self.liabilities[liability_id]
        liability["principal"] = liability["principal"] - consolidation_subsidy
        liability["interest_rate"] = new_interest_rate
        liability["term_months"] = new_term_months
        liability["status"] = "restructured"
        liability["updated_at"] = time.time()

        nav_state = self.compute_nav()

        payload = {
            "event": "debt_restructure_executed",
            "restructure_model": sim,
            "nav_post_execution": nav_state,
            "operator": operator_key,
        }

        # Step 1: Commit to working DAG
        node = self.dag_store.commit(
            payload=payload,
            branch=branch,
            author=f"RestructureBench_{operator_key}",
            para_epoch="1999.OCT.28",
        )

        # Step 2: Seal in Queen Elizabeth's Inheritance Vault
        provenance_chain = [
            {"step": "debt_restructure_bench", "liability_id": liability_id},
            {"step": "nav_recalculation", "nav": nav_state["nav"]},
            {"step": "capital_recycling_allocation", "savings": sim["projected_savings"]},
        ]
        verification_check = {
            "restructure_valid": sim["feasible"],
            "verifier": "Recovery_Bench_Sentinel",
        }
        check_provenance = {
            "ruleset": "SOURCE_THE_CHECK_V1",
            "vault_tier": "QUEEN_ELIZABETH_INHERITANCE",
            "epoch": "1999.OCT.28",
        }

        archive_result = self.archive_sync.archive_node(
            node_id=node.node_id,
            source_uri=f"tor://atlantis777chi777underground.onion/recovery/{liability_id}/{node.node_id}",
            provenance_chain=provenance_chain,
            verification_check=verification_check,
            check_provenance=check_provenance,
        )

        return {
            "status": "restructure_committed",
            "node_id": node.node_id,
            "liability_id": liability_id,
            "nav_snapshot": nav_state,
            "archive_id": archive_result["archive_id"],
            "tamper_seal": archive_result["tamper_seal"],
        }
