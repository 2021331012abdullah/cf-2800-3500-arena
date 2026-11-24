#include<bits/stdc++.h>
using namespace std;
const int N=1e6+5, p=1e9+7;
int n, x, ans=1, a[N], d[N], vis[N], st[N];
void dfs(int u){
	if(vis[u]) return;
	vis[u]=1, st[++x]=u;
	if(vis[a[u]]>0){
		long long s=1, sum=0;
		for(int i=x;;--i){
			s=s*(d[st[i]]+1)%p, sum+=d[st[i]], vis[st[i]]=2;
			if(st[i]==a[u]) break;
		}
		ans=ans*(s+p-sum)%p;
	}
	else dfs(a[u]);
	--x,vis[u]*=-1;
}
int main(){
	scanf("%d",&n);
	for(int i=1;i<=n;++i) scanf("%d",&a[i]),++d[a[i]];
	for(int i=1;i<=n;++i) dfs(i);
	for(int i=1;i<=n;++i) if(!~vis[i]) ans=ans*(d[i]+1ll)%p;
	printf("%d",ans);
	return 0;
} 
