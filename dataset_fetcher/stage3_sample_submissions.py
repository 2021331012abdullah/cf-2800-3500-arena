import json
import os
import random
import time
from collections import defaultdict
from curl_cffi import requests
from config import (
    PROBLEMS_JSON_PATH,
    PROBLEMS_DIR,
    CHECKPOINTS_DIR,
    SUBMISSIONS_PER_PROBLEM,
    DEFAULT_IMPERSONATE
)

CONTESTS_CACHE_FILE = os.path.join(CHECKPOINTS_DIR, "contests_status_cache.json")
STAGE3_CHECKPOINT = os.path.join(CHECKPOINTS_DIR, "checkpoint_stage3_problems.json")

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

def fetch_all_submission_metadata():
    with open(PROBLEMS_JSON_PATH, "r", encoding="utf-8") as f:
        problems = json.load(f)

    # Map problems by contestId -> list of problem indices
    contest_problems = defaultdict(list)
    problem_by_id = {}
    for p in problems:
        cid = p["contestId"]
        contest_problems[cid].append(p["index"])
        problem_by_id[p["id"]] = p

    total_contests = len(contest_problems)
    print(f"=== Stage 3: Fetching 100 Random AC Submissions per Problem ===")
    print(f"Total problems: {len(problems)} across {total_contests} unique contests.")

    cache = load_contests_cache()
    cached_contests = set(int(k) for k in cache.keys())
    pending_contests = [cid for cid in contest_problems.keys() if cid not in cached_contests]
    print(f"Contests already cached: {len(cached_contests)} | Pending to query: {len(pending_contests)}")

    session = requests.Session(impersonate=DEFAULT_IMPERSONATE)

    start_time = time.time()
    for idx, cid in enumerate(pending_contests):
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
                            "mem_bytes": s.get("memoryConsumedBytes", 0),
                            "creationTimeSeconds": s.get("creationTimeSeconds", 0),
                            "verdict": s.get("verdict")
                        }
                        for s in data["result"]
                        if s.get("verdict") == "OK"
                    ]
                    cache[str(cid)] = ac_subs

                    if (idx + 1) % 15 == 0 or idx == len(pending_contests) - 1:
                        elapsed = time.time() - start_time
                        avg_t = elapsed / max(1, idx + 1)
                        rem = (len(pending_contests) - (idx + 1)) * avg_t
                        print(f"[{idx+1}/{len(pending_contests)}] Contest {cid} cached ({len(ac_subs)} AC subs) | ETA: {int(rem//60)}m {int(rem%60)}s")
                        save_contests_cache(cache)

            elif r.status_code == 429:
                print(f"Rate limit on contest {cid}. Sleeping 5s...")
                time.sleep(5)
        except Exception as e:
            print(f"Error querying contest {cid}: {e}")

        time.sleep(0.6)

    save_contests_cache(cache)

    # Now group by problem and select 100 random submissions per problem
    print("\nGrouping and sampling 100 historical submissions per problem...")
    sampled_problems_count = 0

    for prob in problems:
        pid = prob["id"]
        cid = prob["contestId"]
        p_index = prob["index"]
        prob_folder = os.path.join(PROBLEMS_DIR, pid)
        os.makedirs(prob_folder, exist_ok=True)
        out_json_path = os.path.join(prob_folder, "submissions_metadata.json")

        contest_subs = cache.get(str(cid), [])
        matching_subs = [s for s in contest_subs if s.get("index") == p_index]

        # Deduplicate handles to avoid one author having 5 identical submissions
        seen_handles = set()
        unique_subs = []
        for s in matching_subs:
            h = s["handle"]
            if h not in seen_handles:
                seen_handles.add(h)
                unique_subs.append(s)

        # Sort chronologically
        unique_subs.sort(key=lambda s: s.get("creationTimeSeconds", 0))

        # Sample up to SUBMISSIONS_PER_PROBLEM (100)
        target_count = min(len(unique_subs), SUBMISSIONS_PER_PROBLEM)
        if len(unique_subs) <= target_count:
            selected = unique_subs
        else:
            # Random uniform sample across the timeline
            random.seed(int(cid) + ord(p_index[0]))
            indices = sorted(random.sample(range(len(unique_subs)), target_count))
            selected = [unique_subs[i] for i in indices]

        with open(out_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "problemId": pid,
                "contestId": cid,
                "index": p_index,
                "name": prob.get("name"),
                "totalAcSubmissions": len(matching_subs),
                "uniqueAuthors": len(unique_subs),
                "selectedCount": len(selected),
                "submissions": selected
            }, f, indent=2)

        sampled_problems_count += 1

    print(f"Successfully sampled metadata for all {sampled_problems_count} problems!")

if __name__ == "__main__":
    fetch_all_submission_metadata()
