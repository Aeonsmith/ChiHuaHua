"""
Atlantis Ingress Gateway
========================
Zero-trust boundary enforcement layer and Tor Onion Service v3 abstraction.
Manages network obfuscation, SOCKS5 proxy routing, cryptographic authentication,
and secure ingestion of payloads into the Yggdrasil DAG State Store.
"""

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, List, Optional, Tuple

from yggdrasil_dag import DAGNode, YggdrasilDAGStore


class AtlantisAuthError(Exception):
    """Raised when ingress boundary authentication fails."""
    pass


class AtlantisGateway:
    """
    Atlantis Ingress Gateway acting as the boundary controller for Tor network ingress,
    cryptographic verification, and DAG synchronization.
    """

    def __init__(
        self,
        dag_store: YggdrasilDAGStore,
        boundary_secret_key: str = "saturn-blackbox-boundary-key-1999",
        onion_address: str = "atlantis777chi777underground.onion",
        socks5_proxy: str = "127.0.0.1:9050",
    ):
        self.dag_store = dag_store
        self.boundary_secret_key = boundary_secret_key.encode("utf-8")
        self.onion_address = onion_address
        self.socks5_proxy = socks5_proxy
        self.authorized_keys: Dict[str, str] = {}  # key_id -> public_identity
        self.rate_limit_table: Dict[str, List[float]] = {}  # key_id -> [timestamps]

    def register_authorized_entity(self, key_id: str, identity_name: str):
        """
        Registers an authorized persona / agent for boundary crossing.
        """
        self.authorized_keys[key_id] = identity_name

    def generate_ingress_token(self, key_id: str, para_epoch: str = "1999.OCT.28") -> str:
        """
        Generates an HMAC-SHA256 authenticated boundary crossing token.
        """
        timestamp = int(time.time())
        payload = f"{key_id}:{self.onion_address}:{para_epoch}:{timestamp}"
        signature = hmac.new(
            self.boundary_secret_key,
            payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        token_data = f"{payload}:{signature}"
        return base64.urlsafe_b64encode(token_data.encode("utf-8")).decode("utf-8")

    def verify_ingress_token(self, token_str: str, max_age_seconds: int = 300) -> Tuple[str, str]:
        """
        Verifies the boundary crossing token and returns (key_id, para_epoch).
        """
        try:
            decoded = base64.urlsafe_b64decode(token_str.encode("utf-8")).decode("utf-8")
            parts = decoded.split(":")
            if len(parts) != 5:
                raise AtlantisAuthError("Malformed boundary token structure.")

            key_id, onion_addr, para_epoch, timestamp_str, received_sig = parts
            timestamp = int(timestamp_str)

            # Check onion address matches gateway boundary
            if onion_addr != self.onion_address:
                raise AtlantisAuthError(f"Target onion mismatch: {onion_addr} != {self.onion_address}")

            # Check expiration
            if abs(time.time() - timestamp) > max_age_seconds:
                raise AtlantisAuthError("Boundary token has expired.")

            # Check key authorization
            if key_id not in self.authorized_keys:
                raise AtlantisAuthError(f"Unauthorized key ID: {key_id}")

            # Verify HMAC signature
            payload = f"{key_id}:{onion_addr}:{para_epoch}:{timestamp_str}"
            expected_sig = hmac.new(
                self.boundary_secret_key,
                payload.encode("utf-8"),
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(expected_sig, received_sig):
                raise AtlantisAuthError("Cryptographic signature mismatch.")

            return key_id, para_epoch

        except Exception as e:
            if isinstance(e, AtlantisAuthError):
                raise
            raise AtlantisAuthError(f"Token validation error: {str(e)}")

    def _check_rate_limit(self, key_id: str, max_requests: int = 60, window_seconds: int = 60):
        now = time.time()
        timestamps = self.rate_limit_table.setdefault(key_id, [])
        # Filter timestamps within active window
        valid_timestamps = [t for t in timestamps if now - t < window_seconds]
        if len(valid_timestamps) >= max_requests:
            raise AtlantisAuthError("Rate limit exceeded at Atlantis boundary.")
        valid_timestamps.append(now)
        self.rate_limit_table[key_id] = valid_timestamps

    def handle_ingress_commit(
        self,
        token: str,
        payload: Dict[str, Any],
        branch: str = "trunk",
        parents: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Handles an authenticated inbound commit packet through the Tor/Atlantis boundary.
        """
        key_id, para_epoch = self.verify_ingress_token(token)
        self._check_rate_limit(key_id)

        author_name = self.authorized_keys.get(key_id, "Unknown Persona")

        # Ingest directly into the Yggdrasil DAG State Store
        node = self.dag_store.commit(
            payload=payload,
            branch=branch,
            author=author_name,
            para_epoch=para_epoch,
            parents=parents,
        )

        return {
            "status": "boundary_crossed",
            "node_id": node.node_id,
            "branch": node.branch,
            "author": node.author,
            "para_epoch": node.para_epoch,
            "sys_recorded_at": node.sys_recorded_at,
            "onion_ingress": self.onion_address,
        }

    def handle_ingress_query(
        self,
        token: str,
        node_id: Optional[str] = None,
        branch: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Handles an authenticated query packet across the boundary.
        """
        key_id, _ = self.verify_ingress_token(token)
        self._check_rate_limit(key_id)

        if node_id:
            node = self.dag_store.get_node(node_id)
            if not node:
                return {"status": "not_found", "node_id": node_id}
            return {"status": "success", "node": node.to_dict()}

        if branch:
            head_id = self.dag_store.get_branch_head(branch)
            if not head_id:
                return {"status": "branch_not_found", "branch": branch}
            history = self.dag_store.get_ancestry(head_id, limit=20)
            return {
                "status": "success",
                "branch": branch,
                "head": head_id,
                "history": [n.to_dict() for n in history],
            }

        return {"status": "error", "message": "Specify node_id or branch."}
