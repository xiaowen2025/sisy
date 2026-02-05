"""
SiSy Agent - LangChain agent with MiniMax LLM and Opik tracing.
Uses tool calling for actions.
"""

import json
import os
import re
import uuid
from typing import Any, Literal

import opik
from opik import track
from opik.integrations.langchain import OpikTracer
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from minimax_mcp.client import MinimaxAPIClient


SYSTEM_PROMPT = """Current Time: {current_time}

You name is Sisy. You are dedicated to help your user to build a better routine through iterative refinement, improve their physical, mental, and emotional well-being.

CONTEXT:
User Profile:
{user_profile}

User Routine:
{user_routine}

Consider the following principles:

## Make it Obvious & Easy:
- suggest clear routine item titles with specific triggers
- Break vague/complex goals into small, manageable steps and add into the description of the routine item in easy readable markdown format. 

## Make it Attractive & Satisfying
- Use encouraging language
- bind the user's goal to the routine item
- combine task with what user likes to do


INSTRUCTIONS on your response:
- Your response must be clear and concise, use markdown format like bullet points, bold text, etc. to make it more readable.  
- DO NOT hallucinate capabilities like web search or external API access. You only have access to the user's profile and routine provided in the context.
- Use the provided `Current Time` as the reference for all relative time expressions (e.g., "tomorrow", "in 30 mins").
- Before dumping a long response to the user, summarise and ask user if they want to know more details.  
- Ask smart, easy to understand questions to help user to clarify their obstacles and goals in order to manage the routine items.

INSTRUCTIONS on tool calling:
- Use the provided tools to CREATE or UPDATE routine items and profile fields.
- **CRITICAL**: Calling a tool effectively EXECUTES the command - changes will be applied immediately.
- If the user's intent is ambiguous, ask for confirmation first and DO NOT call tools yet.
- Call `upsert_profile_field` when you learn new preferences or context about the user.
- Call `upsert_routine_item` to add or modify items in the user's routine.
- You can call multiple tools in a single response if needed.

"""

# --- Tool Definitions using @tool decorator ---

@tool
def upsert_routine_item(
    title: str,
    time: str | None = None,
    description: str | None = None,
    id: str | None = None,
) -> str:
    """Create or update a routine item in the user's schedule.
    
    Args:
        title: The title of the routine item (required)
        time: Time in HH:MM format (24-hour), e.g., '08:00' for 8am, '14:30' for 2:30pm
        description: Detailed description or steps for this routine item
        id: The ID of an existing routine item to update. If not provided, creates a new item.
    
    Returns:
        Confirmation message
    """
    return f"Routine item '{title}' created/updated successfully."


@tool
def upsert_profile_field(
    key: str,
    value: str,
    group: str | None = None,
) -> str:
    """Update a field in the user's profile with learned information.
    
    Args:
        key: The name/key of the profile field (e.g., 'Age', 'Preferred workout time')
        value: The value to store for this field
        group: Optional group name to organize the field (e.g., 'Basics', 'Preferences', 'Health')
    
    Returns:
        Confirmation message
    """
    return f"Profile field '{key}' updated successfully."


# List of tools for the agent
AGENT_TOOLS = [upsert_routine_item, upsert_profile_field]


class SiSyAgent:
    """LangChain agent for SiSy with MiniMax LLM and Opik tracing."""

    def __init__(self, minimax_api_key: str, opik_api_key: str):
        self.minimax_api_key = minimax_api_key
        self.opik_api_key = opik_api_key
        
        # Initialize Opik
        if opik_api_key:
            opik.configure(api_key=opik_api_key, use_local=False, automatic_approvals=True)
        
        # Initialize OpikTracer for LangChain integration
        self.opik_tracer = OpikTracer(project_name=os.getenv("OPIK_PROJECT_NAME", "SiSy"))

        # Initialize LLM with tool binding
        base_llm = ChatOpenAI(
            model="MiniMax-M2.1",
            openai_api_key=minimax_api_key,
            openai_api_base="https://api.minimax.io/v1",
            temperature=0.7,
        )
        
        # Bind tools to the LLM
        self.llm = base_llm.bind_tools(AGENT_TOOLS)
        
        # Initialize MiniMax VLM Client
        self.vlm_client = MinimaxAPIClient(minimax_api_key, "https://api.minimax.io")
        
        print("✓ SiSy Agent initialized")

    def _strip_thinking_tags(self, content: str) -> str:
        """Remove <think>...</think> tags from the response content."""
        # Remove think tags and their content
        cleaned = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
        return cleaned.strip()

    def _extract_actions_from_tool_calls(self, tool_calls: list) -> list[dict]:
        """Convert LangChain tool calls to our action format."""
        
        # Create a set of valid tool names for fast lookup
        valid_tool_names = {t.name for t in AGENT_TOOLS}
        
        actions = []
        for tc in tool_calls:
            tool_name = tc["name"]
            
            # Skip invalid/hallucinated tools
            if tool_name not in valid_tool_names:
                print(f"[Agent] Warning: Skipping invalid tool call '{tool_name}'")
                continue
                
            # Start with the tool name as the action type
            action = {"type": tool_name}
            
            # Only include non-null args
            for key, value in tc["args"].items():
                if value is not None:
                    # Sanitize time field if it contains garbage (e.g. XML tags)
                    if key == "time" and isinstance(value, str):
                        # Look for HH:MM pattern
                        match = re.search(r"(\d{1,2}:\d{2})", value)
                        if match:
                            value = match.group(1)
                            
                    action[key] = value
                    
            actions.append(action)
        return actions

    def _execute_tool(self, tool_name: str, args: dict) -> str:
        """Execute a tool and return its result."""
        tool_map = {t.name: t for t in AGENT_TOOLS}
        if tool_name in tool_map:
            try:
                return tool_map[tool_name].invoke(args)
            except Exception as e:
                return f"Error executing {tool_name}: {e}"
        return f"Unknown tool: {tool_name}"

    @track(project_name=os.getenv("OPIK_PROJECT_NAME", "SiSy"))
    async def process_message(
        self,
        text: str,
        tab: str,
        conversation_id: str | None = None,
        image_file: bytes | None = None,
        user_context: dict[str, Any] | None = None,
        message_history: list[dict[str, Any]] | None = None,
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
            current_time=current_time_str,
        )
        content: list[dict[str, Any]] | str = text
        
        if image_file:
            import base64
            # Encode image to base64
            base64_image = base64.b64encode(image_file).decode('utf-8')
            image_data_url = f"data:image/jpeg;base64,{base64_image}"
            
            # Use VLM to understand the image
            try:
                vlm_response = self.vlm_client.post("/v1/coding_plan/vlm", json={
                    "prompt": text,
                    "image_url": image_data_url
                })
                image_description = vlm_response.get("content", "Image content analysis failed.")
                
                # Append description to text
                text = f"{text}\n\n[System Note: The user attached an image. Here is the analysis of the image content: {image_description}]"
                content = text
                
            except Exception as e:
                print(f"[Agent] VLM Error: {e}")
                text = f"{text}\n\n[System Note: The user attached an image, but analysis failed.]"
                content = text

        # Build messages
        messages = [SystemMessage(content=system_prompt)]
        
        # Add history if available
        if message_history:
            for msg in message_history:
                # Skip invalid messages
                if not isinstance(msg, dict):
                    continue
                    
                role = msg.get('role')
                text_content = msg.get('text', '')
                
                # Skip empty messages
                if not text_content: 
                    continue
                    
                if role == 'user':
                    messages.append(HumanMessage(content=text_content))
                elif role == 'assistant':
                    messages.append(AIMessage(content=text_content))
        
        # Add current message
        messages.append(HumanMessage(content=content))
        
        # Call LLM with tools
        response = await self._call_llm(messages)
        
        # Extract tool calls (actions)
        tool_calls = response.tool_calls if hasattr(response, 'tool_calls') else []
        actions = self._extract_actions_from_tool_calls(tool_calls)
        
        # Extract content
        response_content = response.content if hasattr(response, 'content') else str(response)
        response_content = self._strip_thinking_tags(response_content)
        
        print(f"[Agent] Initial response: {response_content[:100] if response_content else '(empty)'}...")
        print(f"[Agent] Tool calls: {len(actions)} actions extracted")
        
        # If there are tool calls, we execute them in a loop to get a final conversational response
        if tool_calls:
            print("[Agent] Tool calls present - executing tool loop to generating final response...")
            
            # Add the AI message with tool calls to the conversation
            messages.append(response)
            
            # Execute each tool and add results as ToolMessages
            for tc in tool_calls:
                tool_result = self._execute_tool(tc["name"], tc["args"])
                messages.append(ToolMessage(
                    content=tool_result,
                    tool_call_id=tc["id"],
                ))
                print(f"[Agent] Tool '{tc['name']}' result: {tool_result}")
            
            # Call LLM again to get the final response
            final_response = await self._call_llm(messages)
            response_content = final_response.content if hasattr(final_response, 'content') else str(final_response)
            response_content = self._strip_thinking_tags(response_content)
            
            print(f"[Agent] Final response after tool loop: {response_content[:100]}...")
        
        return {
            "conversation_id": conversation_id or str(uuid.uuid4()),
            "assistant_text": response_content,
            "actions": actions,
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
