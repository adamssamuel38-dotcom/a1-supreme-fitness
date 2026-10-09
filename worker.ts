import {createClient} from '@supabase/supabase-js';
type Env={ASSETS:{fetch:(r:Request)=>Promise<Response>};SUPABASE_URL:string;SUPABASE_PUBLISHABLE_KEY:string};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const safePath=(x:unknown)=>typeof x==='string'&&/^\/(?!\/)/.test(x)&&!x.includes('\\')?x:'/membership';
function readCookies(req:Request){return Object.fromEntries((req.headers.get('cookie')||'').split(';').map(x=>{const n=x.indexOf('=');return [x.slice(0,n).trim(),x.slice(n+1)];}));}
function cookie(name:string,value:string,maxAge:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
export default {async fetch(req:Request,env:Env){
 const url=new URL(req.url);let response:Response;const pending:string[]=[];
 try{
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(req.method!=='GET'&&req.headers.get('origin')!==url.origin)return json({error:'Please submit through this website.'},403);
 const sb=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const cookies=readCookies(req);
 const setSession=(s:any)=>{pending.push(cookie('__Host-a1-access',s.access_token,s.expires_in||3600),cookie('__Host-a1-refresh',s.refresh_token,30*86400));};
 const clear=()=>pending.push(cookie('__Host-a1-access','',0),cookie('__Host-a1-refresh','',0));
 let token=cookies['__Host-a1-access'];
 async function user(){
  if(token){const {data,error}=await sb.auth.getUser(token);if(!error&&data.user)return data.user;}
  if(cookies['__Host-a1-refresh']){const {data,error}=await sb.auth.refreshSession({refresh_token:cookies['__Host-a1-refresh']});if(!error&&data.session){setSession(data.session);token=data.session.access_token;return data.user;}clear();}
  return null;
 }
 if(url.pathname.startsWith('/api/auth/')&&req.method==='POST'){
  if(Number(req.headers.get('content-length'))>12000)return json({error:'Request too large.'},413);
  const raw=await req.text();if(raw.length>12000)return json({error:'Request too large.'},413);
  const b=JSON.parse(raw);const action=url.pathname.split('/').pop();
  const email=typeof b.email==='string'?b.email.trim():'';const password=typeof b.password==='string'?b.password:'';
  if(['login','signup','recover'].includes(action!)&&(!email.includes('@')||email.length>254))return json({error:'Enter a valid email.'},400);
  if(['signup','password'].includes(action!)&&(password.length<12||password.length>128))return json({error:'Use a password between 12 and 128 characters.'},400);
  if(action==='login'){
   const {data,error}=await sb.auth.signInWithPassword({email,password});
   if(error||!data.session)response=json({error:'Sign-in failed. Check your email and password, and confirm your email first.'},400);
   else{setSession(data.session);response=json({next:safePath(b.next)});}
  }else if(action==='signup'){
   const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:url.origin+'/login'}});
   if(error)response=json({error:'Account creation is unavailable. Please try again later or sign in if you already have an account.'},400);
   else {if(data.session)setSession(data.session);response=json({message:'Check your email to confirm your account. Then sign in to choose your membership.',next:data.session?'/membership':null});}
  }else if(action==='recover'){
   const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:url.origin+'/login?mode=reset'});
   response=error?json({error:'Password recovery is temporarily unavailable. Please try again later.'},503):json({message:'If an account matches that email, a password reset link will be sent.'});
  }else if(action==='session'){
   // Confirm callback tokens with Supabase; never trust identity supplied by a browser.
   const {data,error}=await sb.auth.setSession({access_token:String(b.access_token||''),refresh_token:String(b.refresh_token||'')});
   if(error||!data.session)response=json({error:'That link is invalid or expired. Request a new email.'},401);
   else{const check=await sb.auth.getUser(data.session.access_token);if(check.error)response=json({error:'Session verification failed.'},401);else{setSession(data.session);response=json({ok:true});}}
  }else if(action==='password'){
   const u=await user();if(!u)response=json({error:'Open the password reset email first.'},401);
   else{const {error}=await sb.auth.setSession({access_token:token!,refresh_token:cookies['__Host-a1-refresh']||''});if(error)response=json({error:'Please request a fresh reset link.'},401);else{const result=await sb.auth.updateUser({password});response=result.error?json({error:'Could not update the password.'},400):json({next:'/membership'});}}
  }else if(action==='logout'){
   if(token&&cookies['__Host-a1-refresh']){await sb.auth.setSession({access_token:token,refresh_token:cookies['__Host-a1-refresh']});await sb.auth.signOut({scope:'local'});}clear();response=json({next:'/'});
  }else response=json({error:'Not found.'},404);
 }else{
  const u=await user();
  if(url.pathname==='/api/session')response=json({user:u?{id:u.id,email:u.email}:null});
  else if(!u&&!['/api/leads','/api/health'].includes(url.pathname))response=json({error:'Sign in to access your account.'},401);
  else{
   const upstream=new URL(env.SUPABASE_URL+'/functions/v1/member-api'+url.pathname+url.search);
   const h=new Headers({...(token?{'Authorization':'Bearer '+token}:{}),'apikey':env.SUPABASE_PUBLISHABLE_KEY,'X-App-Origin':url.origin});
   if(req.headers.get('content-type'))h.set('content-type',req.headers.get('content-type')!);
   if(Number(req.headers.get('content-length'))>21*1024*1024)response=json({error:'File too large.'},413);
   else response=await fetch(upstream,{method:req.method,headers:h,body:['GET','HEAD'].includes(req.method)?undefined:req.body});
  }
 }
 }catch{response=json({error:'The service is temporarily unavailable. Please try again.'},503);}
 const h=new Headers(response.headers);h.set('Cache-Control','no-store');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','same-origin');for(const c of pending)h.append('Set-Cookie',c);
 return new Response(response.body,{status:response.status,headers:h});
}};
