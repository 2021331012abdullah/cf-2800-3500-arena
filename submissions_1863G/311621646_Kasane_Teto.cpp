 /* NE_Cat 4.0 */
#include <bits/stdc++.h>
#define lowbit(x) ((x) & (-(x)))
using namespace std;

const int N = 1000010, mod = 1e9 + 7;
int n, a[N], dg_i[N]; bool loop[N]; vector < int > rec[N];
long long res = 1;

struct DSU
{
	int prt[N], siz[N];
	inline void init(int n) {for(int i = 1; i <= n; ++i) prt[i] = i, siz[i] = 1;}
	inline int find(int x) {return ((prt[x] == x) ? x : (prt[x] = find(prt[x])));}
	inline void merge(int x, int y)
	{
		x = find(x), y = find(y);
		if(x != y) prt[x] = y, siz[y] += siz[x];
	}
}; DSU dsu;

inline void work(int id)
{
	long long cur_loop = 1, cur = 1;
	for(int x : rec[id]) if(!loop[x]) cur = cur * (dg_i[x] + 1) % mod;
	for(int x : rec[id]) if(loop[x]) cur_loop = cur_loop * (dg_i[x] + 1) % mod;
	for(int x : rec[id]) if(loop[x]) cur_loop = (cur_loop - dg_i[x] + mod) % mod;
	res = res * (cur_loop * cur % mod) % mod;
}

int main()
{
//	freopen("text.in", "r", stdin);
//	freopen("prog.out", "w", stdout);
	ios::sync_with_stdio(false);
	cin.tie(0), cout.tie(0);
	cin >> n; dsu.init(n);
	for(int i = 1; i <= n; ++i)
	{
		cin >> a[i]; ++dg_i[a[i]];
		if(dsu.find(i) == dsu.find(a[i]))
		{
			int p = a[i];
			while(!loop[p]) loop[p] = true, p = a[p];
		}
		dsu.merge(i, a[i]);
	}
	for(int i = 1; i <= n; ++i) rec[dsu.find(i)].push_back(i);
	for(int i = 1; i <= n; ++i) work(i);
	cout << res << '\n';
	return 0;
}
/*

*/