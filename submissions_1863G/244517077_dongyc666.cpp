// LUOGU_RID: 145803675
#include<bits/stdc++.h>
#define int long long 
using namespace std;
const int NR=1e6+10;
const int MOD=1e9+7;
int n,a[NR],vis[NR],tag[NR],in[NR];

signed main(){
	ios::sync_with_stdio(false);
	cin>>n;
	for(int i=1;i<=n;i++)
		cin>>a[i],in[a[i]]++;
	int ans=1;
	for(int i=1;i<=n;i++)
		if(!vis[i]){
			int j=i;
			while(!vis[j])vis[j]=i,j=a[j];
			int s1=1,s2=0;
			while(vis[j]==i&&!tag[j])
				tag[j]=1,(s1*=(in[j]+1))%=MOD,(s2+=in[j])%=MOD,j=a[j];
			ans=ans*(s1-s2+MOD)%MOD;
		}
	for(int i=1;i<=n;i++)
		if(!tag[i])ans=ans*(in[i]+1)%MOD;
	cout<<ans<<endl;
	return 0;
}