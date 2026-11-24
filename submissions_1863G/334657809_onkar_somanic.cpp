#include<bits/stdc++.h>
#define int long long
using namespace std;
int read(){
	int k=1,s=0;
	char c=getchar();
	while(c>'9'||c<'0'){
		if(c=='-') k=-k;
		c=getchar();
	}
	while(c>='0'&&c<='9'){
		s=(s<<3)+(s<<1)+(c^48);
		c=getchar();
	}
	return k*s;
}
const int N=2e6+5,mod=1e9+7;
int n,a[N],in[N];
int ans=1,flag[N],tot,stk[N],vis[N],stkvis[N];
void dfs(int u){
	if(vis[u]) return;
	vis[u]=1;
	stkvis[u]=1;stk[++tot]=u;
	if(stkvis[a[u]]){
		int res=1,sum=0;
		for(int i=tot;i;--i){
			flag[stk[i]]=1;
			res=1ll*res*(in[stk[i]]+1)%mod;
			sum=(sum+in[stk[i]])%mod;
			if(stk[i]==a[u]) break;//忘记退了 唐 
		}	
		ans=1ll*ans*(res-sum)%mod;
	}
	else{
		dfs(a[u]);
	}
	stkvis[u]=0;--tot;
}	
signed main(){
	n=read();
	for(int i=1;i<=n;++i){
		a[i]=read();
		++in[a[i]];
	}
	for(int i=1;i<=n;++i){
		dfs(i);
	}
	for(int i=1;i<=n;++i){
		if(!flag[i]){
			ans=1ll*ans*(in[i]+1)%mod;
		}
	}
	printf("%lld\n",(ans%mod+mod)%mod);
	return 0;
}