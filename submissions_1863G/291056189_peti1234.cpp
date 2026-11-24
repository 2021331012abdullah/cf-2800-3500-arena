#include <bits/stdc++.h>
using namespace std;
const int c=1000005, mod=1e9+7;
int n, t[c], kor[c], be[c], vis[c];
long long ans=1;
vector<int> cur;
void dfs2(int a) {
	kor[a]=1;
	vis[a]=2;
	int kov=t[a];
	if (!kor[kov]) {
		dfs2(kov);
	}
}
void dfs(int a) {
	vis[a]=1;
	cur.push_back(a);

	int kov=t[a];
	if (!vis[kov]) {
		dfs(kov);
	} else if (vis[kov]==1) {
		dfs2(kov);
	}
	
}
int main() {
	ios_base::sync_with_stdio(false);
	cin.tie(0);
	cin >> n;
	for (int i=1; i<=n; i++) {
		cin >> t[i];
		be[t[i]]++;
	}

	for (int i=1; i<=n; i++) {
		if (!vis[i]) {
			dfs(i);
		
			for (auto x:cur) {
				if (!kor[x]) {
					vis[x]=3;
				}
			}
			cur.clear();
		}
	}

	for (int i=1; i<=n; i++) {
		if (vis[i]==2) {
			long long prod=1, sum=0;
			int a=i;
			while (vis[a]==2) {
				prod=prod*(be[a]+1)%mod;
				sum=(sum+be[a])%mod;
				vis[a]=4;
				a=t[a];
			}
			//cout << "vege " << i << " " << prod-sum << "\n";
			ans=ans*(prod-sum+mod)%mod;
		}
		if (vis[i]==3) {
			ans=ans*(be[i]+1)%mod;
		}
	}

	cout << ans << "\n";
}
