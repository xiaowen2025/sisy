"""
Test script to send a single message to the SiSy agent and log processing/response.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

from dotenv import load_dotenv


test_message = "My age is 35, female, I work as a software engineer"


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


async def test_agent_directly():
    """Test the agent directly without going through the HTTP server."""
    from agent import SiSyAgent

    # Load environment variables
    load_dotenv()

    api_key = os.getenv("MINIMAX_API_KEY", "")
    opik_key = os.getenv("OPIK_API_KEY", "")

    if not api_key:
        logger.error("MINIMAX_API_KEY is not set in .env")
        return

    logger.info("=" * 60)
    logger.info("SiSy Agent Test Script")
    logger.info("=" * 60)

    # Initialize agent
    logger.info("Initializing SiSy agent...")
    agent = SiSyAgent(minimax_api_key=api_key, opik_api_key=opik_key)
    logger.info("✓ Agent initialized successfully")

    # Test message
    test_tab = "present"

    logger.info("-" * 60)
    logger.info(f"Sending test message: '{test_message}'")
    logger.info(f"Tab context: {test_tab}")
    logger.info("-" * 60)

    start_time = datetime.now()

    try:
        # Process the message
        logger.info("Processing message...")
        response = await agent.process_message(
            text=test_message,
            tab=test_tab,
            conversation_id=None,
            image_uri=None,
        )

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        logger.info("=" * 60)
        logger.info("RESPONSE RECEIVED")
        logger.info("=" * 60)
        logger.info(f"Processing time: {duration:.2f} seconds")
        logger.info(f"Conversation ID: {response['conversation_id']}")
        logger.info("-" * 60)
        logger.info("Assistant text:")
        logger.info(f"  {response['assistant_text']}")
        logger.info("-" * 60)
        logger.info(f"Actions ({len(response['actions'])} total):")
        for i, action in enumerate(response['actions'], 1):
            logger.info(f"  Action {i}:")
            for key, value in action.items():
                logger.info(f"    {key}: {value}")
        logger.info("=" * 60)

        # Flush Opik traces
        logger.info("Flushing Opik traces...")
        await agent.flush()
        logger.info("✓ Traces flushed")

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)


async def test_via_http():
    """Test the agent via HTTP request to the running server."""
    import httpx

    url = "http://localhost:8000/chat"
    payload = {
        "text": "Create a task to go grocery shopping tomorrow at 3pm",
        "tab": "present",
        "conversation_id": None,
        "imageUri": None,
        "user_context": '{"profile": {"is_active": true, "score": 100}, "routine": []}'
    }

    logger.info("=" * 60)
    logger.info("Testing via HTTP POST to /chat")
    logger.info("=" * 60)
    logger.info(f"URL: {url}")
    logger.info(f"Payload: {payload}")
    logger.info("-" * 60)

    start_time = datetime.now()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, data=payload, timeout=30.0)
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            logger.info(f"Status code: {response.status_code}")
            logger.info(f"Processing time: {duration:.2f} seconds")

            if response.status_code == 200:
                data = response.json()
                logger.info("=" * 60)
                logger.info("RESPONSE RECEIVED")
                logger.info("=" * 60)
                logger.info(f"Conversation ID: {data['conversation_id']}")
                logger.info("-" * 60)
                logger.info("Assistant text:")
                logger.info(f"  {data['assistant_text']}")
                logger.info("-" * 60)
                logger.info(f"Actions ({len(data['actions'])} total):")
                for i, action in enumerate(data['actions'], 1):
                    logger.info(f"  Action {i}:")
                    for key, value in action.items():
                        if value is not None:
                            logger.info(f"    {key}: {value}")
                logger.info("=" * 60)
            else:
                logger.error(f"Error response: {response.text}")

        except httpx.ConnectError:
            logger.error("Could not connect to server at localhost:8000")
            logger.info("Make sure the server is running: python main.py")
        except Exception as e:
            logger.error(f"HTTP request failed: {e}", exc_info=True)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test SiSy Agent")
    parser.add_argument(
        "--mode",
        choices=["direct", "http"],
        default="direct",
        help="Test mode: 'direct' tests agent directly, 'http' tests via HTTP server",
    )
    args = parser.parse_args()

    if args.mode == "direct":
        asyncio.run(test_agent_directly())
    else:
        asyncio.run(test_via_http())
