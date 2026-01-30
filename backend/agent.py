"""
SiSy Agent - LangChain agent with MiniMax LLM and Opik tracing.
"""

import json
import uuid
from typing import Any

import opik
from opik.integrations.langchain import OpikTracer
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI


# Tool definitions
@tool
def create_task(title: str, scheduled_time: str | None = None) -> dict:
    """Create a new task in the user's daily plan.
    
    Args:
        title: The title of the task.
        scheduled_time: ISO-8601 string for when the task is scheduled, or null if not specified.
    """
    return {"type": "create_task", "title": title, "scheduled_time": scheduled_time}


@tool
def suggest_reschedule(task_id: str, scheduled_time: str) -> dict:
    """Suggest a new time for an existing task.
    
    Args:
        task_id: The ID of the task to reschedule.
        scheduled_time: The new ISO-8601 scheduled time.
    """
    return {"type": "suggest_reschedule", "task_id": task_id, "scheduled_time": scheduled_time}


@tool
def upsert_profile_field(key: str, value: str, group: str | None = None) -> dict:
    """Update a field in the user's profile.
    
    Args:
        key: The key of the profile field (e.g., "name", "wake_up_time").
        value: The value of the profile field.
        group: The group the field belongs to (e.g., "basics", "preferences").
    """
    return {
        "type": "upsert_profile_field",
        "key": key,
        "value": value,
        "group": group,
        "source": "learned",
    }


SYSTEM_PROMPT = """You are SiSy, a minimalist daily planning assistant.
You are helpful, concise, and calm.
You have access to real-time web search. Use it when users ask about current events, weather, or facts.

You can perform actions like creating tasks, rescheduling them, or updating the user's profile.
When the user's request implies an action, use the appropriate tool.
"""


class SiSyAgent:
    """LangChain agent for SiSy with MiniMax LLM and Opik tracing."""

    def __init__(self, minimax_api_key: str, opik_api_key: str):
        self.minimax_api_key = minimax_api_key
        self.opik_api_key = opik_api_key
        
        # Initialize Opik
        if opik_api_key:
            opik.configure(api_key=opik_api_key)
        
        # Initialize OpikTracer for LangChain integration
        self.opik_tracer = OpikTracer(project_name="SiSy")
        
        # Initialize LLM with MiniMax's OpenAI-compatible endpoint
        self.llm = ChatOpenAI(
            model="MiniMax-M2.1",
            openai_api_key=minimax_api_key,
            openai_api_base="https://api.minimax.io/v1",
            temperature=0.7,
        )
        
        # Bind tools to the LLM
        self.tools = [create_task, suggest_reschedule, upsert_profile_field]
        self.llm_with_tools = self.llm.bind_tools(self.tools)

    async def process_message(
        self,
        text: str,
        tab: str,
        conversation_id: str | None = None,
        image_uri: str | None = None,
    ) -> dict[str, Any]:
        """Process a user message and return response with actions."""
        
        # Build messages
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=text),
        ]
        
        # Note: Image handling would need additional work for multimodal
        # For now, we focus on text-based interaction
        
        # Call LLM with tools
        response = await self._call_llm(messages)
        
        # Extract content and tool calls
        assistant_text = response.content if isinstance(response.content, str) else ""
        actions = []
        
        if response.tool_calls:
            for tool_call in response.tool_calls:
                action = self._convert_tool_call_to_action(tool_call)
                if action:
                    actions.append(action)
        
        return {
            "conversation_id": conversation_id or str(uuid.uuid4()),
            "assistant_text": assistant_text,
            "actions": actions,
        }

    async def _call_llm(self, messages: list) -> AIMessage:
        """Call the LLM with tracing via OpikTracer."""
        return await self.llm_with_tools.ainvoke(
            messages,
            config={"callbacks": [self.opik_tracer]}
        )

    def _convert_tool_call_to_action(self, tool_call: dict) -> dict | None:
        """Convert a LangChain tool call to a frontend action."""
        name = tool_call.get("name")
        args = tool_call.get("args", {})
        
        if name == "create_task":
            return {
                "type": "create_task",
                "title": args.get("title"),
                "scheduled_time": args.get("scheduled_time"),
            }
        elif name == "suggest_reschedule":
            return {
                "type": "suggest_reschedule",
                "task_id": args.get("task_id"),
                "scheduled_time": args.get("scheduled_time"),
            }
        elif name == "upsert_profile_field":
            return {
                "type": "upsert_profile_field",
                "key": args.get("key"),
                "value": args.get("value"),
                "group": args.get("group"),
                "source": "learned",
            }
        return None

    async def flush(self):
        """Flush any pending Opik traces."""
        try:
            opik.flush_tracker()
        except Exception as e:
            print(f"[Opik Flush Error] {e}")
