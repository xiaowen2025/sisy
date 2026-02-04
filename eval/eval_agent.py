
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

# Import Opik
try:
    import opik
    from opik import Opik, Dataset
    from opik.evaluation import evaluate
    from opik.evaluation.metrics import BaseMetric
    from opik.evaluation.metrics.score_result import ScoreResult
    from langchain_openai import ChatOpenAI
except ImportError as e:
    logger.error(f"Opik or LangChain not installed. Error: {e}")
    sys.exit(1)

class LLMJudgeMetric(BaseMetric):
    """
    A custom metric that uses an LLM to evaluate the agent's response.
    """
    def __init__(self, model_name: str = "MiniMax-M2.1", name: str = "LLM Judge"):
        super().__init__(name=name)
        self.model_name = model_name
        
        api_key = os.getenv("MINIMAX_API_KEY", "")
        if not api_key:
            raise ValueError("MINIMAX_API_KEY not found in environment")
            
        self.llm = ChatOpenAI(
            model=model_name,
            openai_api_key=api_key,
            openai_api_base="https://api.minimax.io/v1",
            temperature=0.0 # Use 0 for deterministic evaluation
        )

    def score(self, input: Dict[str, Any], assistant_text: str, actions: list, expected_output: Dict[str, Any], **kwargs) -> ScoreResult:
        """
        Score the agent's output using an LLM.
        """
        user_message = input.get("text", "")
        agent_response = assistant_text
        agent_actions = actions
        expected_guidance = expected_output.get("guidance", "N/A")
        
        prompt = f"""
        You are an expert evaluator for an AI assistant.
        
        Input Context:
        User Message: "{user_message}"
        
        Agent Output:
        Response Text: "{agent_response}"
        Actions Taken: {json.dumps(agent_actions, indent=2)}
        
        Expected Behavior/Guidance:
        "{expected_guidance}"
        
        Task:
        Evaluate if the agent's response (both text and actions) successfully followed the expected guidance and provided a helpful, correct answer.
        
        Return your evaluation in the following JSON format ONLY:
        {{
            "score": <float between 0.0 and 1.0>,
            "reason": "<explanation of the score>"
        }}
        """
        
        try:
            response = self.llm.invoke(prompt)
            content = response.content
            
            # Clean up content if it contains markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            content = content.strip()
            
            try:
                result_json = json.loads(content)
            except json.JSONDecodeError:
                # Fallback: try to find anything looking like json
                import re
                json_match = re.search(r'\{.*\}', content, re.DOTALL)
                if json_match:
                    result_json = json.loads(json_match.group(0))
                else:
                    raise ValueError(f"Could not parse JSON from: {content[:100]}...")

            score = float(result_json.get("score", 0.0))
            reason = result_json.get("reason", "No reason provided")
            
            return ScoreResult(
                name=self.name,
                value=score,
                reason=reason
            )
            
        except Exception as e:
            logger.error(f"Error in LLM Judge: {e}")
            return ScoreResult(
                name=self.name,
                value=0.0,
                reason=f"Evaluation failed: {str(e)}"
            )

def run_opik_experiment(dataset_items: list[dict]):
    """Run evaluation using Opik Experiment SDK."""
    logger.info("Setting up Opik experiment...")
    
    # Ensure project name is consistent
    project_name = "SiSy"
    client = Opik(project_name=project_name)
    dataset_name = "SiSy Eval Dataset 2"
    
    # Create or get dataset
    dataset = client.get_or_create_dataset(name=dataset_name)
    
    # Prepare items for Opik dataset
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
        
    try:
        dataset.insert(opik_items)
    except Exception as e:
        logger.warning(f"Error inserting items (might be duplicates): {e}")

    # Initialize Agent (globally or here)
    api_key = os.getenv("MINIMAX_API_KEY", "")
    opik_key = os.getenv("OPIK_API_KEY", "")
    agent = SiSyAgent(minimax_api_key=api_key, opik_api_key=opik_key)

    # Define evaluation task wrapper
    def evaluation_task(item):
        input_data = item["input"]
        text = input_data["text"]
        user_context = input_data["user_context"]
        
        # Run async agent
        return asyncio.run(agent.process_message(
            text=text,
            tab="present",
            user_context=user_context
        ))

    # Run evaluation
    experiment_config = {
        "model": "MiniMax-M2.1",
        "agent": "SiSyAgent"
    }

    results = evaluate(
        dataset=dataset,
        task=evaluation_task,
        scoring_metrics=[LLMJudgeMetric()],
        project_name=project_name,
        experiment_config=experiment_config,
        experiment_name=f"SiSy Eval {os.urandom(4).hex()}"
    )
    
    logger.info(f"Evaluation completed. Results: {results}")

def main():
    load_dotenv()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, "eval_dataset.json")
    
    with open(dataset_path, "r") as f:
        dataset_items = json.load(f)
        
    run_opik_experiment(dataset_items)

if __name__ == "__main__":
    main()
