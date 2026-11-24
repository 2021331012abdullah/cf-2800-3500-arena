# Codeforces 2800–3500 Dataset Fetcher

A robust, resumable, and rate-limited pipeline to collect Grandmaster problems from Codeforces.

## What is Saved for Each Problem:
For every problem in `cf_2800_3500_sorted.json` (1,465 problems), a dedicated folder is created:
```text
dataset_fetcher/cf_dataset/problems/1863G/
├── problem_statement.html     <-- Full HTML problem statement with LaTeX
├── statement_data.json        <-- Parsed title, limits, sample tests
├── editorial.html             <-- Full editorial/tutorial with hints & codes
├── submissions_metadata.json  <-- 100 uniformly sampled historical AC submissions
└── submissions/               <-- The 100 source code files
    ├── 244517077_dongyc666.cpp
    ├── 262869834_HRcohc.cpp
    └── ...
```

---

## How to Run from Terminal:

### 1. Standard Run (Full Pipeline with Progress Bar):
```bash
python dataset_fetcher/fetch_dataset.py
```

### 2. Fast Run (Metadata, Statements & Editorials first):
If you want to quickly fetch all 1,465 problem statements, editorials, and 100 submission metadata records without waiting for 146,500 source code downloads:
```bash
python dataset_fetcher/fetch_dataset.py --skip-sources
```

### 3. Test on 5 Problems:
```bash
python dataset_fetcher/fetch_dataset.py --limit 5
```

---

## Graceful Cloudflare Expiration & Resumption:
Codeforces occasionally rotates its anti-bot proof-of-work challenge (`pow`) on submission pages.

* **Automatic Stop**: When the script detects a Cloudflare Turnstile or expired token, it **immediately saves all progress**, logs which submission paused, and exits cleanly.
* **To Resume**:
  1. Open any submission page in your browser to pass the check.
  2. Paste your updated cookies into `dataset_fetcher/cookie.txt`.
     *(Both standard `name=val; ...` string and JSON array `[{"name": "...", "value": "..."}, ...]` exported from Cookie-Editor / DevTools are supported automatically!)*
  3. Re-run `python dataset_fetcher/fetch_dataset.py`.
  4. The script **instantly resumes** from the exact file where it stopped!
