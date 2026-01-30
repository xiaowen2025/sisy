"""
Run evaluation experiment on Opik for the SiSy agent.
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import Any, Dict

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
import opik
from opik import Opik
from opik.evaluation import evaluate
from opik.evaluation.metrics import BaseMetric
from opik.evaluation.metrics.score_result import ScoreResult

# Load environment variables
load_dotenv(backend_dir / ".env")

# Import the agent
from agent import SiSyAgent

# Constants
DATASET_NAME = "SiSy Agent Evaluation"
EXPERIMENT_NAME = "SiSy Agent Baseline"

class ActionTypeMetric(BaseMetric):
    """
    Checks if the agent returned the expected action type.
    """
    def __init__(self, name: str = "Correct Action Type"):
        super().__init__(name=name)

    def score(self, actions: list, expected_output: Dict[str, Any], **kwargs) -> ScoreResult:
        """
        Score the output based on action type matching.
        
        Args:
            actions: List of actions returned by the agent
            expected_output: Dictionary containing expected action type/details
        """
        # Determine actual action type (simplified: take the first one or "none")
        if not actions:
            actual_type = "none"
        else:
            actual_type = actions[0].get("type", "unknown")
            
        expected_checklist = expected_output
        
        score = 1.0
        reason = "Match"
        
        # Check specific expectations based on our dataset structure
        if expected_checklist.get("should_update_profile"):
            # We expect at least one upsert_profile_field action
            has_profile_action = any(a.get("type") == "upsert_profile_field" for a in actions)
            if not has_profile_action:
                score = 0.0
                reason = f"Expected profile update, but got actions: {[a.get('type') for a in actions]}"
                
        elif expected_checklist.get("should_explain_capabilities"):
            # We expect no functional actions, just text
            if actions:
                 # It's acceptable if it produced no actions, but if it did something like create_task for "help", that's wrong.
                 pass
            
        elif expected_checklist.get("attribute_key"):
            # Check if specific attribute was updated
            expected_key = expected_checklist["attribute_key"]
            found = False
            for a in actions:
                if a.get("type") == "upsert_profile_field" and a.get("key") == expected_key:
                    found = True
                    # Check value if specified
                    if "attribute_value" in expected_checklist:
                         if a.get("value") != expected_checklist["attribute_value"]:
                             score = 0.5
                             reason = f"Right key, wrong value: got {a.get('value')}, expected {expected_checklist['attribute_value']}"
                    break
            if not found and score == 1.0:
                score = 0.0
                reason = f"Expected update for key '{expected_key}', not found."

        return ScoreResult(name=self.name, value=score, reason=reason)


class ResponseKeywordMetric(BaseMetric):
    """
    Checks if the response text contains specific keywords if requested.
    """
    def __init__(self, name: str = "Response Keywords"):
        super().__init__(name=name)

    def score(self, assistant_text: str, expected_output: Dict[str, Any], **kwargs) -> ScoreResult:
        response_text = (assistant_text or "").lower()
        expected_checklist = expected_output
        
        required_words = expected_checklist.get("response_should_mention", [])
        if not required_words:
            return ScoreResult(name=self.name, value=1.0, reason="No keywords required")
            
        missing = [w for w in required_words if w.lower() not in response_text]
        
        if missing:
            return ScoreResult(name=self.name, value=0.0, reason=f"Missing keywords: {missing}")
            
        return ScoreResult(name=self.name, value=1.0, reason="All keywords present")



def run_evaluation():
    # 1. Initialize Agent
    minimax_key = os.getenv("MINIMAX_API_KEY")
    opik_key = os.getenv("OPIK_API_KEY")
    
    if not minimax_key or not opik_key:
        print("Error: Missing API keys. Check backend/.env")
        return

    agent = SiSyAgent(minimax_api_key=minimax_key, opik_api_key=opik_key)
    
    # 2. Define the Evaluation Task
    def evaluation_task(dataset_item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Wraps the async agent call into a sync function for Opik.
        """
        user_input = dataset_item["input"]
        tab_context = dataset_item.get("tab", "today")
        
        # Since run_evaluation is now sync, there is no global loop running.
        # We can safely use asyncio.run separately for each task execution.
        return asyncio.run(agent.process_message(text=user_input, tab=tab_context))


    # 3. Get Dataset
    client = Opik(api_key=opik_key)
    dataset = client.get_dataset(name=DATASET_NAME)
    if not dataset:
        print(f"Dataset '{DATASET_NAME}' not found. Run upload_dataset.py first.")
        return

    # 4. Run Evaluation
    print(f"Starting evaluation on dataset '{DATASET_NAME}'...")
    
    evaluation_config = {
        "model": "MiniMax-M2.1"
    }

    results = evaluate(
        dataset=dataset,
        task=evaluation_task,
        scoring_metrics=[
            ActionTypeMetric(),
            ResponseKeywordMetric()
        ],
        experiment_config=evaluation_config,
        experiment_name=EXPERIMENT_NAME
    )
    
    print("\nEvaluation Complete!")


if __name__ == "__main__":
    run_evaluation()
