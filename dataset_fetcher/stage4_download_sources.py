import json
import os
import random
import time
from bs4 import BeautifulSoup
from curl_cffi import requests
from config import (
    PROBLEMS_JSON_PATH,
    PROBLEMS_DIR,
    DEFAULT_HEADERS,
    DEFAULT_IMPERSONATE,
    MIN_WORKER_DELAY,
    MAX_WORKER_DELAY
)

def download_sources_for_problem(session, prob, max_subs=100):
    pid = prob["id"]
    cid = prob["contestId"]
    prob_folder = os.path.join(PROBLEMS_DIR, pid)
    meta_path = os.path.join(prob_folder, "submissions_metadata.json")
    subs_dir = os.path.join(prob_folder, "submissions")
    os.makedirs(subs_dir, exist_ok=True)

    if not os.path.exists(meta_path):
        return 0, 0

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    target_subs = meta.get("submissions", [])[:max_subs]
    downloaded_count = 0
    already_cached = 0

    for s in target_subs:
        sid = s["id"]
        handle = s["handle"]
        lang = s.get("lang", "").lower()
        
        # Determine extension
        ext = ".cpp"
        if "py" in lang:
            ext = ".py"
        elif "java" in lang:
            ext = ".java"
        elif "rust" in lang:
            ext = ".rs"
        elif "kotlin" in lang:
            ext = ".kt"

        file_path = os.path.join(subs_dir, f"{sid}_{handle}{ext}")

        if os.path.exists(file_path) and os.path.getsize(file_path) > 30:
            already_cached += 1
            continue

        url = f"https://codeforces.com/contest/{cid}/submission/{sid}"
        try:
            r = session.get(url, timeout=20)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                pre = soup.find("pre", id="program-source-text")
                if pre:
                    code = pre.get_text()
                    with open(file_path, "w", encoding="utf-8") as fp:
                        fp.write(code)
                    downloaded_count += 1
            elif r.status_code == 429:
                print(f"Rate limited (429) on sub {sid}. Backing off 10s...")
                time.sleep(10)
        except Exception as e:
            print(f"Error fetching sub {sid}: {e}")

        time.sleep(random.uniform(MIN_WORKER_DELAY, MAX_WORKER_DELAY))

    return downloaded_count, already_cached

def download_all_sources(prob_limit=None, subs_per_prob=100):
    with open(PROBLEMS_JSON_PATH, "r", encoding="utf-8") as f:
        problems = json.load(f)

    if prob_limit:
        problems = problems[:prob_limit]

    print(f"=== Stage 4: Downloading Source Codes for {len(problems)} Problems ===")
    session = requests.Session(impersonate=DEFAULT_IMPERSONATE)
    session.headers.update(DEFAULT_HEADERS)

    total_downloaded = 0
    for idx, prob in enumerate(problems):
        pid = prob["id"]
        new_dl, cached = download_sources_for_problem(session, prob, max_subs=subs_per_prob)
        total_downloaded += new_dl
        print(f"[{idx+1}/{len(problems)}] Problem {pid}: {new_dl} downloaded, {cached} cached")

    print(f"Stage 4 Finished! Total new source files downloaded: {total_downloaded}")

if __name__ == "__main__":
    download_all_sources()
