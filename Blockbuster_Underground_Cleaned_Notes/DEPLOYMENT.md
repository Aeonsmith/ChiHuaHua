# Blockbuster Underground / ChiHuaHua System Control Plane Deployment

## 1. System Overview & Architecture

The **ChiHuaHua System Control Plane** integrates the five foundational garage tiers into a unified operational pipeline:

```text
                                INGRESS / PERIMETER
                         [ Atlantis Gateway (Tor v3 Onion) ]
                                         │
                                         ▼
                                SYSTEM CONTROL PLANE
                        (Token Auth, Rate Limit, Dispatcher)
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
  FINANCIAL & RECOVERY            STORAGE MODULE                   ARCHIVE VAULT TIER
        │                                │                                │
 Debt restructuring bench        Yggdrasil DAG State Store        "Queen Elizabeth's Inheritance"
 Capital recycling loop          Content-Addressed Nodes          Tamper-Sealed Vault (HMAC-SHA256)
 Payout & commission loops       Multi-Branching & History        Lineage Ledger ("Source the Check")
```

---

## 2. Directory & Module Structure

```text
Blockbuster_Underground_Cleaned_Notes/
├── atlantis_gateway.py        # Tor Onion v3 Ingress Boundary & HMAC Auth
├── yggdrasil_dag.py           # Content-Addressed Directed Acyclic Graph (DAG)
├── archive_sync.py            # Lineage Record Engine & Vault Sync
├── control_plane.py           # Unified System Control Plane
├── test_core_modules.py       # Gateway & DAG test suite
├── test_archive_sync.py       # Basic archive sync tests
├── test_sync_lineage_integrity.py  # Comprehensive lineage & tamper tests
└── test_control_plane.py      # Control plane integration tests
```

---

## 3. Configuration Parameters

| Parameter | Environment / Setting | Default Value | Description |
|---|---|---|---|
| `storage_db_path` | `STORAGE_DB` | `storage_dag.db` | Working SQLite storage for Yggdrasil DAG nodes. |
| `archive_vault_db_path` | `VAULT_DB` | `archive_vault.db` | High-durability archive storage ("Queen Elizabeth's Inheritance"). |
| `boundary_secret_key` | `BOUNDARY_KEY` | `saturn-blackbox-boundary-key-1999` | Secret for HMAC token issuance at the perimeter. |
| `tamper_secret` | `TAMPER_SECRET` | `vault-tamper-seal-1999-inherit` | Secret key for vault cryptographic tamper seals. |
| `onion_address` | `TOR_ONION_ADDR` | `atlantis777chi777underground.onion` | Virtual Tor v3 Onion address for boundary validation. |
| `socks5_proxy` | `TOR_SOCKS5` | `127.0.0.1:9050` | SOCKS5 proxy endpoint for Tor routing. |

---

## 4. Deployment Instructions

### Prerequisites
- Python 3.10+ (Standard library `sqlite3`, `hashlib`, `hmac`, `json`, `base64`, `time`).
- (Optional) Running Tor daemon with SOCKS5 on `127.0.0.1:9050`.

### Step 1: Initialize Control Plane
```python
from control_plane import SystemControlPlane

cp = SystemControlPlane(
    storage_db_path="storage_dag.db",
    archive_vault_db_path="archive_vault.db",
    boundary_secret_key="<PRODUCTION_SECRET_KEY>",
    tamper_secret="<PRODUCTION_TAMPER_KEY>",
    onion_address="atlantis777chi777underground.onion",
)
```

### Step 2: Register Authorized Operators
```python
cp.register_operator(key_id="saturn_ops_01", identity_name="Lead Financial Architect")
```

### Step 3: Execute Pipelines with Automatic Lineage Archiving
```python
token = cp.generate_token(key_id="saturn_ops_01", para_epoch="1999.OCT.28")

result = cp.execute_financial_loop(
    token=token,
    loop_name="CAPITAL_RECYCLING_RUN",
    transaction_data={"allocation": "Shorts Adapter Index", "amount": 1500000},
    branch="trunk",
    auto_archive=True,
)
```

### Step 4: Audit & Lineage Trace
```python
trace = cp.audit_node_lineage(result["node_id"])
print("Lineage Trace:", trace["check_provenance"])
```

---

## 5. Verification & Test Execution

Run the full automated test suite to ensure system integrity:

```powershell
python -m unittest discover -s C:\Users\ole_a\Blockbuster_Underground_Cleaned_Notes -p "test_*.py"
```
