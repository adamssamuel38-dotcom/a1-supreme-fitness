const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('supabase/functions/payment-sandbox/index.ts','utf8');
async function invoke(user,method='GET'){
 let handler,tableReads=0;
 const context={Request,Response,Error,Deno:{env:{get:()=>''},serve:fn=>handler=fn},createClient:()=>({auth:{getUser:async()=>({data:{user},error:null})},from:()=>{tableReads++;throw Error('Database must not be reached');}}),configured:()=>false,PaymentError:class extends Error{}};
 const code=ts.transpileModule(source.replace(/^import .*;\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 vm.runInNewContext(code,context);const response=await handler(new Request('https://example.com/api/membership',{method,headers:{Authorization:'Bearer mocked','X-App-Origin':'https://a1-supreme-fitness.adamssamuel38.workers.dev'}}));return {response,tableReads};
}
(async()=>{
 let a=await invoke({id:'another-user'});assert.equal(a.response.status,403);assert.equal(a.tableReads,0);
 a=await invoke({id:'5da7c470-f0b9-44fc-9698-036e74621cd6'});assert.equal(a.response.status,200);const d=await a.response.json();assert.equal(d.sandbox,true);assert.equal(d.ready,false);assert.equal(a.tableReads,0);
 const pay=fs.readFileSync('supabase/functions/payment-sandbox/payments.ts','utf8');assert(!pay.includes('https://api-m.paypal.com'));assert(!pay.includes("Deno.env.get('PAYPAL_CLIENT_SECRET')"));assert(pay.includes('https://api-m.sandbox.paypal.com'));assert(source.includes("db.from('sandbox_'+name)"));
 console.log('Passed: non-owner denied before data access; missing sandbox credentials fail closed; isolated API, credentials and tables.');
})();
