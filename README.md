# ChiHuaHua
Pay my Price

## NAV System (Net Asset Value & Spatial-Temporal Engine)

The NAV system provides real-time spatial-temporal tracking, recursive distressed asset packaging, dynamic haircut debt-cleansing swaps, and continuous Net Asset Value (NAV) accounting.

### Core Architecture

- **`NavClockGPS`**: High-precision positioning and temporal clock driving coordinate vectors (`lat`, `lon`, `altitude_m`), epoch timestamps, and quantum ticks.
- **`PlasmaPackage`**: Interlocking recursive collateral containers capable of nesting tranches to arbitrary depths. Evaluates aggregate nominal debt, clean liquidation value, and weighted mean toxicity.
- **`EternalRecyclingSink`**: Immutable settlement sink that absorbs distressed/toxic debt packages, burns their nominal value to an audit log, and exchanges them for sanitized prime units subject to dynamic depth/toxicity haircut curves.
- **`NavEngine`**: Master coordinator combining real-time GPS clock updates, package registration, debt-cleansing swaps, and continuous global NAV and share-price calculations.

### Swapping & Dynamic Haircut Formula

When a `PlasmaPackage` is cleansed and swapped into the `EternalRecyclingSink`:
- **Clean Value**: `V_clean = V_nominal * (1 - toxicity)`
- **Dynamic Haircut**: `H = min(0.10 + 0.05 * log2(depth + 1) + 0.20 * toxicity, 0.90)`
- **Swappable Clean Units**: `Units = V_clean * (1 - H)`

### Quick Start & Usage

```python
from nav_system import Asset, PlasmaPackage, NavEngine

# 1. Initialize Engine with clean reserve liquidity
engine = NavEngine(initial_clean_reserve=1_000_000.0)

# 2. Assemble recursive asset tranches
leaf_assets = [
    Asset("A-1", "Defaulted Junk Bond", nominal_value=50_000.0, toxicity_score=0.85),
    Asset("A-2", "Subprime Receivables", nominal_value=30_000.0, toxicity_score=0.95),
]
leaf_pkg = PlasmaPackage(package_id="PKG-LEAF-01", depth=1, direct_assets=leaf_assets)

root_pkg = PlasmaPackage(
    package_id="PKG-ROOT-01",
    depth=2,
    direct_assets=[Asset("A-3", "Stressed Merchant Loan", nominal_value=20_000.0, toxicity_score=0.60)],
    nested_packages=[leaf_pkg],
)
engine.register_package(root_pkg)

# 3. Check Initial NAV
print("Pre-Swap NAV:", engine.compute_nav())

# 4. Execute Plasma Cleansing Swap
swap_receipt = engine.execute_plasma_swap("PKG-ROOT-01")
print("Swap Receipt:", swap_receipt)

# 5. Check Rebalanced NAV
print("Post-Swap NAV:", engine.compute_nav())
```

### Running Unit Tests

```bash
python -m unittest -v test_nav_system.py
```
