"""
SiSy Agent - LangChain agent with MiniMax LLM and Opik tracing.
"""

import json
import re
import uuid
from typing import Any, Literal

import opik
from opik import track
from opik.integrations.langchain import OpikTracer
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from minimax_mcp.client import MinimaxAPIClient


# Structured output models



class UpsertRoutineItemAction(BaseModel):
    """Action to upsert a routine item (create or update)."""
    type: Literal["upsert_routine_item"] = "upsert_routine_item"
    id: str | None = Field(default=None, description="The ID of the routine item (if updating)")
    title: str | None = Field(default=None, description="The title of the routine item")
    scheduled_time: str | None = Field(default=None, description="ISO-8601 string for when the item is scheduled")
    status: str | None = Field(default=None, description="Status of the item (e.g., 'pending', 'completed')")
    description: str | None = Field(default=None, description="Description of the routine item")


class AddLogAction(BaseModel):
    """Action to add a log entry."""
    type: Literal["add_log"] = "add_log"
    message: str = Field(description="The log message")
    level: str = Field(default="info", description="Log level (info, warning, error)")


class UpsertProfileFieldAction(BaseModel):
    """Action to update a profile field."""
    type: Literal["upsert_profile_field"] = "upsert_profile_field"
    key: str = Field(description="The key of the profile field")
    value: str = Field(description="The value of the profile field")
    group: str | None = Field(
        default=None,
        description="The group the field belongs to (e.g., 'basics', 'preferences')"
    )


class AgentResponse(BaseModel):
    """Structured response from the SiSy agent."""
    assistant_text: str = Field(
        description="The natural language response to show the user"
    )
    actions: list[UpsertRoutineItemAction | UpsertProfileFieldAction | AddLogAction] = Field(
        default_factory=list,
        description="List of actions to perform based on the user's request"
    )


SYSTEM_PROMPT = """You are SiSy, a smart personal routine assistant inspired by Atomic Habits.
Current Time: {current_time}

CORE PHILOSOPHY:
1. Make it Obvious: Suggest specific times and triggers.
2. Make it Attractive: Use encouraging language and emojis.
3. Make it Easy: Break complex goals into small, manageable steps and add into the description of the routine item in markdown format. 
4. Make it Satisfying: Celebrate progress and completion.

CONTEXT:
User Profile:
{user_profile}

User Routine:
{user_routine}

INSTRUCTIONS:
- Monitor the User Routine to avoid conflicts.
- Update the User Profile when you learn new preferences or context.
- If the user asks for a task, create it using 'upsert_routine_item'.
- If the request is vague, ask clarifying questions in 'assistant_text'.
- ALWAYS use the Current Time to calculate relative times (e.g., "in 30 mins").

Actions you can include:
- upsert_routine_item: Create or update a routine item.
    - If creating: provide title and optional scheduled_time/status.
    - If updating: provide id and the fields to update.
- upsert_profile_field: Update a profile field with key, value, and optional group.
- add_log: Add a log message

IMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
Your response must follow this exact format:
{{
  "assistant_text": "Your natural language response to the user",
  "actions": []
}}
"""


class SiSyAgent:
    """LangChain agent for SiSy with MiniMax LLM and Opik tracing."""

    def __init__(self, minimax_api_key: str, opik_api_key: str):
        self.minimax_api_key = minimax_api_key
        self.opik_api_key = opik_api_key
        
        # Initialize Opik
        if opik_api_key:
            opik.configure(api_key=opik_api_key, use_local=False, automatic_approvals=True)
        
        # Initialize OpikTracer for LangChain integration
        self.opik_tracer = OpikTracer(project_name="SiSy")
        
        # Initialize LLM with MiniMax's OpenAI-compatible endpoint
        # Note: We don't use with_structured_output() because MiniMax returns
        # <think> tags that need to be stripped before JSON parsing
        self.llm = ChatOpenAI(
            model="MiniMax-M2.1",
            openai_api_key=minimax_api_key,
            openai_api_base="https://api.minimax.io/v1",
            temperature=0.7,
        )
        
        # Initialize MiniMax VLM Client
        self.vlm_client = MinimaxAPIClient(minimax_api_key, "https://api.minimax.io")

    def _strip_thinking_tags(self, content: str) -> str:
        """Remove <think>...</think> tags from the response content."""
        # Remove think tags and their content
        cleaned = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
        return cleaned.strip()
    
    def _extract_json(self, content: str) -> dict:
        """Extract JSON from the response content, handling various formats."""
        # First strip any thinking tags
        content = self._strip_thinking_tags(content)
        
        # Try to find JSON in markdown code blocks
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
        if json_match:
            content = json_match.group(1)
        
        # Try to find raw JSON object
        json_match = re.search(r'\{[^{}]*"assistant_text"[^{}]*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
        
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Fallback: return the raw content as assistant_text
            return {
                "assistant_text": content,
                "actions": []
            }

    @track(project_name="SiSy")
    async def process_message(
        self,
        text: str,
        tab: str,
        conversation_id: str | None = None,

        image_file: bytes | None = None,
        user_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Process a user message and return response with actions."""
        import datetime
        
        # Prepare context strings
        user_profile_str = "{}"
        user_routine_str = "[]"
        current_time_str = datetime.datetime.now().isoformat()
        
        if user_context:
            user_profile_str = json.dumps(user_context.get("profile", {}), indent=2)
            user_routine_str = json.dumps(user_context.get("routine", []), indent=2)
            
        system_prompt = SYSTEM_PROMPT.format(
            user_profile=user_profile_str,
            user_routine=user_routine_str,
            current_time=current_time_str
        )
        content: list[dict[str, Any]] | str = text
        
        if image_file:
            import base64
            # Encode image to base64
            base64_image = base64.b64encode(image_file).decode('utf-8')
            image_data_url = f"data:image/jpeg;base64,{base64_image}"
            
            # Use VLM to understand the image
            try:
                vlm_response = self.vlm_client.post("/v1/coding_plan/vlm", json={ # Correction: endpoint is vlm according to server.py
                    "prompt": text, # Use user's text as prompt for analysis
                    "image_url": image_data_url
                })
                image_description = vlm_response.get("content", "Image content analysis failed.")
                
                # Append description to text
                text = f"{text}\n\n[System Note: The user attached an image. Here is the analysis of the image content: {image_description}]"
                content = text # Reset content to text since we processed the image
                
            except Exception as e:
                print(f"[Agent] VLM Error: {e}")
                text = f"{text}\n\n[System Note: The user attached an image, but analysis failed.]"
                content = text



        # Build messages
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=content),
        ]
        
        # Call LLM
        response = await self._call_llm(messages)
        
        # Extract content from the response
        response_content = response.content if hasattr(response, 'content') else str(response)
        
        # Parse the JSON response
        parsed = self._extract_json(response_content)
        
        return {
            "conversation_id": conversation_id or str(uuid.uuid4()),
            "assistant_text": parsed.get("assistant_text", response_content),
            "actions": parsed.get("actions", []),
        }

    async def _call_llm(self, messages: list):
        """Call the LLM with tracing via OpikTracer."""
        return await self.llm.ainvoke(
            messages,
            config={"callbacks": [self.opik_tracer]}
        )

    async def flush(self):
        """Flush any pending Opik traces."""
        try:
            opik.flush_tracker()
        except Exception as e:
            print(f"[Opik Flush Error] {e}")

