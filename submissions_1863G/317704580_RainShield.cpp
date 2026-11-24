#include<bits/stdc++.h>
using namespace std;
const int maxn=1000005,Mod=1e9+7;
int N,A[maxn],Deg[maxn],Fa[maxn],Que[maxn];
bool vis[maxn];
void topo(){
    int hed=0,til=0;
    for(int i=1;i<=N;i++) if(!Deg[i]) Que[++til]=i;
    while(hed^til){
        int u=Que[++hed];vis[u]=1;
        if(!--Deg[A[u]]) Que[++til]=A[u];
    }
}
int Get_Fa(int x){return x==Fa[x]?x:Fa[x]=Get_Fa(Fa[x]);}
int Val[maxn];
void reduce(int &x){if(x>=Mod) x-=Mod;}
int main(){
    cin.tie(0)->sync_with_stdio(0);
    cin>>N;int ans=1;
    for(int i=1;i<=N;i++) Fa[i]=i,Val[i]=1;
    for(int i=1;i<=N;i++) cin>>A[i],Deg[A[i]]++,Fa[Get_Fa(i)]=Get_Fa(A[i]);
    topo();
    for(int i=1;i<=N;i++) Deg[i]=0;
    for(int i=1;i<=N;i++) Deg[A[i]]++;
    for(int i=1;i<=N;i++) if(vis[i]) ans=1ull*ans*(Deg[i]+1)%Mod;else Val[Get_Fa(i)]=1ull*Val[Get_Fa(i)]*(Deg[i]+1)%Mod;
    for(int i=1;i<=N;i++) if(!vis[i]) reduce(Val[Get_Fa(i)]+=Mod-Deg[i]);
    for(int i=1;i<=N;i++) ans=1ull*ans*Val[i]%Mod;
    cout<<ans<<'\n';
    return 0;
}