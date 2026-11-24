#include<bits/stdc++.h>
#define int long long
using namespace std;
const int MAXN = 1e6 + 5 , MOD = 1e9 + 7;
int n , a[MAXN] , stk[MAXN] , top , in[MAXN] , ans = 1;
bool vis[MAXN] , circle[MAXN] , ins[MAXN];
void dfs(int u) {
	if (vis[u]) return;
	vis[u] = 1;
	stk[++ top] = u , ins[u] = 1;
	if (ins[a[u]]) {
		int mul = 1 , sum = 0;
		for (int i = top ; i >= 1 ; i --) {
			circle[stk[i]] = 1;
			mul = mul * (in[stk[i]] + 1) % MOD;
			sum = (sum + in[stk[i]]) % MOD;
			if (stk[i] == a[u]) break;
		}
		mul = (mul - sum + MOD) % MOD , ans = ans * mul % MOD;
	} else dfs(a[u]);
	top -- , ins[u] = 0;
}
signed main() {
	ios::sync_with_stdio(false);
	cin.tie(nullptr) , cout.tie(nullptr);
	cin >> n;
	for (int i = 1 ; i <= n ; i ++) {
		cin >> a[i];
		in[a[i]] ++;
	}
	for (int i = 1 ; i <= n ; i ++) {
		if (!vis[i]) dfs(i);
	}
	for (int i = 1 ; i <= n ; i ++) {
		if (circle[i]) continue;
		ans = ans * (in[i] + 1) % MOD;
	}
	cout << ans;
	return 0;
}