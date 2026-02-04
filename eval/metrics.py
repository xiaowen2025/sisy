import json
import os
import logging
from typing import Any, Dict

from opik.evaluation.metrics import BaseMetric
from opik.evaluation.metrics.score_result import ScoreResult
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

class LLMJudgeMetric(BaseMetric):
    """
    A custom metric that uses an LLM to evaluate the agent's response.
    """
    def __init__(self, model_name: str = "MiniMax-M2.1", name: str = "LLM Judge"):
        super().__init__(name=name)
        self.model_name = model_name
        
        api_key = os.getenv("MINIMAX_API_KEY", "")
        if not api_key:
            # We don't raise error immediately to allow import, but will fail if used without key
            logger.warning("MINIMAX_API_KEY not found in environment")
            
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
