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
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from minimax_mcp.client import MinimaxAPIClient


class CreateRoutineItemAction(BaseModel):
    """Action to create a new routine item."""
    type: Literal["create_routine_item"] = "create_routine_item"
    title: str = Field(description="The title of the routine item")
    scheduled_time: str | None = Field(default=None, description="ISO-8601 string for when the item is scheduled")
    status: str | None = Field(default="pending", description="Initial status of the item (e.g., 'pending')")
    description: str | None = Field(default=None, description="Description of the routine item")


class UpdateRoutineItemAction(BaseModel):
    """Action to update an existing routine item."""
    type: Literal["update_routine_item"] = "update_routine_item"
    id: str = Field(description="The ID of the routine item to update")
    title: str | None = Field(default=None, description="The new title of the routine item")
    scheduled_time: str | None = Field(default=None, description="ISO-8601 string for when the item is scheduled")
    status: str | None = Field(default=None, description="New status of the item")
    description: str | None = Field(default=None, description="New description of the routine item")




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
    assistant_message: str = Field(
        description="The natural language response to show the user"
    )
    actions: list[CreateRoutineItemAction | UpdateRoutineItemAction | UpsertProfileFieldAction] = Field(
        default_factory=list,
        description="List of actions to perform based on the user's request"
    )


SYSTEM_PROMPT = """Current Time: {current_time}

You are SiSy, you help your user to build a better routine through iterative refinement, improve their physical, mental, and emotional well-being.

CONTEXT:
User Profile:
{user_profile}

User Routine:
{user_routine}

CORE PHILOSOPHY for routine management:
1. Make it Obvious: Suggest specific triggers, suggest clear titles and descriptions (markdown format) for routine items. 
2. Make it Attractive: Use encouraging language.
3. Make it Easy: Break complex goals into small, manageable steps and add into the description of the routine item in markdown format. 
4. Make it Satisfying: Celebrate progress and completion.


INSTRUCTIONS on assistant_message:
- assistant_message must be clear and concise, use markdown format like bullet points, bold text, etc. to make it more readable.  
- use web search if needed, make sure your information is up to date and accurate.
- Before dumping a long response to the user, summarise and ask user if they want to know more details.  
- Ask smart, easy to understand questions to help user to clarify their obstacles and goals in order to manage the routine items.

INSTRUCTIONS on actions:
- Update the User Profile when you learn new preferences or context, assign to appropriate group.
- create_routine_item: Create a new routine item.
    - MUST provide title.
    - Optional: scheduled_time, description.
- update_routine_item: Update an existing routine item.
    - MUST provide id.
    - Update only the fields that changed (title, scheduled_time, etc.).  
    - Confirm with user before updating.

Your response must follow this exact format:
{{
  "assistant_message": "Your natural language response to the user",
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

        schema = AgentResponse.model_json_schema()

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "agent_response",
                "schema": schema,
                "strict": True
            }
        }

        self.llm = ChatOpenAI(
            model="MiniMax-M2.1",
            openai_api_key=minimax_api_key,
            openai_api_base="https://api.minimax.io/v1",
            temperature=0.7,
            model_kwargs={"response_format": response_format}
        )
        
        # Initialize MiniMax VLM Client
        self.vlm_client = MinimaxAPIClient(minimax_api_key, "https://api.minimax.io")

    def _strip_thinking_tags(self, content: str) -> str:
        """Remove <think>...</think> tags from the response content."""
        # Remove think tags and their content
        cleaned = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
        return cleaned.strip()
    
    def _extract_json(self, content: str) -> dict:
        """Extract JSON from the response content and validate against AgentResponse."""
        try:
            # First strip any thinking tags
            content = self._strip_thinking_tags(content)
            
            # Find JSON in markdown code blocks if present
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                content = json_match.group(1)

            # Model output should be valid JSON
            return AgentResponse.model_validate_json(content).model_dump()
            
        except Exception as e:
            print(f"[Agent] JSON Extraction Error: {e}")
            print(f"[Agent] Raw Content: {content[:200]}...") # Log start of content for debug
            
            # Fallback for extreme cases
            return {
                "assistant_message": "Sorry, I encountered an error processing the response.",
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
        messages = [SystemMessage(content=system_prompt)]
        
        # Add history if available
        if message_history:
            for msg in message_history:
                # Skip invalid messages
                if not isinstance(msg, dict):
                    continue
                    
                role = msg.get('role')
                text_content = msg.get('text', '')
                
                # Skip empty messages if you prefer
                if not text_content: 
                    continue
                    
                if role == 'user':
                    messages.append(HumanMessage(content=text_content))
                elif role == 'assistant':
                    messages.append(AIMessage(content=text_content))
        
        # Add current message
        messages.append(HumanMessage(content=content))
        
        # Call LLM
        response = await self._call_llm(messages)
        
        # Extract content from the response
        response_content = response.content if hasattr(response, 'content') else str(response)
        
        # Parse the JSON response
        parsed = self._extract_json(response_content)
        
        return {
            "conversation_id": conversation_id or str(uuid.uuid4()),
            "assistant_text": parsed.get("assistant_message", response_content),
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

