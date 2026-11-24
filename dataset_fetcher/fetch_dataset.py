#!/usr/bin/env python3
"""
================================================================================
   CODEFORCES 2800-3500 DATASET FETCHER
   Fetches:
     1. Full Problem Statement (HTML + parsed JSON)
     2. Full Editorial / Tutorial (HTML with hints, codes, comments)
     3. 100 Random Historical AC Submissions Metadata
     4. 100 Source Code Files per Problem
   Features:
     - Progress bar with live ETA and statistics
     - Immediate saving and checkpointing after every single item
     - Graceful stop upon Cloudflare challenge / cookie expiration
     - Instant resumption from exact stopping point with updated token/cookie
================================================================================
"""

import argparse
import json
import os
import random
import re
import sys
import time
from collections import defaultdict
from bs4 import BeautifulSoup
from curl_cffi import requests
from tqdm import tqdm

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
DATASET_DIR = os.path.join(BASE_DIR, "cf_dataset")
PROBLEMS_DIR = os.path.join(DATASET_DIR, "problems")
CHECKPOINTS_DIR = os.path.join(DATASET_DIR, "checkpoints")
COOKIE_FILE = os.path.join(BASE_DIR, "cookie.txt")
PROBLEMS_JSON = os.path.join(ROOT_DIR, "cf_2800_3500_sorted.json")

os.makedirs(PROBLEMS_DIR, exist_ok=True)
os.makedirs(CHECKPOINTS_DIR, exist_ok=True)

# Checkpoint paths
CONTESTS_CACHE_FILE = os.path.join(CHECKPOINTS_DIR, "contests_status_cache.json")
CHECKPOINT_DONE_FILE = os.path.join(CHECKPOINTS_DIR, "checkpoint_completed_problems.json")

# Bot challenge signatures
CHALLENGE_SIGNATURES = [
    "Your browser is being checked",
    "Please wait. Your browser is being checked",
    "cf_clearance",
    "challenge-running",
    "Just a moment...",
    "Attention Required! | Cloudflare"
]

def load_cookie():
    """Load cookie string from cookie.txt if available."""
    if os.path.exists(COOKIE_FILE):
        try:
            with open(COOKIE_FILE, "r", encoding="utf-8") as f:
                c = f.read().strip()
                if c:
                    return c
        except Exception:
            pass
    return None

def is_bot_challenge(html_text):
    """Check if returned HTML is a Cloudflare or Codeforces anti-bot challenge page."""
    if not html_text:
        return True
    for sig in CHALLENGE_SIGNATURES:
        if sig in html_text:
            return True
    return False

def build_session(user_agent=None, cookie=None):
    session = requests.Session(impersonate="firefox" if (user_agent and "Firefox" in user_agent) else "chrome")
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://codeforces.com/problemset",
    }
    if user_agent:
        headers["User-Agent"] = user_agent
    if cookie:
        headers["Cookie"] = cookie
    session.headers.update(headers)
    return session

def load_completed():
    if os.path.exists(CHECKPOINT_DONE_FILE):
        try:
            with open(CHECKPOINT_DONE_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_completed(completed_set):
    with open(CHECKPOINT_DONE_FILE, "w", encoding="utf-8") as f:
        json.dump(list(completed_set), f, indent=2)

def load_contests_cache():
    if os.path.exists(CONTESTS_CACHE_FILE):
        try:
            with open(CONTESTS_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_contests_cache(cache):
    with open(CONTESTS_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f)

# ----------------- STAGE 1: PROBLEM STATEMENT -----------------
def fetch_statement(session, prob, prob_folder):
    pid = prob["id"]
    cid = prob["contestId"]
    idx = prob["index"]
    stmt_html_path = os.path.join(prob_folder, "problem_statement.html")
    stmt_json_path = os.path.join(prob_folder, "statement_data.json")

    if os.path.exists(stmt_html_path) and os.path.getsize(stmt_html_path) > 300:
        return True, "cached"

    url = f"https://codeforces.com/problemset/problem/{cid}/{idx}?locale=en"
    r = session.get(url, timeout=20)

    if r.status_code == 403 or is_bot_challenge(r.text):
        return False, "cloudflare_block"

    if r.status_code == 200:
        with open(stmt_html_path, "w", encoding="utf-8") as f:
            f.write(r.text)

        soup = BeautifulSoup(r.text, "html.parser")
        stmt_div = soup.find("div", class_="problem-statement")
        if stmt_div:
            title_el = stmt_div.find("div", class_="title")
            time_el = stmt_div.find("div", class_="time-limit")
            mem_el = stmt_div.find("div", class_="memory-limit")
            samples_div = stmt_div.find("div", class_="sample-test")
            samples = []
            if samples_div:
                inputs = [i.find("pre").get_text("\n", strip=True) for i in samples_div.find_all("div", class_="input") if i.find("pre")]
                outputs = [o.find("pre").get_text("\n", strip=True) for o in samples_div.find_all("div", class_="output") if o.find("pre")]
                for inp, outp in zip(inputs, outputs):
                    samples.append({"input": inp, "output": outp})

            data = {
                "id": pid,
                "contestId": cid,
                "index": idx,
                "name": prob.get("name"),
                "rating": prob.get("rating"),
                "title": title_el.get_text(strip=True) if title_el else "",
                "timeLimit": time_el.get_text(strip=True) if time_el else "",
                "memoryLimit": mem_el.get_text(strip=True) if mem_el else "",
                "samples": samples
            }
            with open(stmt_json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

        return True, "fetched"
    return False, f"http_{r.status_code}"

# ----------------- STAGE 2: EDITORIAL -----------------
def fetch_editorial(session, prob, prob_folder, csrf_token):
    pid = prob["id"]
    cid = prob["contestId"]
    idx = prob["index"]
    ed_html_path = os.path.join(prob_folder, "editorial.html")
    ed_pdf_path = os.path.join(prob_folder, "editorial.pdf")

    # If either HTML or PDF already exists and has valid size, skip
    if os.path.exists(ed_html_path) and os.path.getsize(ed_html_path) > 200:
        return True, "cached_html"
    if os.path.exists(ed_pdf_path) and os.path.getsize(ed_pdf_path) > 500:
        return True, "cached_pdf"

    # Strategy A: AJAX problemTutorial
    if csrf_token:
        try:
            tut_resp = session.post(
                "https://codeforces.com/data/problemTutorial",
                data={"problemCode": f"{cid}{idx}", "csrf_token": csrf_token},
                headers={"X-Requested-With": "XMLHttpRequest", "Referer": f"https://codeforces.com/problemset/problem/{cid}/{idx}"},
                timeout=15
            )
            if tut_resp.status_code == 200:
                data = tut_resp.json()
                if data.get("success") == "true" and data.get("html"):
                    html_text = data["html"]
                    with open(ed_html_path, "w", encoding="utf-8") as f:
                        f.write(html_text)
                    
                    # Check if the returned HTML references a PDF tutorial
                    if ".pdf" in html_text.lower():
                        soup = BeautifulSoup(html_text, "html.parser")
                        for a in soup.find_all("a", href=True):
                            if ".pdf" in a["href"].lower():
                                pdf_url = f"https://codeforces.com{a['href']}" if a["href"].startswith("/") else a["href"]
                                try:
                                    r_pdf = session.get(pdf_url, timeout=25)
                                    if r_pdf.status_code == 200 and (r_pdf.content.startswith(b"%PDF-") or "pdf" in r_pdf.headers.get("Content-Type", "").lower()):
                                        with open(ed_pdf_path, "wb") as pf:
                                            pf.write(r_pdf.content)
                                        break
                                except Exception:
                                    pass
                    return True, "tutorial_ajax"
        except Exception:
            pass

    # Strategy B: Find tutorial or PDF link in problem statement sidebar
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
                    # Save as binary PDF
                    with open(ed_pdf_path, "wb") as f:
                        f.write(r.content)
                    return True, "pdf_downloaded"
                else:
                    # Save as HTML
                    with open(ed_html_path, "w", encoding="utf-8") as f:
                        f.write(r.text)

                    # Also inspect if the HTML links to an attached PDF
                    if ".pdf" in r.text.lower():
                        soup = BeautifulSoup(r.text, "html.parser")
                        for a in soup.find_all("a", href=True):
                            h_url = a["href"].strip()
                            if ".pdf" in h_url.lower():
                                pdf_target = f"https://codeforces.com{h_url}" if h_url.startswith("/") else h_url
                                try:
                                    r_subpdf = session.get(pdf_target, timeout=25)
                                    if r_subpdf.status_code == 200 and r_subpdf.content.startswith(b"%PDF-"):
                                        with open(ed_pdf_path, "wb") as pf:
                                            pf.write(r_subpdf.content)
                                        break
                                except Exception:
                                    pass

                    return True, "blog_page"
        except Exception:
            pass

    return False, "not_found"

# ----------------- STAGE 3: 100 SUBMISSIONS METADATA -----------------
def get_submission_metadata(session, prob, prob_folder, contests_cache, target_count=100):
    meta_path = os.path.join(prob_folder, "submissions_metadata.json")
    if os.path.exists(meta_path) and os.path.getsize(meta_path) > 100:
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f).get("submissions", []), "cached"

    cid = str(prob["contestId"])
    idx = prob["index"]

    # Fetch contest status if not in cache
    if cid not in contests_cache:
        url = f"https://codeforces.com/api/contest.status?contestId={cid}&from=1&count=10000"
        try:
            r = session.get(url, timeout=25)
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "OK":
                    ac_subs = [
                        {
                            "id": s["id"],
                            "index": s.get("problem", {}).get("index"),
                            "handle": s.get("author", {}).get("members", [{}])[0].get("handle", "unknown"),
                            "lang": s.get("programmingLanguage", ""),
                            "time_ms": s.get("timeConsumedMillis", 0),
                            "creationTimeSeconds": s.get("creationTimeSeconds", 0),
                            "verdict": s.get("verdict")
                        }
                        for s in data["result"]
                        if s.get("verdict") == "OK"
                    ]
                    contests_cache[cid] = ac_subs
                    save_contests_cache(contests_cache)
            time.sleep(0.5)
        except Exception as e:
            pass

    all_subs = contests_cache.get(cid, [])
    matching = [s for s in all_subs if s.get("index") == idx]

    # Deduplicate by author handle
    seen_handles = set()
    unique_subs = []
    for s in matching:
        h = s["handle"]
        if h not in seen_handles:
            seen_handles.add(h)
            unique_subs.append(s)

    unique_subs.sort(key=lambda s: s.get("creationTimeSeconds", 0))

    if len(unique_subs) <= target_count:
        selected = unique_subs
    else:
        random.seed(int(cid) + ord(idx[0]))
        indices = sorted(random.sample(range(len(unique_subs)), target_count))
        selected = [unique_subs[i] for i in indices]

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "problemId": prob["id"],
            "contestId": prob["contestId"],
            "index": idx,
            "totalAc": len(matching),
            "uniqueAuthors": len(unique_subs),
            "selectedCount": len(selected),
            "submissions": selected
        }, f, indent=2)

    return selected, "new"

# ----------------- STAGE 4: DOWNLOAD SUBMISSION CODES -----------------
def download_submission_sources(session, prob, prob_folder, subs_list, progress_bar=None):
    cid = prob["contestId"]
    subs_dir = os.path.join(prob_folder, "submissions")
    os.makedirs(subs_dir, exist_ok=True)

    downloaded = 0
    cached = 0

    for s in subs_list:
        sid = s["id"]
        handle = s["handle"]
        lang = s.get("lang", "").lower()
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
            cached += 1
            if progress_bar:
                progress_bar.update(1)
            continue

        url = f"https://codeforces.com/contest/{cid}/submission/{sid}"
        try:
            r = session.get(url, timeout=20)
            
            # Check for Cloudflare / anti-bot challenge
            if r.status_code == 403 or is_bot_challenge(r.text):
                return False, f"Cloudflare / Bot Challenge detected on sub {sid}", downloaded

            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                pre = soup.find("pre", id="program-source-text")
                if pre:
                    with open(file_path, "w", encoding="utf-8") as fp:
                        fp.write(pre.get_text())
                    downloaded += 1
                elif "program-source-text" not in r.text and is_bot_challenge(r.text):
                    return False, f"Bot challenge detected on sub {sid}", downloaded

            time.sleep(random.uniform(0.5, 0.9))

        except Exception as e:
            pass

        if progress_bar:
            progress_bar.update(1)

    return True, "ok", downloaded

# ----------------- MAIN PIPELINE RUNNER -----------------
def main():
    parser = argparse.ArgumentParser(description="Codeforces 2800-3500 Dataset Fetcher with Graceful Resumption")
    parser.add_argument("--cookie", type=str, default=None, help="Cookie header string (overrides cookie.txt)")
    parser.add_argument("--user-agent", type=str, default=None, help="Browser User-Agent (matching cookie)")
    parser.add_argument("--limit", type=int, default=None, help="Limit total problems to fetch in this session")
    parser.add_argument("--skip-sources", action="store_true", help="Fetch only statements, editorials & metadata (no source code scraping)")
    args = parser.parse_args()

    # Load cookie
    cookie = args.cookie or load_cookie()
    user_agent = args.user_agent or ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0" if (cookie and "Firefox" in str(cookie)) else "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    print("\n" + "=" * 78)
    print("   CF 2800-3500 DATASET FETCHER — TERMINAL RUNNER")
    print("=" * 78)
    print(f"Cookie status: {'[✓] Loaded' if cookie else '[!] No cookie loaded (reading from public endpoints)'}")
    if not cookie:
        print(f"Tip: You can paste your updated Cookie into: {COOKIE_FILE}")
    print("=" * 78 + "\n")

    with open(PROBLEMS_JSON, "r", encoding="utf-8") as f:
        all_problems = json.load(f)

    completed_problems = load_completed()
    pending_problems = [p for p in all_problems if p["id"] not in completed_problems]

    if args.limit:
        pending_problems = pending_problems[:args.limit]

    print(f"Total dataset: {len(all_problems)} problems")
    print(f"Already fully completed: {len(completed_problems)}")
    print(f"Remaining to process: {len(pending_problems)}")
    print("-" * 78)

    if not pending_problems:
        print("🎉 All 1,465 problems are already 100% completed!")
        return

    session = build_session(user_agent=user_agent, cookie=cookie)

    # Grab CSRF for problemTutorial endpoint
    csrf = None
    try:
        r = session.get("https://codeforces.com/", timeout=15)
        m = re.search(r'data-csrf=[\'"]([a-f0-9]+)[\'"]', r.text)
        if m:
            csrf = m.group(1)
    except Exception:
        pass

    contests_cache = load_contests_cache()

    # Master progress bar for problems
    pbar_problems = tqdm(pending_problems, desc="Problems Progress", unit="prob", ncols=95)

    for prob in pbar_problems:
        pid = prob["id"]
        name = prob.get("name", pid)[:20]
        pbar_problems.set_description(f"Processing {pid} ({name})")

        prob_folder = os.path.join(PROBLEMS_DIR, pid)
        os.makedirs(prob_folder, exist_ok=True)

        # 1. Statement
        ok_stmt, msg_stmt = fetch_statement(session, prob, prob_folder)
        if not ok_stmt and "cloudflare" in msg_stmt:
            print(f"\n\n[!] CLOUDFLARE BOT CHALLENGE ON STATEMENT: {pid}")
            print("[✓] All previous results have been saved to checkpoints!")
            print(f"[>] Please update your cookie in '{COOKIE_FILE}' and re-run this script to resume.\n")
            save_completed(completed_problems)
            return

        # 2. Editorial
        fetch_editorial(session, prob, prob_folder, csrf)

        # 3. Sample 100 Submissions Metadata
        subs_list, _ = get_submission_metadata(session, prob, prob_folder, contests_cache, target_count=100)

        # 4. Download Source Codes (if not skipped)
        if not args.skip_sources and subs_list:
            ok_src, msg_src, dl_count = download_submission_sources(session, prob, prob_folder, subs_list)
            if not ok_src:
                print(f"\n\n{'='*78}")
                print(f"[!] CLOUDFLARE CHALLENGE / EXPIRED TOKEN DETECTED on Problem {pid}!")
                print(f"    Reason: {msg_src}")
                print(f"    Downloaded {dl_count} sources before challenge.")
                print(f"[✓] Checkpoints and all downloaded files have been SAFELY SAVED.")
                print(f"[>] TO RESUME:")
                print(f"    1. Open any submission page in your browser to pass the challenge.")
                print(f"    2. Paste your updated Cookie into: {COOKIE_FILE}")
                print(f"    3. Re-run: python dataset_fetcher/fetch_dataset.py")
                print(f"{'='*78}\n")
                save_completed(completed_problems)
                return

        # Mark problem fully complete
        completed_problems.add(pid)
        save_completed(completed_problems)

    print("\n" + "=" * 78)
    print(f"🎉 Session completed! Total problems now fully fetched: {len(completed_problems)}/{len(all_problems)}")
    print("=" * 78)

if __name__ == "__main__":
    main()
