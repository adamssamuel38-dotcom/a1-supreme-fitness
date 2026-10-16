const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let handler,identity=null;const db={auth:{getUser:async()=>({data:{user:identity},error:null})},from:table=>{assert.equal(table,'member_profiles');return {select:()=>({eq:(key,value)=>{assert.equal(key,'user_id');assert.equal(value,identity.id);return {maybeSingle:async()=>({data:null,error:null})}}})}}};
const src=ts.transpileModule(fs.readFileSync('supabase/functions/member-api/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(src,{exports:{},require:n=>n.includes('supabase-js')?{createClient:()=>db}:n.includes('zod')?require('zod'):{},Deno:{env:{get:()=>undefined},serve:h=>handler=h},Request,Response,URL,Date,console});
(async()=>{
 let r=await handler(new Request('https://test/api/client/profile'));assert.equal(r.status,401);
 r=await handler(new Request('https://test/api/client/profile',{headers:{authorization:'Bearer invalid'}}));assert.equal(r.status,401);
 identity={id:'unpaid-user',email:'test@example.com'};
 r=await handler(new Request('https://test/api/client/profile',{headers:{authorization:'Bearer verified'}}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{profile:null,chatReady:false});
 r=await handler(new Request('https://test/api/membership',{method:'POST',headers:{authorization:'Bearer verified'}}));assert.equal(r.status,410);
 r=await handler(new Request('https://test/api/membership',{headers:{authorization:'Bearer verified'}}));const data=await r.json();assert.equal(data.free,true);assert.equal(data.paid,false);
 console.log('Passed: free authenticated access, own-user queries, anonymous/invalid-token denial and subscription checkout disabled.');
})().catch(e=>{console.error(e);process.exitCode=1});
