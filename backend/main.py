"""
SiSy Backend - FastAPI server for AI chat with LangChain and Opik tracing.
"""

import os
import json
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from agent import SiSyAgent

# Load environment variables
load_dotenv()

# Initialize agent (will be set in lifespan)
agent: SiSyAgent | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources."""
    global agent
    api_key = os.getenv("MINIMAX_API_KEY", "")
    opik_key = os.getenv("OPIK_API_KEY", "")
    
    if not api_key:
        raise RuntimeError("MINIMAX_API_KEY is not set")
    
    agent = SiSyAgent(minimax_api_key=api_key, opik_api_key=opik_key)
    print("✓ SiSy Agent initialized")
    yield
    # Cleanup
    if agent:
        await agent.flush()


app = FastAPI(
    title="SiSy Backend",
    description="AI chat backend for SiSy daily planning assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount static files
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")


# Request/Response models matching frontend types
class ChatAction(BaseModel):
    """Flexible action model that accepts any action type."""
    model_config = {"extra": "allow"}  # Allow extra fields
    
    type: str
    # Optional common fields - will be included only if present
    title: str | None = None
    time: str | None = None  # HH:MM format
    description: str | None = None
    id: str | None = None
    
    # Profile fields
    key: str | None = None
    value: str | None = None
    group: str | None = None


class ChatSendRequest(BaseModel):
    conversation_id: str | None = None
    tab: str
    text: str
    imageUri: str | None = None
    user_context: str | None = None # JSON stringified context
    message_history: str | None = None # JSON stringified history


class ChatSendResponse(BaseModel):
    model_config = {"exclude_none": True}  # Exclude null values from response
    
    conversation_id: str
    assistant_text: str
    actions: list[ChatAction]



# Auth dependency
async def get_current_user_id(x_install_id: str = Header(..., description="Device/Installation ID")):
    """
    Validate that X-Install-Id is present.
    In the future, this can be used to load user context from DB.
    """
    if not x_install_id:
        raise HTTPException(status_code=400, detail="X-Install-Id header is required")
    return x_install_id


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "agent_ready": agent is not None}


@app.post("/chat", response_model=ChatSendResponse, response_model_exclude_none=True)
async def chat(
    text: str = Form(...),
    tab: str = Form("home"),
    conversation_id: str | None = Form(None),
    image: UploadFile | None = File(None),
    user_context: str | None = Form(None),
    message_history: str | None = Form(None),
    user_id: str = Depends(get_current_user_id),
):
    """Process a chat message and return AI response with actions."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    print(f"[Chat] Request from user_id: {user_id}")

    # Parse user context if provided
    context_data = None
    if user_context:
        try:
            # First try parsing as a string if it's double-encoded
            if isinstance(user_context, str):
                try:
                    context_data = json.loads(user_context)
                except json.JSONDecodeError:
                    # If simple json.loads fails, it might be safe to try, or just log error
                    # But for now, let's assume valid JSON string is passed.
                    # One edge case: if it's already a dict (FastAPI/Pydantic magic?), but here it is defined as str.
                    print(f"[Chat Warning] Failed to parse user_context JSON: {user_context}")
            else:
                # If it's somehow already an object? Unlikely given signature
                context_data = user_context
        except Exception as e:
            print(f"[Chat Warning] Error processing user_context: {e}")

    # Parse message history if provided
    history_data = []
    if message_history:
        try:
            if isinstance(message_history, str):
                try:
                    history_data = json.loads(message_history)
                except json.JSONDecodeError:
                    print(f"[Chat Warning] Failed to parse message_history JSON: {message_history}")
            else:
                history_data = message_history
        except Exception as e:
            print(f"[Chat Warning] Error processing message_history: {e}")

    image_data = None
    if image:
        image_data = await image.read()

    try:
        result = await agent.process_message(
            text=text,
            tab=tab,
            conversation_id=conversation_id,
            image_file=image_data,
            user_context=context_data,
            message_history=history_data,
        )
        return ChatSendResponse(**result)
    except Exception as e:
        print(f"[Chat Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Mount static files (frontend)
# We mount at root but need to be careful not to shadow API routes
# The order matters: API routes are defined first, so they take precedence.
app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

# Serve specific static files if needed (e.g. manifest, icons)
# For a clean SPA, we usually serve index.html for everything else.

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve the Single Page Application (SPA)."""
    # Check if a specific file exists in static (e.g. favicon.png)
    possible_file = os.path.join("static", full_path)
    if os.path.isfile(possible_file):
         return FileResponse(possible_file)
    
    # Otherwise return index.html for client-side routing
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
        
    return {"error": "Frontend not found (static/index.html missing)"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 10001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
