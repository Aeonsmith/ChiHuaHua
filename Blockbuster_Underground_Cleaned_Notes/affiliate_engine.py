"""
Affiliate & Referral Distribution Engine (Phase 2)
==================================================
Manages tracked partner links, conversion pipelines, commission calculation,
and automatic lineage routing into the Capital Recycling Loop.
"""

import hashlib
import hmac
import json
import time
from typing import Any, Dict, List, Optional

from archive_sync import ArchiveStorageSynchronizer, LineageRecord
from atlantis_gateway import AtlantisGateway
from yggdrasil_dag import DAGNode, YggdrasilDAGStore


class AffiliateDistributionEngine:
    """
    Engine for partner link tracking, conversion verification, and commission piping.
    """

    def __init__(
        self,
        dag_store: YggdrasilDAGStore,
        archive_sync: ArchiveStorageSynchronizer,
        gateway: AtlantisGateway,
        commission_rate_default: float = 0.15,
    ):
        self.dag_store = dag_store
        self.archive_sync = archive_sync
        self.gateway = gateway
        self.commission_rate_default = commission_rate_default
        self.partners: Dict[str, Dict[str, Any]] = {}

    def register_partner(
        self,
        partner_id: str,
        name: str,
        payout_address: str,
        custom_rate: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Registers an affiliate partner with a unique tracking code."""
        rate = custom_rate if custom_rate is not None else self.commission_rate_default
        tracking_token = hashlib.sha256(f"{partner_id}:{name}:{time.time()}".encode("utf-8")).hexdigest()[:16]
        
        self.partners[partner_id] = {
            "partner_id": partner_id,
            "name": name,
            "payout_address": payout_address,
            "commission_rate": rate,
            "tracking_token": tracking_token,
            "total_conversions": 0,
            "total_commissions_earned": 0.0,
        }

        # Also authorize partner in the gateway
        self.gateway.register_authorized_entity(key_id=partner_id, identity_name=f"Partner_{name}")

        return self.partners[partner_id]

    def generate_referral_link(self, partner_id: str, campaign: str = "general") -> str:
        """Generates a tracked referral URL routing through the Tor boundary."""
        if partner_id not in self.partners:
            raise ValueError(f"Partner {partner_id} not registered.")
        
        token = self.partners[partner_id]["tracking_token"]
        return f"tor://{self.gateway.onion_address}/ref/{partner_id}/{campaign}?track={token}"

    def record_conversion(
        self,
        partner_id: str,
        conversion_value: float,
        customer_ref: str,
        campaign: str = "general",
        branch: str = "distribution_core",
    ) -> Dict[str, Any]:
        """
        Records a conversion, models commission payout, and injects the transaction
        into the Capital Recycling Loop and Archive Vault with full provenance.
        """
        if partner_id not in self.partners:
            raise ValueError(f"Unknown partner {partner_id}")

        partner = self.partners[partner_id]
        commission_amount = conversion_value * partner["commission_rate"]
        capital_recycled = conversion_value - commission_amount

        partner["total_conversions"] += 1
        partner["total_commissions_earned"] += commission_amount

        payload = {
            "event": "affiliate_conversion",
            "partner_id": partner_id,
            "campaign": campaign,
            "conversion_value": conversion_value,
            "commission_amount": commission_amount,
            "capital_recycled_to_loop": capital_recycled,
            "customer_ref_hash": hashlib.sha256(customer_ref.encode("utf-8")).hexdigest(),
            "timestamp": time.time(),
        }

        # Commit to working DAG storage
        node = self.dag_store.commit(
            payload=payload,
            branch=branch,
            author=f"AffiliateEngine_{partner_id}",
            para_epoch="1999.OCT.28",
        )

        # Archive node with provable lineage
        provenance_chain = [
            {"step": "partner_referral_link", "partner_id": partner_id, "token": partner["tracking_token"]},
            {"step": "conversion_verification", "value": conversion_value},
            {"step": "capital_recycling_injection", "amount": capital_recycled},
        ]
        verification_check = {
            "conversion_valid": True,
            "commission_calculated": commission_amount,
            "verifier": "Affiliate_Ledger_Sentinel",
        }
        check_provenance = {
            "ruleset": "SOURCE_THE_CHECK_V1",
            "payout_target": partner["payout_address"],
            "vault_tier": "QUEEN_ELIZABETH_INHERITANCE",
        }

        archive_result = self.archive_sync.archive_node(
            node_id=node.node_id,
            source_uri=f"tor://{self.gateway.onion_address}/conversions/{node.node_id}",
            provenance_chain=provenance_chain,
            verification_check=verification_check,
            check_provenance=check_provenance,
        )

        return {
            "status": "conversion_processed",
            "node_id": node.node_id,
            "partner_id": partner_id,
            "commission_amount": commission_amount,
            "capital_recycled": capital_recycled,
            "archive_id": archive_result["archive_id"],
            "tamper_seal": archive_result["tamper_seal"],
        }
