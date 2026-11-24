// LUOGU_RID: 160467901
#include <bits/stdc++.h>
#define N 1000005
#define p 1000000007
using namespace std;
int n, top, ans = 1;
int a[N], deg[N], stk[N];
bitset<N> vis, ins, cyc;

int add(int x, int y){return (x + y >= p)? x - p + y : x + y;}
int sub(int x, int y){return (x < y)? x + p - y : x - y;}
int mul(int x, int y){return 1ll * x * y % p;}

void dfs(int u){
	if(vis[u]) return;
	vis[u] = 1;
	stk[++top] = u, ins[u] = 1; 
	if(ins[a[u]]){
		int sum1 = 1, sum2 = 0;
		for(int i = top; i; i--){
			cyc[stk[i]] = 1;
			sum1 = mul(sum1, deg[stk[i]] + 1);
			sum2 = add(sum2, deg[stk[i]]);
			if(stk[i] == a[u]) break;
		}
		ans = mul(ans, sub(sum1, sum2));
	}
	else dfs(a[u]);
	--top, ins[u] = 0;
}

inline int read(){
	char ch = getchar(); int x = 0, f = 1;
	while(!isdigit(ch)){if(ch == '-') f = -1; ch = getchar();}
	while(isdigit(ch)){x = (x << 3) + (x << 1) + (ch ^ 48); ch = getchar();}
	return x * f;
}

int main(){
//	freopen(".in", "r", stdin);
//	freopen(".out", "w", stdout);
	n = read();
	for(int i = 1; i <= n; i++) a[i] = read(), ++deg[a[i]];
	for(int i = 1; i <= n; i++) dfs(i);
	for(int i = 1; i <= n; i++) if(!cyc[i]) ans = mul(ans, deg[i] + 1);
	printf("%d", ans);
	return 0;
}