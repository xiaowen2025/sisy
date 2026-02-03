
import asyncio
import json
import os
import sys
import logging
from typing import Any, Dict

from dotenv import load_dotenv

# Add parent directory to path to import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.agent import SiSyAgent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

async def run_eval_manual(agent: SiSyAgent, dataset: list[dict]):
    """Run evaluation manually by iterating through the dataset."""
    logger.info("Running manual evaluation loop...")
    results = []
    
    for item in dataset:
        logger.info(f"Processing item {item['id']}...")
        user_context = {
            "profile": item["profile"],
            "routine": item["routine"]
        }
        
        try:
            response = await agent.process_message(
                text=item["message"],
                tab="present", # Default tab context
                user_context=user_context
            )
            
            result = {
                "input": item,
                "output": response
            }
            results.append(result)
            
            logger.info(f"  > Input: {item['message']}")
            logger.info(f"  > Assistant: {response['assistant_text']}")
            logger.info("-" * 40)
            
        except Exception as e:
            logger.error(f"Error processing item {item['id']}: {e}")
            
    logger.info("Manual evaluation completed.")
    await agent.flush()
    return results

def run_opik_experiment(agent: SiSyAgent, dataset_items: list[dict]):
    """Attempt to run using Opik Experiment SDK."""
    try:
        import opik
        from opik.evaluation import evaluate
        from opik import Opik, Dataset
        
        logger.info("Opik SDK found. Setting up experiment...")
        
        client = Opik(project_name="SiSy")
        dataset_name = "SiSy Eval Dataset"
        
        # Create or get dataset
        dataset = client.get_or_create_dataset(name=dataset_name)
        
        # Insert items if needed (simple check if empty or just upsert)
        # For simplicity in this script, we'll map our items to Opik dataset items
        # formatted as expected by the task.
        
        # Opik dataset items usually expect structured input/expected_output
        opik_items = []
        for item in dataset_items:
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
            
        dataset.insert(opik_items)
        
        # Define evaluation task
        # Since agent is async, and Opik evaluate expects a callable, 
        # we might need to wrap it.
        # Check if Opik supports async tasks. If not, we run sync wrapper.
        
        def evaluation_task(item):
            # item is a dict from the dataset
            input_data = item["input"]
            text = input_data["text"]
            user_context = input_data["user_context"]
            
            # Run async agent in sync wrapper
            # Creating a new loop for each call might be tricky if one fails, 
            # but for a script it's often okay or use asyncio.run
            try:
                response = asyncio.run(agent.process_message(
                    text=text,
                    tab="present",
                    user_context=user_context
                ))
                return {
                    "assistant_text": response["assistant_text"],
                    "actions": response["actions"]
                }
            except RuntimeError:
                # If loop is already running (unlikely here as we are inside evaluate)
                # handle accordingly.
                # Actually, main is async, checking if we can mix.
                pass
                
        # If we are here, we probably want to run this.
        # But wait, `agent.process_message` is async. 
        # Doing asyncio.run inside a function called by evaluate might clash if evaluate is async or running in loop.
        # Simpler approach: Manual loop is robust. Experiment SDK might be complex to get right blindly.
        
        # Let's try to see if we can just return the wrapper
        # The user said "traces exist is enough", so traces from manual loop are FINE.
        # Using evaluate creates an "Experiment" object in Opik which groups traces.
        
        raise NotImplementedError("Opik Experiment setup skipped to ensure reliability of traces first.")

    except ImportError:
        logger.info("Opik evaluation SDK not found.")
        raise
    except Exception as e:
        logger.info(f"Skipping Opik Experiment (reason: {e}). Falling back to manual loop.")
        raise

async def main():
    load_dotenv()
    
    api_key = os.getenv("MINIMAX_API_KEY", "")
    opik_key = os.getenv("OPIK_API_KEY", "")
    
    if not api_key:
        logger.error("MINIMAX_API_KEY not set")
        return

    agent = SiSyAgent(minimax_api_key=api_key, opik_api_key=opik_key)
    
    # Load dataset
    # Load dataset
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, "eval_dataset.json")
    with open(dataset_path, "r") as f:
        dataset = json.load(f)
        
    # User said "metrics not needed", so we just want to generate traces for all data.
    # Manual loop guarantees this.
    await run_eval_manual(agent, dataset)

if __name__ == "__main__":
    asyncio.run(main())
