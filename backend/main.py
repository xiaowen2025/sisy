"""
SiSy Backend - FastAPI server for AI chat with LangChain and Opik tracing.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


# Request/Response models matching frontend types
class ChatAction(BaseModel):
    type: str
    title: str | None = None
    scheduled_time: str | None = None
    task_id: str | None = None
    key: str | None = None
    value: str | None = None
    group: str | None = None
    source: str | None = None


class ChatSendRequest(BaseModel):
    conversation_id: str | None = None
    tab: str
    text: str
    imageUri: str | None = None


class ChatSendResponse(BaseModel):
    conversation_id: str
    assistant_text: str
    actions: list[ChatAction]


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "agent_ready": agent is not None}


@app.post("/chat", response_model=ChatSendResponse)
async def chat(request: ChatSendRequest):
    """Process a chat message and return AI response with actions."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.process_message(
            text=request.text,
            tab=request.tab,
            conversation_id=request.conversation_id,
            image_uri=request.imageUri,
        )
        return ChatSendResponse(**result)
    except Exception as e:
        print(f"[Chat Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
