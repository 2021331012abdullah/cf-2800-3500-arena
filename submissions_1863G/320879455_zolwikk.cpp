#include<bits/stdc++.h>
using namespace std;
typedef long long ll;
typedef unsigned long long ull;
typedef long double ld;
#define rep(a,b) for(int a = 0; a < (b); ++a)
#define all(t) t.begin(), t.end()
#define pb push_back

#pragma GCC target ("avx2")
#pragma GCC optimization ("O3")
#pragma GCC optimization ("unroll-loops")

const int N = 1e6+5432, INF = 2e9+54321;
const ll INF_L = (ll)2e18+54321, mod = 1e9+7;

int n,cnt,wierz,ans,ilo;
int A[N];
vector<int> V;
vector<int> C;
vector<int> G[N];

void DFS(int v)
{
	if(wierz != 0) return;
	if(V[A[v]] == -1) V[A[v]] = V[v], DFS(A[v]);
	else if(V[A[v]] == cnt) wierz = A[v];
	else wierz = -5;
}

void DFS2(int v)
{
	int il = 1;
	for(auto x : G[v])
	{
		++il, DFS2(x);
	}
	ilo = ((ll)ilo*il) % (ll)mod;
}

void DFS3(int v)
{
	C.pb(v);
	if(A[v] != wierz) DFS3(A[v]);
}

int poww(int a, int b)
{
	int res = 1, akt = a;
	rep(i,30)
	{
		int bit = ((1<<i)&b);
		if(bit) res = ((ll)res*akt) % (ll)mod;
		akt = ((ll)akt*akt) % (ll)mod;
	}
	return res;
}

void solve()
{
	cin >> n;
	for(int i = 1; i <= n; ++i) cin >> A[i];

	V.assign(n+1,-1), cnt = 0, ans = 1;

	for(int i = 1; i <= n; ++i) G[A[i]].pb(i);

	vector<int> DD(n+1);
	for(int i = 1; i <= n; ++i)
	{
		if(V[i] != -1) continue;
		++cnt, V[i] = cnt, wierz = 0, DFS(i);
		if(wierz > 0)
		{
			C.clear(), DFS3(wierz);
			ilo = 1;
			for(auto v : C) DD[v] = i;
			for(auto v : C)
			{
				for(auto x : G[v])
				{
					if(DD[x] == i) continue;
					DFS2(x);
				}
			}
			ans = ((ll)ans*ilo) % (ll)mod;

			/*cout << "ILO: " << ilo << endl;
			cout << "C: " << endl;
			for(auto x : C) cout << x << ' ';
			cout << endl;*/ 

			vector<int> B;
			int il = 0;
			for(auto v : C) B.pb((int)G[v].size()-1), il += B.back();

			/*cout << "B: " << endl;
			for(auto x : B) cout << x << ' ';
			cout << endl;
			cout << "IL: " << il << endl;*/

			int m = (int)B.size(), wyn = (poww(2,m)-m-il+mod)%mod, su = 0;
			for(auto v : B)
			{
				ll dod = ((ll)v*su) % (ll)mod;
				dod = ((ll)dod*poww(2,mod-2)) % (ll)mod;
				su = ((ll)su+(ll)v*poww(2,m-1)+dod) % (ll)mod;
				//cout << "SU: " << su << endl;
			}
			wyn = (wyn+su) % mod;
			ans = ((ll)ans*wyn) % (ll)mod;
		}
	}
	cout << ans << '\n';
}

int main()
{   
    ios_base::sync_with_stdio(0);
    cin.tie(0);

    int T = 1;
    //cin >> T;
    while(T--) solve();

    return 0;
}