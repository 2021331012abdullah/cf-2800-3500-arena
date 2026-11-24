import os

# Base Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "cf_dataset")
PROBLEMS_DIR = os.path.join(DATASET_DIR, "problems")
CHECKPOINTS_DIR = os.path.join(DATASET_DIR, "checkpoints")

os.makedirs(PROBLEMS_DIR, exist_ok=True)
os.makedirs(CHECKPOINTS_DIR, exist_ok=True)

# Problem metadata source
PROBLEMS_JSON_PATH = os.path.join(os.path.dirname(BASE_DIR), "cf_2800_3500_sorted.json")

# Checkpoint files
STATEMENT_CHECKPOINT = os.path.join(CHECKPOINTS_DIR, "checkpoint_statements.json")
EDITORIAL_CHECKPOINT = os.path.join(CHECKPOINTS_DIR, "checkpoint_editorials.json")
SUBS_METADATA_CHECKPOINT = os.path.join(CHECKPOINTS_DIR, "checkpoint_subs_metadata.json")
SOURCES_CHECKPOINT = os.path.join(CHECKPOINTS_DIR, "checkpoint_sources.json")

# Scraping Settings
SUBMISSIONS_PER_PROBLEM = 100
MIN_WORKER_DELAY = 0.5
MAX_WORKER_DELAY = 1.2
MAX_WORKERS = 4

# Impersonate browser
DEFAULT_IMPERSONATE = "chrome"

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://codeforces.com/problemset",
}
