# CF 2800-3500 Arena 🏆

An elite competitive programming platform designed for grandmasters and aspiring red-coders exploring the top tier (2800-3500 rating) of Codeforces problems.

![Codeforces Rating](https://img.shields.io/badge/Codeforces-2800--3500-ff3333?style=for-the-badge&logo=codeforces)
![Problems](https://img.shields.io/badge/Problems-1%2C479-06b6d4?style=for-the-badge)
![Status](https://img.shields.io/badge/Platform-Live-10b981?style=for-the-badge)

---

## 🌟 Key Features

### 1. 👥 Multi-Handle Tracking & Sync
- **Live Codeforces API Sync**: Enter one or multiple Codeforces handles (e.g. `tourist, Benq, ecnerwala` or your teammates).
- **Solved Status Breakdown**:
  - `Unsolved by ALL`: Filter problems that neither you nor any of your teammates have solved yet (perfect for training).
  - `Solved by ANY`: See what your group has solved.
  - `Solved by ALL`: Identify common ground.
  - `Attempted / WA`: Review problems submitted with non-AC verdicts.
- **Profile Cards**: Displays avatar, rank title, current rating, and solved count in the 2800-3500 bracket.

### 2. ⚡ Problem Length & Solves Analysis
- **Statement Length (Characters)**: Find ultra-concise math problems or thorough implementation tasks.
- **Word Count**: See exact reading load.
- **Reading Time Estimate**: Computed from statement word counts.
- **Global Solves Metric**: Total AC submissions across Codeforces.
- **Sort Options**:
  - Length: Shortest First (⚡) vs Longest First (📜)
  - Word Count: Fewest vs Most
  - Solves: Rare Gems (< 100 solves ☠️) vs Popular Classics (> 1,000 solves 🏆)
  - Rating: 3500 → 2800 or 2800 → 3500
  - Contest ID: Newest vs Oldest
  - Name: A → Z

### 3. 🏷️ Advanced Tag Filtering
- 38 distinct competitive programming tags (`dp`, `math`, `trees`, `graphs`, `flows`, `fft`, `geometry`, etc.).
- **Logic Modes**:
  - `OR (Any)`: Match any selected tag.
  - `AND (All)`: Match all selected tags simultaneously (e.g. `dp` + `trees`).
  - `NOT (Exclude)`: Exclude specific tags (e.g. exclude `interactive` or `geometry`).
- Click any tag on any card or row to filter immediately.

### 4. 👁️ Spoiler Protection (Hide Tags Mode)
- Grandmaster training mode: blur problem tags to simulate real contest conditions where problem types are unknown.
- Hover or click to reveal hints when stuck.

### 5. 🎲 Problem Roulette (Random Picker)
- Roll a random problem from your currently filtered pool (respecting tags, ratings, and unsolved status).
- Slot-style animation with confetti celebration.

### 6. ⚔️ Virtual Mashup Generator
- Create custom 3, 4, or 5 problem practice sets matching target ratings.
- Integrated contest countdown timer (2h, 3h, 5h).
- Direct links to Codeforces problem pages.

### 7. 📊 Training Analytics & Insights
- Interactive **Chart.js** rating distribution (Total vs Solved by your handles).
- Top 12 topic tags frequency bar chart.
- Multi-handle comparison table (rating, rank, solves count, solve percentage).

### 8. ⭐ Bookmarks & Private Notes
- Star problems to save to your local browser bookmarks.
- Write private solution notes or hint reminders per problem (stored in `localStorage`).

### 9. 💾 Export Options
- Export filtered problems to CSV spreadsheet.
- Download filtered JSON dataset.
- Copy list of Codeforces problem URLs to clipboard.

---

## 🚀 How to Run Locally

### Option 1: Double-Click Startup (Windows)
Double-click `start.bat`. It will automatically start the server and open `http://localhost:8080` in your default browser.

### Option 2: Node.js
```bash
npm start
# Server will run at http://localhost:8080
```

### Option 3: Direct Browser File Opening
Open `index.html` directly in any web browser! The application includes an offline-compatible `data.js` fallback so it works without even needing a web server.

---

## 🌐 Publishing to the Web

### Deploy to GitHub Pages (Free)
1. Create a new repository on GitHub: `https://github.com/new` (e.g. `cf-arena`).
2. Run:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/cf-arena.git
   git branch -M main
   git push -u origin main
   ```
3. In your GitHub repository settings, navigate to **Pages** > **Source** > Select `main` branch and `/ (root)` folder > Click **Save**.
4. Your site will be live at `https://YOUR_USERNAME.github.io/cf-arena/`!

### Deploy to Vercel (1-Click)
```bash
npx vercel
```

### Deploy to Netlify (1-Click)
```bash
npx netlify deploy --prod
```

### Instant Public Tunnel (Live URL)
Run:
```bash
node deploy-tunnel.js
```
This generates a live public HTTPS tunnel link (e.g. `https://cf-arena-grandmaster.loca.lt`) accessible from any device or phone worldwide.
