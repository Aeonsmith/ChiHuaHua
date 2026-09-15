"""
Yggdrasil DAG State Store
=========================
A content-addressed Directed Acyclic Graph (DAG) state storage engine supporting
non-linear branching, cryptographic node integrity, and dual-timestamping
(UTC system time + mythological/para-chronology epoch anchors).
"""

import hashlib
import json
import os
import sqlite3
import time
from typing import Any, Dict, List, Optional, Set, Tuple


class DAGNode:
    """
    Represents an immutable content-addressed node in the Yggdrasil DAG.
    """

    def __init__(
        self,
        payload: Dict[str, Any],
        parents: Optional[List[str]] = None,
        branch: str = "trunk",
        author: str = "Phantom Menace",
        para_epoch: str = "1999.OCT.28",
        sys_recorded_at: Optional[float] = None,
        node_id: Optional[str] = None,
    ):
        self.payload = payload
        self.parents = sorted(parents) if parents else []
        self.branch = branch
        self.author = author
        self.para_epoch = para_epoch
        self.sys_recorded_at = sys_recorded_at or time.time()
        self.node_id = node_id or self.compute_hash()

    def compute_hash(self) -> str:
        """
        Computes the deterministic SHA-256 hash of the node contents.
        """
        canonical_representation = {
            "payload": self.payload,
            "parents": self.parents,
            "branch": self.branch,
            "author": self.author,
            "para_epoch": self.para_epoch,
            "sys_recorded_at": round(self.sys_recorded_at, 4),
        }
        serialized = json.dumps(canonical_representation, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "payload": self.payload,
            "parents": self.parents,
            "branch": self.branch,
            "author": self.author,
            "para_epoch": self.para_epoch,
            "sys_recorded_at": self.sys_recorded_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DAGNode":
        return cls(
            payload=data["payload"],
            parents=data.get("parents", []),
            branch=data.get("branch", "trunk"),
            author=data.get("author", "anonymous"),
            para_epoch=data.get("para_epoch", "1999.OCT.28"),
            sys_recorded_at=data.get("sys_recorded_at"),
            node_id=data.get("node_id"),
        )


class YggdrasilDAGStore:
    """
    Persistent SQLite-backed Directed Acyclic Graph state store.
    """

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:")
            self._mem_conn.row_factory = sqlite3.Row
        else:
            self._mem_conn = None
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Nodes table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS nodes (
                    node_id TEXT PRIMARY KEY,
                    branch TEXT NOT NULL,
                    author TEXT NOT NULL,
                    para_epoch TEXT NOT NULL,
                    sys_recorded_at REAL NOT NULL,
                    payload_json TEXT NOT NULL
                )
            """)
            # Node parents (edges in DAG)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS node_parents (
                    child_id TEXT NOT NULL,
                    parent_id TEXT NOT NULL,
                    PRIMARY KEY (child_id, parent_id),
                    FOREIGN KEY (child_id) REFERENCES nodes(node_id),
                    FOREIGN KEY (parent_id) REFERENCES nodes(node_id)
                )
            """)
            # Branch heads table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS branch_heads (
                    branch_name TEXT PRIMARY KEY,
                    head_node_id TEXT NOT NULL,
                    updated_at REAL NOT NULL,
                    FOREIGN KEY (head_node_id) REFERENCES nodes(node_id)
                )
            """)
            # Indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_branch ON nodes(branch)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_epoch ON nodes(para_epoch)")
            conn.commit()

    def commit(
        self,
        payload: Dict[str, Any],
        branch: str = "trunk",
        author: str = "Phantom Menace",
        para_epoch: str = "1999.OCT.28",
        parents: Optional[List[str]] = None,
    ) -> DAGNode:
        """
        Commits a new payload to the specified branch.
        If parents are not explicitly provided, the current branch head is used.
        """
        if parents is None:
            current_head = self.get_branch_head(branch)
            parents = [current_head] if current_head else []

        # Validate that all parents exist in DAG
        for parent_id in parents:
            if not self.get_node(parent_id):
                raise ValueError(f"Parent node {parent_id} does not exist in DAG.")

        node = DAGNode(
            payload=payload,
            parents=parents,
            branch=branch,
            author=author,
            para_epoch=para_epoch,
        )

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO nodes (node_id, branch, author, para_epoch, sys_recorded_at, payload_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    node.node_id,
                    node.branch,
                    node.author,
                    node.para_epoch,
                    node.sys_recorded_at,
                    json.dumps(node.payload),
                ),
            )

            for parent_id in node.parents:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO node_parents (child_id, parent_id)
                    VALUES (?, ?)
                    """,
                    (node.node_id, parent_id),
                )

            # Update branch head
            cursor.execute(
                """
                INSERT OR REPLACE INTO branch_heads (branch_name, head_node_id, updated_at)
                VALUES (?, ?, ?)
                """,
                (branch, node.node_id, time.time()),
            )
            conn.commit()

        return node

    def get_node(self, node_id: str) -> Optional[DAGNode]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM nodes WHERE node_id = ?", (node_id,))
            row = cursor.fetchone()
            if not row:
                return None

            cursor.execute("SELECT parent_id FROM node_parents WHERE child_id = ? ORDER BY parent_id ASC", (node_id,))
            parent_rows = cursor.fetchall()
            parents = [r["parent_id"] for r in parent_rows]

            return DAGNode(
                payload=json.loads(row["payload_json"]),
                parents=parents,
                branch=row["branch"],
                author=row["author"],
                para_epoch=row["para_epoch"],
                sys_recorded_at=row["sys_recorded_at"],
                node_id=row["node_id"],
            )

    def get_branch_head(self, branch: str) -> Optional[str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT head_node_id FROM branch_heads WHERE branch_name = ?", (branch,))
            row = cursor.fetchone()
            return row["head_node_id"] if row else None

    def list_branches(self) -> Dict[str, str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT branch_name, head_node_id FROM branch_heads")
            return {r["branch_name"]: r["head_node_id"] for r in cursor.fetchall()}

    def fork_branch(self, source_branch: str, target_branch: str) -> Optional[str]:
        """
        Creates a new branch pointer pointing to the current head of source_branch.
        """
        head = self.get_branch_head(source_branch)
        if not head:
            return None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO branch_heads (branch_name, head_node_id, updated_at)
                VALUES (?, ?, ?)
                """,
                (target_branch, head, time.time()),
            )
            conn.commit()
        return head

    def get_ancestry(self, start_node_id: str, limit: int = 100) -> List[DAGNode]:
        """
        Traverses backwards through parents, returning ancestral nodes in reverse topological order.
        """
        visited: Set[str] = set()
        queue: List[str] = [start_node_id]
        history: List[DAGNode] = []

        while queue and len(history) < limit:
            curr_id = queue.pop(0)
            if curr_id in visited:
                continue
            visited.add(curr_id)

            node = self.get_node(curr_id)
            if node:
                history.append(node)
                for p in node.parents:
                    if p not in visited:
                        queue.append(p)

        return history

    def merge_branches(
        self,
        source_branch: str,
        target_branch: str,
        merge_payload: Dict[str, Any],
        author: str = "Chihuahua Sentinel",
        para_epoch: str = "1999.MERGE.POINT",
    ) -> DAGNode:
        """
        Creates a merge node with two parents: head of target_branch and head of source_branch.
        """
        target_head = self.get_branch_head(target_branch)
        source_head = self.get_branch_head(source_branch)

        if not target_head or not source_head:
            raise ValueError("Both source and target branches must have active heads to merge.")

        if target_head == source_head:
            # Already in sync, return target head
            return self.get_node(target_head)

        parents = [target_head, source_head]
        return self.commit(
            payload=merge_payload,
            branch=target_branch,
            author=author,
            para_epoch=para_epoch,
            parents=parents,
        )

    def detect_divergence(self, branch_a: str, branch_b: str) -> Dict[str, Any]:
        """
        Detects common ancestor and diverging nodes between two branches.
        """
        head_a = self.get_branch_head(branch_a)
        head_b = self.get_branch_head(branch_b)

        if not head_a or not head_b:
            return {"status": "missing_branch", "diverged": False}

        if head_a == head_b:
            return {"status": "identical", "diverged": False, "common_ancestor": head_a}

        ancestors_a = {n.node_id for n in self.get_ancestry(head_a, limit=500)}
        ancestors_b = {n.node_id for n in self.get_ancestry(head_b, limit=500)}

        common = ancestors_a.intersection(ancestors_b)
        unique_a = ancestors_a - ancestors_b
        unique_b = ancestors_b - ancestors_a

        return {
            "status": "diverged",
            "diverged": True,
            "head_a": head_a,
            "head_b": head_b,
            "unique_nodes_count_a": len(unique_a),
            "unique_nodes_count_b": len(unique_b),
            "common_ancestors_count": len(common),
        }
