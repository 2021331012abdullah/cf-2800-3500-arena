import json
import os
import random
import re
import time
from bs4 import BeautifulSoup
from curl_cffi import requests
from config import (
    PROBLEMS_JSON_PATH,
    PROBLEMS_DIR,
    EDITORIAL_CHECKPOINT,
    DEFAULT_HEADERS,
    DEFAULT_IMPERSONATE,
    MIN_WORKER_DELAY,
    MAX_WORKER_DELAY
)

def load_checkpoint():
    if os.path.exists(EDITORIAL_CHECKPOINT):
        try:
            with open(EDITORIAL_CHECKPOINT, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_checkpoint(completed_ids):
    with open(EDITORIAL_CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump(list(completed_ids), f, indent=2)

def get_csrf_token(session):
    try:
        r = session.get("https://codeforces.com/", timeout=15)
        m = re.search(r'data-csrf=[\'"]([a-f0-9]+)[\'"]', r.text)
        if m:
            return m.group(1)
    except Exception:
        pass
    return None

def fetch_editorial_for_problem(session, prob, csrf_token):
    pid = prob["id"]
    cid = prob["contestId"]
    index = prob["index"]
    prob_folder = os.path.join(PROBLEMS_DIR, pid)
    os.makedirs(prob_folder, exist_ok=True)
    out_path = os.path.join(prob_folder, "editorial.html")

    if os.path.exists(out_path) and os.path.getsize(out_path) > 200:
        return True, "cached"

    # Strategy 1: problemTutorial AJAX endpoint
    if csrf_token:
        try:
            tut_resp = session.post(
                "https://codeforces.com/data/problemTutorial",
                data={"problemCode": f"{cid}{index}", "csrf_token": csrf_token},
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": f"https://codeforces.com/problemset/problem/{cid}/{index}"
                },
                timeout=15
            )
            if tut_resp.status_code == 200:
                try:
                    data = tut_resp.json()
                    if data.get("success") == "true" and data.get("html"):
                        html_content = data["html"]
                        with open(out_path, "w", encoding="utf-8") as f:
                            f.write(html_content)
                        return True, "ajax_tutorial"
                except Exception:
                    pass
        except Exception:
            pass

    # Strategy 2: Check problem statement sidebar for editorial/tutorial blog link
    stmt_path = os.path.join(prob_folder, "problem_statement.html")
    blog_url = None
    if os.path.exists(stmt_path):
        with open(stmt_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")
        for a in soup.find_all("a", href=True):
            text = a.get_text().strip().lower()
            if "tutorial" in text or "editorial" in text:
                href = a["href"]
                if href.startswith("/"):
                    blog_url = f"https://codeforces.com{href}"
                elif href.startswith("http"):
                    blog_url = href
                break

    if blog_url:
        try:
            r = session.get(blog_url, timeout=20)
            if r.status_code == 200:
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write(r.text)
                return True, "blog_page"
        except Exception:
            pass

    return False, "not_found"

def fetch_all_editorials(limit=None):
    with open(PROBLEMS_JSON_PATH, "r", encoding="utf-8") as f:
        problems = json.load(f)

    completed = load_checkpoint()
    pending = [p for p in problems if p["id"] not in completed]
    if limit:
        pending = pending[:limit]

    print(f"=== Stage 2: Problem Editorials & Hints ===")
    print(f"Total problems: {len(problems)} | Already cached: {len(completed)} | Pending: {len(pending)}")

    if not pending:
        print("All problem editorials already fetched!")
        return

    session = requests.Session(impersonate=DEFAULT_IMPERSONATE)
    session.headers.update(DEFAULT_HEADERS)
    csrf = get_csrf_token(session)

    start_time = time.time()
    success_count = 0

    for idx, prob in enumerate(pending):
        pid = prob["id"]
        ok, method = fetch_editorial_for_problem(session, prob, csrf)

        if ok:
            completed.add(pid)
            success_count += 1

        elapsed = time.time() - start_time
        avg_time = elapsed / max(1, idx + 1)
        remaining = (len(pending) - (idx + 1)) * avg_time
        rem_m = int(remaining // 60)
        rem_s = int(remaining % 60)

        if (idx + 1) % 10 == 0 or idx == len(pending) - 1:
            print(f"[{idx+1}/{len(pending)}] {pid} -> {method} | ETA: {rem_m}m {rem_s}s")
            save_checkpoint(completed)

        time.sleep(random.uniform(MIN_WORKER_DELAY, MAX_WORKER_DELAY))

    save_checkpoint(completed)
    print(f"Completed Stage 2! Total editorials fetched: {success_count}")

if __name__ == "__main__":
    fetch_all_editorials()
