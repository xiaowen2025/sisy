import json
import os
import sys
import logging
import asyncio
from typing import Any, Dict, List

# Add parent directory to path to import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.agent import SiSyAgent
from opik import Opik, Dataset

logger = logging.getLogger(__name__)

PROJECT_NAME = "SiSy"
DATASET_NAME = "Sisy Eval"

def get_script_dir():
    return os.path.dirname(os.path.abspath(__file__))

def load_local_dataset() -> List[Dict]:
    """Load dataset from local JSON file."""
    script_dir = get_script_dir()
    dataset_path = os.path.join(script_dir, "eval_dataset.json")
    
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
        
    with open(dataset_path, "r") as f:
        return json.load(f)

def get_or_create_opik_dataset(client: Opik, local_items: List[Dict]) -> Dataset:
    """Get or create the Opik dataset and insert items."""
    dataset = client.get_or_create_dataset(name=DATASET_NAME)
    
    # Prepare items for Opik dataset
    opik_items = []
    for item in local_items:
        opik_items.append({
            "input": {
                "text": item["message"],
                "user_context": {
                    "profile": item["profile"],
                    "routine": item["routine"]
                }
            },
            "expected_output": {
                "guidance": item.get("expected_response_guidance"),
                "category": item.get("category")
            },
            "metadata": {
                "id": item["id"]
            }
        })
        
    try:
        # Note: Opik might duplicate if inserted multiple times without dedup logic,
        # but for now we follow the original script's behavior which seemed to try inserting.
        # We wrap in try block to avoid crashing if duplicates exist and Opik complains.
        dataset.insert(opik_items)
    except Exception as e:
        logger.warning(f"Error inserting items into dataset (might be duplicates): {e}")
        
    return dataset

# Initialize global agent to reuse connection
_agent_instance = None

def get_agent():
    global _agent_instance
    if _agent_instance is None:
        api_key = os.getenv("MINIMAX_API_KEY", "")
        opik_key = os.getenv("OPIK_API_KEY", "")
        if not api_key:
             raise ValueError("MINIMAX_API_KEY not found in environment")
        _agent_instance = SiSyAgent(minimax_api_key=api_key, opik_api_key=opik_key)
    return _agent_instance

def evaluation_task(item):
    """Task wrapper for Opik evaluation."""
    input_data = item["input"]
    text = input_data["text"]
    user_context = input_data["user_context"]
    
    agent = get_agent()
    
    # Run async agent synchronously
    return asyncio.run(agent.process_message(
        text=text,
        tab="present",
        user_context=user_context
    ))
