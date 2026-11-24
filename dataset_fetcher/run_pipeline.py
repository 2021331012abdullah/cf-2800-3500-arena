import argparse
import sys
import time

def print_banner():
    banner = """
================================================================================
   CODEFORCES 2800-3500 DATASET FETCHER PIPELINE
   Target: 1,465 Grandmaster Problems
   Per Problem: 
     1. Full Problem Statement HTML & Structured JSON
     2. Full Editorial / Tutorial with Hints & Codes
     3. 100 Random Accepted Submissions Metadata
     4. 100 Source Code Files
================================================================================
"""
    print(banner)

def main():
    parser = argparse.ArgumentParser(description="Codeforces Dataset Fetcher Pipeline")
    parser.add_argument("--stage", type=str, default="all", choices=["all", "1", "2", "3", "4", "meta"],
                        help="Which stage to run: 1 (statements), 2 (editorials), 3 (sample 100 subs), 4 (download sources), meta (1+2+3), all")
    parser.add_argument("--limit-problems", type=int, default=None,
                        help="Limit number of problems to process (useful for testing)")
    parser.add_argument("--subs-per-prob", type=int, default=100,
                        help="Submissions to download per problem (default 100)")
    args = parser.parse_args()

    print_banner()

    start_total = time.time()

    # Stage 1: Problem Statements
    if args.stage in ["all", "meta", "1"]:
        from stage1_statements import fetch_all_statements
        fetch_all_statements(limit=args.limit_problems)

    # Stage 2: Editorials
    if args.stage in ["all", "meta", "2"]:
        from stage2_editorials import fetch_all_editorials
        fetch_all_editorials(limit=args.limit_problems)

    # Stage 3: Sample 100 Submissions Metadata
    if args.stage in ["all", "meta", "3"]:
        from stage3_sample_submissions import fetch_all_submission_metadata
        fetch_all_submission_metadata()

    # Stage 4: Download Source Codes
    if args.stage in ["all", "4"]:
        from stage4_download_sources import download_all_sources
        download_all_sources(prob_limit=args.limit_problems, subs_per_prob=args.subs_per_prob)

    elapsed_total = time.time() - start_total
    hours = int(elapsed_total // 3600)
    minutes = int((elapsed_total % 3600) // 60)
    seconds = int(elapsed_total % 60)
    print(f"\nPipeline finished in {hours}h {minutes}m {seconds}s!")

if __name__ == "__main__":
    main()
