"""
Upload evaluation dataset to Opik.

This script creates a dataset on Opik for evaluating the SiSy daily planning assistant.
The dataset contains test cases with user inputs and expected outputs/actions.

Usage:
    python upload_dataset.py
    
Environment variables:
    OPIK_API_KEY: Your Opik API key (required)
"""

import os
import sys
from pathlib import Path

# Add backend directory to path for dotenv loading
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
import opik
from opik import Opik

# Load environment variables from backend/.env
load_dotenv(backend_dir / ".env")


# Dataset name
DATASET_NAME = "SiSy Agent Evaluation"
DATASET_DESCRIPTION = """
Evaluation dataset for the SiSy daily planning assistant.
Contains test cases for:
- Task creation and management
- Profile attribute updates
- Routine loading and editing
- General conversation and help requests
"""

# Test cases for the SiSy agent
# Each item has: input (user message), tab context, and expected_output (what the agent should do)
DATASET_ITEMS = [
    {
        "input": "My age is 35, female, I work as a software engineer",
        "tab": "me",
        "expected_action_type": "set_attribute",
        "expected_output": {
            "should_update_profile": True,
            "attribute_key": "age",
            "attribute_value": "35",
        },
    },
    {
        "input": "I prefer waking up early, around 6am",
        "tab": "me",
        "expected_action_type": "set_attribute",
        "expected_output": {
            "should_update_profile": True,
            "attribute_key_contains": "wake",
        },
    },
    # Conversational / help tests
    {
        "input": "What can you help me with?",
        "tab": "present",
        "expected_action_type": "none",
        "expected_output": {
            "should_explain_capabilities": True,
            "response_should_mention": ["task", "routine", "schedule"],
        },
    }
]


def main():
    """Create and populate the SiSy evaluation dataset on Opik."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Upload evaluation dataset to Opik")
    parser.add_argument("--clear", action="store_true", help="Clear all existing items in the dataset before uploading")
    args = parser.parse_args()

    # Check for API key
    api_key = os.getenv("OPIK_API_KEY")
    if not api_key:
        print("Error: OPIK_API_KEY environment variable is not set.", flush=True)
        print("Please set it in backend/.env or as an environment variable.", flush=True)
        sys.exit(1)
    
    print("Connecting to Opik...", flush=True)
    
    # Configure Opik
    opik.configure(api_key=api_key)
    
    # Create client
    client = Opik()
    
    # Create or get the dataset
    print(f"Creating/getting dataset: {DATASET_NAME}", flush=True)
    dataset = client.get_or_create_dataset(
        name=DATASET_NAME,
        description=DATASET_DESCRIPTION,
    )
    
    print(f"Dataset obtained successfully", flush=True)
    
    # Clear if requested
    if args.clear:
        print("Clearing existing items (creating new version)...", flush=True)
        dataset.clear()
        print("✓ Dataset cleared", flush=True)
    
    # Insert items
    print(f"Inserting {len(DATASET_ITEMS)} test cases...", flush=True)
    dataset.insert(DATASET_ITEMS)
    
    print(f"✓ Successfully uploaded {len(DATASET_ITEMS)} items to dataset '{DATASET_NAME}'", flush=True)
    print(f"\nDataset is ready for evaluation experiments.", flush=True)
    print(f"You can view it at: https://www.comet.com/opik", flush=True)


if __name__ == "__main__":
    main()
