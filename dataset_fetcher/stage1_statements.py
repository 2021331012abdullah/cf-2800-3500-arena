import json
import os
import random
import time
from bs4 import BeautifulSoup
from curl_cffi import requests
from config import (
    PROBLEMS_JSON_PATH,
    PROBLEMS_DIR,
    STATEMENT_CHECKPOINT,
    DEFAULT_HEADERS,
    DEFAULT_IMPERSONATE,
    MIN_WORKER_DELAY,
    MAX_WORKER_DELAY
)

def load_checkpoint():
    if os.path.exists(STATEMENT_CHECKPOINT):
        try:
            with open(STATEMENT_CHECKPOINT, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_checkpoint(completed_ids):
    with open(STATEMENT_CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump(list(completed_ids), f, indent=2)

def extract_statement_data(html):
    soup = BeautifulSoup(html, "html.parser")
    stmt_div = soup.find("div", class_="problem-statement")
    if not stmt_div:
        return None

    title_el = stmt_div.find("div", class_="title")
    time_el = stmt_div.find("div", class_="time-limit")
    mem_el = stmt_div.find("div", class_="memory-limit")

    title = title_el.get_text(strip=True) if title_el else ""
    time_limit = time_el.get_text(strip=True) if time_el else ""
    mem_limit = mem_el.get_text(strip=True) if mem_el else ""

    input_div = stmt_div.find("div", class_="input-specification")
    output_div = stmt_div.find("div", class_="output-specification")
    samples_div = stmt_div.find("div", class_="sample-test")
    note_div = stmt_div.find("div", class_="note")

    # Sample tests
    samples = []
    if samples_div:
        inputs = [i.find("pre").get_text("\n", strip=True) for i in samples_div.find_all("div", class_="input") if i.find("pre")]
        outputs = [o.find("pre").get_text("\n", strip=True) for o in samples_div.find_all("div", class_="output") if o.find("pre")]
        for inp, outp in zip(inputs, outputs):
            samples.append({"input": inp, "output": outp})

    return {
        "title": title,
        "timeLimit": time_limit,
        "memoryLimit": mem_limit,
        "inputSpec": input_div.get_text("\n", strip=True) if input_div else "",
        "outputSpec": output_div.get_text("\n", strip=True) if output_div else "",
        "samples": samples,
        "note": note_div.get_text("\n", strip=True) if note_div else ""
    }

def fetch_all_statements(limit=None):
    with open(PROBLEMS_JSON_PATH, "r", encoding="utf-8") as f:
        problems = json.load(f)

    completed = load_checkpoint()
    pending = [p for p in problems if p["id"] not in completed]
    if limit:
        pending = pending[:limit]

    print(f"=== Stage 1: Problem Statements ===")
    print(f"Total problems: {len(problems)} | Already cached: {len(completed)} | Pending: {len(pending)}")

    if not pending:
        print("All problem statements already fetched!")
        return

    session = requests.Session(impersonate=DEFAULT_IMPERSONATE)
    session.headers.update(DEFAULT_HEADERS)

    success_count = 0
    start_time = time.time()

    for idx, prob in enumerate(pending):
        pid = prob["id"]
        cid = prob["contestId"]
        index = prob["index"]
        prob_folder = os.path.join(PROBLEMS_DIR, pid)
        os.makedirs(prob_folder, exist_ok=True)

        url = f"https://codeforces.com/problemset/problem/{cid}/{index}?locale=en"
        raw_html_path = os.path.join(prob_folder, "problem_statement.html")
        data_json_path = os.path.join(prob_folder, "statement_data.json")

        # Skip if already exists on disk
        if os.path.exists(raw_html_path) and os.path.exists(data_json_path):
            completed.add(pid)
            continue

        try:
            r = session.get(url, timeout=20)
            if r.status_code == 200:
                with open(raw_html_path, "w", encoding="utf-8") as f:
                    f.write(r.text)

                parsed = extract_statement_data(r.text)
                if parsed:
                    parsed.update({
                        "id": pid,
                        "contestId": cid,
                        "index": index,
                        "name": prob.get("name"),
                        "rating": prob.get("rating"),
                        "tags": prob.get("tags", [])
                    })
                    with open(data_json_path, "w", encoding="utf-8") as f:
                        json.dump(parsed, f, indent=2, ensure_ascii=False)

                completed.add(pid)
                success_count += 1

                # Calculate ETA
                elapsed = time.time() - start_time
                avg_time = elapsed / max(1, success_count)
                remaining = (len(pending) - (idx + 1)) * avg_time
                rem_m = int(remaining // 60)
                rem_s = int(remaining % 60)

                if (idx + 1) % 10 == 0 or idx == len(pending) - 1:
                    print(f"[{idx+1}/{len(pending)}] Saved {pid} ({prob.get('name')[:25]}) | ETA: {rem_m}m {rem_s}s")
                    save_checkpoint(completed)

            elif r.status_code == 429:
                print(f"Rate limited (429) on {pid}. Backing off 10s...")
                time.sleep(10)
            else:
                print(f"HTTP {r.status_code} for {pid}")

        except Exception as e:
            print(f"Error fetching {pid}: {e}")

        time.sleep(random.uniform(MIN_WORKER_DELAY, MAX_WORKER_DELAY))

    save_checkpoint(completed)
    print(f"Completed Stage 1! Total statements fetched in this run: {success_count}")

if __name__ == "__main__":
    fetch_all_statements()
