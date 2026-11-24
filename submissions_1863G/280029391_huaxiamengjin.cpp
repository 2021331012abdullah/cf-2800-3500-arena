#include<bits/stdc++.h>
using namespace std;
#define int long long 
const int NN=1e9+7;
int n,a[1001001];
int deg[1001001];
int biao[1001001];
int used[1001001];
int ans=1;
void dfs(int i,int p){
//	cout<<i<<" "<<used[i]<<"\n";
	if(used[i]!=0){
		if(used[i]!=p)return ;
		biao[i]=1;
		if(a[i]==i)return ;
		int sum1=1,sum2=0;
		int now=i;
		do{
			biao[now]=1;
//			cout<<now<<"\n";
			sum1=sum1*(deg[now]+1)%NN;
			sum2=(sum2+deg[now])%NN;
			now=a[now];
		}while(now!=i);
		ans=ans*(sum1-sum2+NN)%NN;
		return ;
	} 
	used[i]=p;
	dfs(a[i],p);
}
signed main(){
	cin>>n;
	for (int i=1;i<=n;i++)
	cin>>a[i],deg[a[i]]++;
	for (int i=1;i<=n;i++)
	if(!used[i])dfs(i,i); 
	for (int i=1;i<=n;i++)
	if(biao[i]==0)ans=ans*(deg[i]+1)%NN;
	cout<<ans<<"\n";
}