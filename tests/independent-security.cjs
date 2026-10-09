const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(file,imports,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in imports)return imports[n];throw Error('Unexpected import '+n);},Request,Response,Headers,URL,Date,console,AbortSignal,...extra});return exports;}
const policy=load('lib/payment-policy.ts',{});
const now=Date.parse('2026-10-09T12:00:00Z'),binding={subscription_id:'I-TEST',request_id:'trusted-id'};
const sub={id:'I-TEST',custom_id:'trusted-id',plan_id:policy.PAYPAL_PLAN_ID,status:'ACTIVE',billing_info:{last_payment:{time:'2026-10-08T12:00:00Z'},next_billing_time:'2026-11-08T12:00:00Z'}};
const tx={status:'COMPLETED',time:sub.billing_info.last_payment.time,amount_with_breakdown:{gross_amount:{currency_code:'USD',value:'14.99'}}};
assert.ok(policy.paidThrough(sub,[tx],binding,now));assert.equal(policy.paidThrough(sub,[],binding,now),null);
for(const status of ['PENDING','FAILED','DECLINED','REFUNDED'])assert.equal(policy.paidThrough(sub,[{...tx,status}],binding,now),null);
assert.equal(policy.paidThrough({...sub,custom_id:'another-user'},[tx],binding,now),null);
assert.equal(policy.paidThrough(sub,[{...tx,amount_with_breakdown:{gross_amount:{currency_code:'EUR',value:'14.99'}}}],binding,now),null);
assert.equal(policy.paidThrough(sub,[tx],binding,Date.parse('2026-12-01')),null);
let apiCalls=0;const sb={auth:{getUser:async()=>({data:{user:null},error:{message:'Invalid token'}}),refreshSession:async()=>({data:{session:null},error:{message:'Invalid token'}})}};
const worker=load('worker.ts',{'@supabase/supabase-js':{createClient:()=>sb}},{fetch:async()=>{apiCalls++;throw Error('Unauthorized upstream call');}}).default;
const env={ASSETS:{fetch:async()=>new Response('public')},SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public'};
(async()=>{
for(const headers of [{},{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'},{cookie:'__Host-a1-access=forged'}]){
 const r=await worker.fetch(new Request('https://a1supremefit.net/api/client/profile',{headers}),env);assert.equal(r.status,401);
}
assert.equal(apiCalls,0);
let r=await worker.fetch(new Request('https://a1supremefit.net/api/auth/login',{method:'POST',headers:{origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'}),env);assert.equal(r.status,403);
r=await worker.fetch(new Request('https://a1supremefit.net/api/session'),env);assert.deepEqual(await r.json(),{user:null});
assert.equal(r.headers.get('cache-control'),'no-store');
console.log('Passed: payment evidence, subscription ownership, expired payment, forged headers/tokens, CSRF and private-session caching.');
})().catch(e=>{console.error(e);process.exitCode=1;});
