import {createClient} from 'npm:@supabase/supabase-js@2.102.0';
import {configured,paypal,membershipStatus,createSubscription,PaymentError} from './payments.ts';
import {setPlan} from './payment-policy.ts';
const OWNER='5da7c470-f0b9-44fc-9698-036e74621cd6';
const ORIGIN='https://a1-supreme-fitness.adamssamuel38.workers.dev';
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=req.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token)return json({error:'Sign in to your A1SF account first.'},401);
  const {data,error}=await db.auth.getUser(token);
  if(error||data.user?.id!==OWNER)return json({error:'This sandbox test is restricted to the site owner.'},403);
  if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed.'},405);
  if(req.headers.get('X-App-Origin')!==ORIGIN)return json({error:'Use the A1SF sandbox test page.'},403);
  if(!configured())return json({sandbox:true,ready:false,paid:false,status:'Add PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET in Supabase.'});
  const config=await db.from('sandbox_payment_config').select('*').eq('id',1).single();
  if(config.error)throw Error('Sandbox configuration unavailable.');
  let plan=config.data.plan_id;
  if(!plan&&req.method==='POST'){
   const product=await paypal('/v1/catalogs/products','POST',{name:'A1SF sandbox membership',type:'SERVICE',category:'SOFTWARE'},config.data.request_id+'-prod');
   const created=await paypal('/v1/billing/plans','POST',{product_id:product.id,name:'A1SF Supreme Access TEST',status:'ACTIVE',billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:'14.99',currency_code:'USD'}}}],payment_preferences:{auto_bill_outstanding:true,setup_fee:{value:'0',currency_code:'USD'},payment_failure_threshold:2}},config.data.request_id+'-plan');
   if(typeof created.id!=='string'||!created.id.startsWith('P-'))throw Error('Sandbox plan creation failed.');
   const save=await db.from('sandbox_payment_config').update({plan_id:created.id}).eq('id',1).is('plan_id',null);
   if(save.error)throw Error('Could not save sandbox plan.');
   const saved=await db.from('sandbox_payment_config').select('plan_id').eq('id',1).single();
   if(saved.error||!saved.data.plan_id)throw Error('Could not read sandbox plan.');plan=saved.data.plan_id;
  }
  if(!plan)return json({sandbox:true,ready:true,paid:false,status:'Ready. Start sandbox checkout to create the test plan.'});
  setPlan(plan);
  // No route in this function can access or activate live memberships.
  const isolated={from:(name:string)=>{if(!['memberships','membership_attempts'].includes(name))throw Error('Invalid sandbox table');return db.from('sandbox_'+name);}};
  const result=req.method==='POST'?await createSubscription(isolated,OWNER,ORIGIN):await membershipStatus(isolated,OWNER);
  return json({...result,sandbox:true});
 }catch(e){return json({error:e instanceof PaymentError?e.message:'Sandbox test is temporarily unavailable. Retry after checking the sandbox credentials.'},e instanceof PaymentError?e.status:503);}
});
