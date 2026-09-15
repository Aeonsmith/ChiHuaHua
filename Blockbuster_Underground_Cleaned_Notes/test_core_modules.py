"""
Test suite for Atlantis Ingress Gateway and Yggdrasil DAG State Store.
"""

import os
import unittest
from atlantis_gateway import AtlantisGateway, AtlantisAuthError
from yggdrasil_dag import DAGNode, YggdrasilDAGStore


class TestYggdrasilDAG(unittest.TestCase):
    def setUp(self):
        self.store = YggdrasilDAGStore(":memory:")

    def test_basic_commit_and_ancestry(self):
        node1 = self.store.commit(
            payload={"concept": "Clicker Start", "type": "financial_seed"},
            branch="trunk",
            author="Phantom Menace",
            para_epoch="1999.OCT.28",
        )
        self.assertIsNotNone(node1.node_id)
        self.assertEqual(node1.parents, [])

        node2 = self.store.commit(
            payload={"concept": "Banking Optimization Loop", "optimal_deposit_rate": 0.0704},
            branch="trunk",
            author="Father of the Force",
            para_epoch="1999.NOV.01",
        )
        self.assertEqual(node2.parents, [node1.node_id])

        ancestry = self.store.get_ancestry(node2.node_id)
        self.assertEqual(len(ancestry), 2)
        self.assertEqual(ancestry[0].node_id, node2.node_id)
        self.assertEqual(ancestry[1].node_id, node1.node_id)

    def test_branching_and_divergence(self):
        root = self.store.commit(payload={"init": "genesis_1999"})
        
        # Fork to a new branch
        self.store.fork_branch("trunk", "atlantis-para")
        
        # Commit to trunk
        trunk_node = self.store.commit(payload={"trunk_update": True}, branch="trunk")
        
        # Commit to atlantis-para
        para_node = self.store.commit(payload={"para_update": True}, branch="atlantis-para")

        divergence = self.store.detect_divergence("trunk", "atlantis-para")
        self.assertTrue(divergence["diverged"])
        self.assertEqual(divergence["unique_nodes_count_a"], 1)
        self.assertEqual(divergence["unique_nodes_count_b"], 1)
        self.assertEqual(divergence["common_ancestors_count"], 1)

    def test_merge_branches(self):
        root = self.store.commit(payload={"genesis": True}, branch="trunk")
        self.store.fork_branch("trunk", "feature-holding")
        
        feat_node = self.store.commit(payload={"holding_co_merged": True}, branch="feature-holding")
        trunk_node = self.store.commit(payload={"base_refinement": True}, branch="trunk")

        merge_node = self.store.merge_branches(
            source_branch="feature-holding",
            target_branch="trunk",
            merge_payload={"status": "holding_co_integrated"},
            author="Chihuahua Sentinel",
        )
        self.assertEqual(len(merge_node.parents), 2)
        self.assertIn(trunk_node.node_id, merge_node.parents)
        self.assertIn(feat_node.node_id, merge_node.parents)


class TestAtlantisGateway(unittest.TestCase):
    def setUp(self):
        self.dag_store = YggdrasilDAGStore(":memory:")
        self.gateway = AtlantisGateway(
            dag_store=self.dag_store,
            boundary_secret_key="secret-key-1999",
            onion_address="atlantis777chi777underground.onion",
        )
        self.gateway.register_authorized_entity("key_001", "Phantom Menace")

    def test_authenticated_ingress_commit(self):
        token = self.gateway.generate_ingress_token("key_001", para_epoch="1999.OCT.28")
        result = self.gateway.handle_ingress_commit(
            token=token,
            payload={"business": "Holding Company", "hourly_profit": 5050000000},
            branch="trunk",
        )
        self.assertEqual(result["status"], "boundary_crossed")
        self.assertEqual(result["author"], "Phantom Menace")
        self.assertEqual(result["para_epoch"], "1999.OCT.28")

        # Verify node exists in DAG
        node = self.dag_store.get_node(result["node_id"])
        self.assertIsNotNone(node)
        self.assertEqual(node.payload["business"], "Holding Company")

    def test_unauthorized_token_rejection(self):
        token = self.gateway.generate_ingress_token("key_001")
        # Tamper with token by passing an unauthorized key
        bad_gateway = AtlantisGateway(
            dag_store=self.dag_store,
            boundary_secret_key="different-secret-key",
            onion_address="atlantis777chi777underground.onion",
        )
        with self.assertRaises(AtlantisAuthError):
            bad_gateway.handle_ingress_commit(token, payload={"hack": True})

    def test_authenticated_query(self):
        token = self.gateway.generate_ingress_token("key_001")
        commit_res = self.gateway.handle_ingress_commit(
            token=token,
            payload={"note": "Security Analysis Cleaned"},
            branch="trunk",
        )
        node_id = commit_res["node_id"]

        query_token = self.gateway.generate_ingress_token("key_001")
        query_res = self.gateway.handle_ingress_query(token=query_token, node_id=node_id)
        self.assertEqual(query_res["status"], "success")
        self.assertEqual(query_res["node"]["payload"]["note"], "Security Analysis Cleaned")


if __name__ == "__main__":
    unittest.main()
