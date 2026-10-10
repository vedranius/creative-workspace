export async function checkRelease(repo,{fetcher=fetch,token=process.env.GITHUB_TOKEN}={}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid GitHub repository');
  const headers={Accept:'application/vnd.github+json','User-Agent':'creative-workspace/0.1'};
  if(token) headers.Authorization=`Bearer ${token}`;
  const response=await fetcher(`https://api.github.com/repos/${repo}/releases/latest`,{headers,signal:AbortSignal.timeout(15000)});
  if(response.status===404) return {status:'no-release',checkedAt:new Date().toISOString()};
  if(!response.ok) throw new Error(`GitHub returned ${response.status}${response.status===403||response.status===429?' (access or rate limit)':''}`);
  const release=await response.json();
  if(typeof release.tag_name!=='string') throw new Error('Invalid GitHub release response');
  return {status:'upstream-release',version:release.tag_name,url:release.html_url,notes:String(release.body||'').slice(0,12000),publishedAt:release.published_at,checkedAt:new Date().toISOString(),compatibility:'unverified'};
}
