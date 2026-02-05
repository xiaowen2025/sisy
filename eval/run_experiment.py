import logging
import os
import sys
from dotenv import load_dotenv
from opik import Opik
from opik.evaluation import evaluate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

try:
    import utils
except ImportError:
    # Handle case where we might be running from parent dir
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import utils

def main():
    load_dotenv()
    
    logger.info("Starting Experiment Run (No LLM Judge)...")
    
    # Setup Opik
    client = Opik(project_name=utils.PROJECT_NAME)
    
    # Load Dataset
    local_items = utils.load_local_dataset()
    dataset = utils.get_or_create_opik_dataset(client, local_items)
    
    # Config
    experiment_config = {
        "model": "MiniMax-M2.1",
        "agent": "SiSyAgent",
        "type": "run_only"
    }
    
    # Experiment Name
    custom_name = os.getenv("EXPERIMENT_NAME")
    experiment_name = custom_name if custom_name else f"SiSy Run {os.urandom(4).hex()}"
    
    logger.info(f"Running experiment: {experiment_name}")
    logger.info(f"Dataset: {utils.DATASET_NAME}")

    # Run Evaluation (No Metrics)
    results = evaluate(
        dataset=dataset,
        task=utils.evaluation_task,
        scoring_metrics=[], # No metrics
        project_name=utils.PROJECT_NAME,
        experiment_config=experiment_config,
        experiment_name=experiment_name
    )
    
    logger.info(f"Experiment '{experiment_name}' completed.")
    logger.info(f"Check the Opik dashboard for traces.")

if __name__ == "__main__":
    main()
