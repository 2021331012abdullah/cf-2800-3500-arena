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
    out_html_path = os.path.join(prob_folder, "editorial.html")
    out_pdf_path = os.path.join(prob_folder, "editorial.pdf")

    if os.path.exists(out_html_path) and os.path.getsize(out_html_path) > 200:
        return True, "cached_html"
    if os.path.exists(out_pdf_path) and os.path.getsize(out_pdf_path) > 500:
        return True, "cached_pdf"

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
                        with open(out_html_path, "w", encoding="utf-8") as f:
                            f.write(html_content)
                        return True, "ajax_tutorial"
                except Exception:
                    pass
        except Exception:
            pass

    # Strategy 2: Check problem statement sidebar for editorial/tutorial or PDF link
    stmt_path = os.path.join(prob_folder, "problem_statement.html")
    candidate_urls = []
    if os.path.exists(stmt_path):
        try:
            with open(stmt_path, "r", encoding="utf-8") as f:
                soup = BeautifulSoup(f.read(), "html.parser")
            for a in soup.find_all("a", href=True):
                text = a.get_text().strip().lower()
                href = a["href"].strip()
                if any(w in text for w in ["tutorial", "editorial", "solution", "analysis"]) or href.lower().endswith(".pdf") or ".pdf" in href.lower():
                    full_url = f"https://codeforces.com{href}" if href.startswith("/") else href
                    candidate_urls.append(full_url)
        except Exception:
            pass

    for blog_url in candidate_urls[:3]:
        try:
            r = session.get(blog_url, timeout=25)
            if r.status_code == 200:
                is_pdf = (
                    blog_url.lower().endswith(".pdf") or
                    r.content.startswith(b"%PDF-") or
                    "application/pdf" in r.headers.get("Content-Type", "").lower()
                )

                if is_pdf:
                    with open(out_pdf_path, "wb") as f:
                        f.write(r.content)
                    return True, "pdf_downloaded"
                else:
                    with open(out_html_path, "w", encoding="utf-8") as f:
                        f.write(r.text)

                    # Check if HTML points to an attached PDF
                    if ".pdf" in r.text.lower():
                        soup = BeautifulSoup(r.text, "html.parser")
                        for a in soup.find_all("a", href=True):
                            h_url = a["href"].strip()
                            if ".pdf" in h_url.lower():
                                pdf_target = f"https://codeforces.com{h_url}" if h_url.startswith("/") else h_url
                                try:
                                    r_subpdf = session.get(pdf_target, timeout=25)
                                    if r_subpdf.status_code == 200 and r_subpdf.content.startswith(b"%PDF-"):
                                        with open(out_pdf_path, "wb") as pf:
                                            pf.write(r_subpdf.content)
                                        break
                                except Exception:
                                    pass

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
