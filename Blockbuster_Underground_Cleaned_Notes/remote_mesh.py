"""
Multi-Device Remote Control Plane & RPC Interface (Phase 3)
===========================================================
Connects remote controller endpoints (iPhone, Galaxy, secondary workstations)
to the core compute node over authenticated Tor / SOCKS5 sessions.
"""

import json
import time
from typing import Any, Dict, List, Optional

from atlantis_gateway import AtlantisAuthError, AtlantisGateway
from control_plane import SystemControlPlane


class MultiDeviceRemoteMesh:
    """
    Manages multi-device controller pairing, command dispatch, and dashboard telemetry.
    """

    def __init__(self, control_plane: SystemControlPlane):
        self.control_plane = control_plane
        self.paired_devices: Dict[str, Dict[str, Any]] = {}
        self.command_audit_log: List[Dict[str, Any]] = []

    def pair_device(
        self,
        device_id: str,
        device_name: str,
        device_type: str,  # 'iPhone', 'Galaxy', 'Workstation', etc.
        operator_key_id: str,
    ) -> Dict[str, Any]:
        """Pairs a new remote control endpoint to the control plane."""
        self.paired_devices[device_id] = {
            "device_id": device_id,
            "device_name": device_name,
            "device_type": device_type,
            "operator_key_id": operator_key_id,
            "paired_at": time.time(),
            "last_active": time.time(),
            "status": "online",
        }
        return self.paired_devices[device_id]

    def dispatch_remote_command(
        self,
        device_id: str,
        token: str,
        action: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Executes a remote RPC command dispatched from a paired controller.
        Actions supported:
        - 'status_summary': Returns real-time system gauges
        - 'financial_loop': Ingests financial recovery / capital recycling loop
        - 'sync_branch': Triggers delta archive synchronization
        - 'audit_lineage': Returns provable lineage trace
        """
        if device_id not in self.paired_devices:
            raise AtlantisAuthError(f"Device {device_id} is not paired.")

        device = self.paired_devices[device_id]
        key_id, _ = self.control_plane.gateway.verify_ingress_token(token)
        if key_id != device["operator_key_id"]:
            raise AtlantisAuthError("Operator token does not match paired device authorization.")

        device["last_active"] = time.time()
        result: Dict[str, Any] = {}

        if action == "status_summary":
            result = self.control_plane.status_summary()
            result["paired_devices"] = len(self.paired_devices)

        elif action == "financial_loop":
            result = self.control_plane.execute_financial_loop(
                token=token,
                loop_name=payload.get("loop_name", "REMOTE_DISPATCH_LOOP"),
                transaction_data=payload.get("data", {}),
                branch=payload.get("branch", "trunk"),
            )

        elif action == "sync_branch":
            result = self.control_plane.sync_branch(branch=payload.get("branch", "trunk"))

        elif action == "audit_lineage":
            result = self.control_plane.audit_node_lineage(node_id=payload.get("node_id", ""))

        else:
            raise ValueError(f"Unknown remote action: {action}")

        # Record command in audit log
        self.command_audit_log.append({
            "device_id": device_id,
            "action": action,
            "timestamp": time.time(),
            "status": "executed",
        })

        return {
            "status": "success",
            "device_id": device_id,
            "action": action,
            "result": result,
        }

    def get_dashboard_telemetry(self) -> Dict[str, Any]:
        """Returns consolidated garage dashboard telemetry."""
        summary = self.control_plane.status_summary()
        summary["devices"] = list(self.paired_devices.values())
        summary["recent_commands_count"] = len(self.command_audit_log)
        return summary
