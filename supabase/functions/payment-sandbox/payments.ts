// Isolated sandbox copy of the live payment flow; never uses live credentials.
import {PAYPAL_CLIENT_ID,PAYPAL_PLAN_ID,paidThrough,validPlan} from './payment-policy.ts';
export class PaymentError extends Error {constructor(message:string,public status=503){super(message);}}
let cached:{value:string;expires:number}|undefined;
export const configured=()=>!!Deno.env.get('PAYPAL_SANDBOX_CLIENT_SECRET')&&!!PAYPAL_CLIENT_ID;
export async function paypal(path:string,method='GET',body?:unknown,id?:string):Promise<any>{
 if(!configured())throw new PaymentError('Membership checkout is awaiting payment service activation. No payment has been taken.');
 if(!cached||cached.expires<Date.now()){
  const r=await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(PAYPAL_CLIENT_ID+':'+Deno.env.get('PAYPAL_SANDBOX_CLIENT_SECRET')),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new PaymentError('PayPal connection is temporarily unavailable.');const d=await r.json();if(!d.access_token)throw new PaymentError('PayPal connection failed.');cached={value:d.access_token,expires:Date.now()+240000};
 }
 const r=await fetch('https://api-m.sandbox.paypal.com'+path,{method,headers:{Authorization:'Bearer '+cached.value,'Content-Type':'application/json',...(id?{'PayPal-Request-Id':id}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 if(!r.ok){const d=await r.json().catch(()=>({}));if(r.status===404&&d.name==='RESOURCE_NOT_FOUND'&&d.details?.some((x:any)=>x.issue==='INVALID_RESOURCE_ID'))throw new PaymentError('CHECKOUT_UNAVAILABLE',404);throw new PaymentError('PayPal could not verify this membership. No access has been activated. Please try again later.');}return r.json();
}
async function binding(db:any,user:string){const {data,error}=await db.from('memberships').select('*').eq('user_id',user).maybeSingle();if(error)throw new PaymentError('Membership storage is unavailable.');return data;}
export async function membershipStatus(db:any,user:string){
 if(!configured())return {paid:false,ready:false,status:'UNAVAILABLE'};
 const row=await binding(db,user);if(!row?.subscription_id)return {paid:false,ready:true,status:'NOT_SUBSCRIBED'};
 let sub;try{sub=await paypal('/v1/billing/subscriptions/'+encodeURIComponent(row.subscription_id));}catch(e){if(e instanceof PaymentError&&e.status===404)return {paid:false,ready:true,status:'CHECKOUT_UNAVAILABLE'};throw e;}
 if(sub.id!==row.subscription_id||sub.custom_id!==row.request_id||sub.plan_id!==PAYPAL_PLAN_ID)throw new PaymentError('Membership verification failed.');
 let until:number|null=null;
 if(['ACTIVE','CANCELLED','EXPIRED'].includes(sub.status)&&sub.billing_info?.last_payment?.time){const params=new URLSearchParams({start_time:new Date(Date.now()-35*86400000).toISOString(),end_time:new Date().toISOString()});const tx=await paypal('/v1/billing/subscriptions/'+encodeURIComponent(row.subscription_id)+'/transactions?'+params);until=paidThrough(sub,tx.transactions||[],row);}
 const status=({ACTIVE:'active',CANCELLED:'cancelled',EXPIRED:'expired',SUSPENDED:'suspended'} as any)[sub.status]||'pending';
 const {error}=await db.from('memberships').update({status,paid_until:until?new Date(until).toISOString():null,verified_at:new Date().toISOString()}).eq('user_id',user).eq('request_id',row.request_id);if(error)throw new PaymentError('Could not save payment verification.');
 return {paid:!!until,ready:true,status:sub.status,paidUntil:until?new Date(until).toISOString():null};
}
function checkout(sub:any){const link=sub.links?.find((x:any)=>x.rel==='approve')?.href;if(typeof link!=='string')throw new PaymentError('PayPal did not return a checkout link.');const u=new URL(link);if(u.protocol!=='https:'||u.hostname!=='www.sandbox.paypal.com')throw new PaymentError('Invalid PayPal checkout link.');return {subscriptionID:sub.id,approvalUrl:u.href};}
export async function createSubscription(db:any,user:string,origin:string){
 const allowed=(Deno.env.get('APP_ORIGINS')||'https://a1supremefit.net,https://www.a1supremefit.net').split(',').map(s=>s.trim());
 if(!allowed.includes(origin))throw new PaymentError('Checkout is not enabled for this website address yet.',403);
 const plan=await paypal('/v1/billing/plans/'+PAYPAL_PLAN_ID);if(!validPlan(plan))throw new PaymentError('The membership plan needs review. No subscription was created.');
 const insert=await db.from('memberships').upsert({user_id:user,request_id:crypto.randomUUID()},{onConflict:'user_id',ignoreDuplicates:true});if(insert.error)throw new PaymentError('Could not prepare checkout.');
 let row=await binding(db,user);
 if(row.subscription_id){
  let sub;try{sub=await paypal('/v1/billing/subscriptions/'+encodeURIComponent(row.subscription_id));}catch(e){
   if(!(e instanceof PaymentError)||e.status!==404)throw e;
   const archive=await db.from('membership_attempts').upsert({request_id:row.request_id,user_id:user,subscription_id:row.subscription_id,created_at:row.created_at},{onConflict:'request_id',ignoreDuplicates:true});if(archive.error)throw new PaymentError('Could not preserve the prior checkout.');
   const next=crypto.randomUUID();const update=await db.from('memberships').update({request_id:next,subscription_id:null,created_at:new Date().toISOString(),status:'pending',paid_until:null,verified_at:null}).eq('user_id',user).eq('request_id',row.request_id).select();if(update.error||!update.data?.length)throw new PaymentError('Checkout changed in another tab. Please retry.',409);row=update.data[0];
  }
  if(sub){if(sub.custom_id!==row.request_id||sub.plan_id!==PAYPAL_PLAN_ID)throw new PaymentError('Membership verification failed.');if(sub.status==='APPROVAL_PENDING')return checkout(sub);throw new PaymentError('An existing subscription is linked to this account. Check payment status or manage it in PayPal before subscribing again.',409);}
 }
 if(Date.now()-Date.parse(row.created_at)>20*3600000)throw new PaymentError('This checkout needs review before retrying. Please contact A1 Supreme Fitness.',409);
 const sub=await paypal('/v1/billing/subscriptions','POST',{plan_id:PAYPAL_PLAN_ID,custom_id:row.request_id,application_context:{brand_name:'A1 Supreme Fitness',shipping_preference:'NO_SHIPPING',user_action:'SUBSCRIBE_NOW',return_url:origin+'/sandbox.html?payment=return',cancel_url:origin+'/sandbox.html?payment=cancel'}},row.request_id);
 if(typeof sub.id!=='string'||!/^I-[A-Z0-9]+$/.test(sub.id))throw new PaymentError('PayPal returned an invalid subscription.');
 const result=await db.from('memberships').update({subscription_id:sub.id}).eq('user_id',user).eq('request_id',row.request_id).is('subscription_id',null);if(result.error)throw new PaymentError('Checkout link could not be saved. Check payment status before trying again.');
 const saved=await binding(db,user);if(saved.subscription_id!==sub.id)throw new PaymentError('Checkout changed. Check payment status before trying again.');return checkout(sub);
}
