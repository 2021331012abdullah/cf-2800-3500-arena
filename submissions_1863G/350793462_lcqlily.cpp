#include<bits/stdc++.h>
using namespace std;
typedef long long LL;
const int MOD=1e9+7;


int n;
int a[1000010];
int b[1000010];
int c[1000010];
int e[1000010];
int son[1000010];
vector<int> g[1000010];
LL f[1000010];
LL f1[1000010],f2[1000010];

LL ksm(LL x,LL y){
	if(y==0) return 1;
	if(y==1) return x%MOD;
	LL kk=ksm(x,y/2);
	if(y%2==0) return kk*kk%MOD;
	return x%MOD*kk%MOD*kk%MOD;
}

LL C(LL x,LL y){
	if(!y) return 1;if(x<y) return 0;return f1[x]*f2[y]%MOD*f2[x-y]%MOD;
}

void init(){
	f1[0]=f2[0]=1;
	for(int i=1;i<=1000000;i++) f1[i]=f1[i-1]*i%MOD;
	f2[1000000]=ksm(f1[1000000],MOD-2);
	for(int i=1000000-1;i>0;i--) f2[i]=f2[i+1]*(i+1)%MOD;
}

void tp(){
	queue<int> q;
	for(int i=1;i<=n;i++) if(!c[i]) q.push(i);
	while(!q.empty()){
		int u=q.front();q.pop();b[u]=0;
		c[a[u]]--;if(!c[a[u]]) q.push(a[u]);
	}
}

void dfs(int u,int top){
	for(int v:g[u]){
		if(!b[v]) dfs(v,top),f[top]=f[top]*(son[v]+1)%MOD;
	}
}

LL solve(int u){
	int now=u,cnt=0;
	while(b[now]){
		b[now]=0;cnt++,e[cnt]=now;now=a[now];
	}
	if(cnt==1) return f[u];
	LL tmp=1,num=1,tt=0,tot=1;
	for(int i=2;i<=cnt;i++) tmp=(tmp+C(cnt,i))%MOD;
	for(int i=1;i<=cnt;i++) tot=tot*f[e[i]]%MOD,num=num*f[e[i]]%MOD*(son[e[i]]+1)%MOD;
	tmp=tmp*tot%MOD;
	//for(int i=1;i<=cnt;i++) if(son[e[i]]>1) tt=1;
	//if(!tt) return tmp;
	//cout<<tmp<<" "<<num<<"\n";
	for(int i=1;i<=cnt;i++){
		num=num*ksm(son[e[i]]+1,MOD-2)%MOD;
		tmp=(tmp+num*(son[e[i]]-1)%MOD)%MOD;
		tmp=(tmp-tot*(son[e[i]]-1)%MOD+MOD)%MOD;
		num=num*2%MOD;
	}
	return tmp;
}

int main(){
	ios::sync_with_stdio(0);cin.tie(0);
	cin>>n;init();
	for(int i=1;i<=n;i++) cin>>a[i],g[a[i]].push_back(i),son[a[i]]++,c[a[i]]++;
	for(int i=1;i<=n;i++) b[i]=1;
	tp();
	for(int i=1;i<=n;i++) if(b[i]) f[i]=1,dfs(i,i);//,cout<<i<<" "<<f[i]<<"\n";
	LL ans=1;
	for(int i=1;i<=n;i++){
		if(b[i]) ans=ans*solve(i)%MOD;
	}
	cout<<ans<<"\n";
	return 0;
}