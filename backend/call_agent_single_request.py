"""
Single request script to call the SiSy agent and log detailed processing/response.
Includes frontend validation to verify API responses will work correctly in the app.
"""

import asyncio
import logging
import os
import re
import sys
from datetime import datetime

from dotenv import load_dotenv


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# --- Frontend-like validation helpers ---

def is_valid_hhmm_format(time_str: str | None) -> bool:
    """Check if time string matches HH:MM format (24-hour)."""
    if time_str is None:
        return True  # None is valid (no time set)
    return bool(re.match(r"^\d{1,2}:\d{2}$", time_str))


def validate_action_for_frontend(action: dict) -> list[str]:
    """
    Validate that an action from the API can be processed by the frontend.
    Returns a list of validation errors (empty if valid).
    """
    errors = []
    action_type = action.get("type")
    
    if action_type == "upsert_routine_item":
        time_value = action.get("time")
        if time_value is not None:
            if not is_valid_hhmm_format(time_value):
                errors.append(
                    f"time '{time_value}' is not in HH:MM format. "
                    "Frontend expects HH:MM (e.g., '08:00', '14:30')"
                )
    
    if action_type == "upsert_profile_field":
        if "key" not in action:
            errors.append("upsert_profile_field missing 'key'")
        if "value" not in action:
            errors.append("upsert_profile_field missing 'value'")
    
    return errors


async def call_agent(message: str, tab: str = "home"):
    """Call the agent with a single message and log detailed response."""
    from agent import SiSyAgent

    # Load environment variables
    load_dotenv()

    api_key = os.getenv("MINIMAX_API_KEY", "")
    opik_key = os.getenv("OPIK_API_KEY", "")

    if not api_key:
        logger.error("MINIMAX_API_KEY is not set in .env")
        return None

    logger.info("=" * 60)
    logger.info("SiSy Agent - Single Request")
    logger.info("=" * 60)

    # Initialize agent
    logger.info("Initializing SiSy agent...")
    agent = SiSyAgent(minimax_api_key=api_key, opik_api_key=opik_key)
    logger.info("✓ Agent initialized successfully")

    logger.info("-" * 60)
    logger.info(f"Message: '{message}'")
    logger.info(f"Tab: {tab}")
    logger.info("-" * 60)

    start_time = datetime.now()

    try:
        # Process the message
        logger.info("Processing message...")
        response = await agent.process_message(
            text=message,
            tab=tab,
            conversation_id=None,
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
        
        all_valid = True
        for i, action in enumerate(response['actions'], 1):
            logger.info(f"  Action {i}:")
            for key, value in action.items():
                if value is not None:
                    logger.info(f"    {key}: {value}")
            
            # Validate action format for frontend compatibility
            errors = validate_action_for_frontend(action)
            if errors:
                logger.warning(f"  ⚠ Frontend validation errors:")
                for err in errors:
                    logger.warning(f"      - {err}")
                all_valid = False
            else:
                logger.info("  ✓ Action format valid for frontend")
        
        logger.info("=" * 60)
        if all_valid:
            logger.info("✓ All actions are valid for frontend processing")
        else:
            logger.warning("⚠ Some actions have frontend validation errors")
        logger.info("=" * 60)

        # Flush Opik traces
        logger.info("Flushing Opik traces...")
        await agent.flush()
        logger.info("✓ Traces flushed")
        
        return response

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        return None


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Call SiSy Agent with a single message")
    parser.add_argument(
        "message",
        nargs="?",
        default="Create a routine for brushing teeth at 8am",
        help="The message to send to the agent",
    )
    parser.add_argument(
        "--tab",
        choices=["home", "routine", "me"],
        default="routine",
        help="Tab context for the message",
    )
    args = parser.parse_args()

    asyncio.run(call_agent(args.message, args.tab))
