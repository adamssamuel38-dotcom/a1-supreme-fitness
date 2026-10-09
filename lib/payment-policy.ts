export const PAYPAL_PLAN_ID='P-887347135S7040428NK65IEA';
export const PAYPAL_CLIENT_ID='BAAnW1h8aqAXo4k40cADz6UiNEvnhx2aGFdM5qT2GhVs7cHKnf74Rm_2NgGUg5OvFu5ZRaY6q3ZHaMF1SY';
export function validPlan(plan:any){
 const cycles=plan.billing_cycles;
 const cycle=cycles?.[0];
 return plan.id===PAYPAL_PLAN_ID&&plan.status==='ACTIVE'&&cycles?.length===1&&cycle.tenure_type==='REGULAR'&&cycle.frequency?.interval_unit==='MONTH'&&cycle.frequency?.interval_count===1&&cycle.pricing_scheme?.fixed_price?.currency_code==='USD'&&Number(cycle.pricing_scheme.fixed_price.value)===14.99&&Number(plan.payment_preferences?.setup_fee?.value||0)===0&&Number(plan.taxes?.percentage||0)===0;
}
function nextMonth(time:number){const d=new Date(time);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime();}
export function paidThrough(subscription:any,transactions:any[],binding:{subscription_id:string;request_id:string},now=Date.now()):number|null{
 if(subscription.id!==binding.subscription_id||subscription.custom_id!==binding.request_id||subscription.plan_id!==PAYPAL_PLAN_ID||subscription.plan_overridden===true||!['ACTIVE','CANCELLED','EXPIRED'].includes(subscription.status))return null;
 const last=Date.parse(subscription.billing_info?.last_payment?.time||'');
 if(!Number.isFinite(last)||last>now)return null;
 const matching=transactions.find(t=>t.status==='COMPLETED'&&Date.parse(t.time)===last&&t.amount_with_breakdown?.gross_amount?.currency_code==='USD'&&Number(t.amount_with_breakdown.gross_amount.value)>=14.99);
 if(!matching)return null;
 let end=nextMonth(last);
 const next=Date.parse(subscription.billing_info?.next_billing_time||'');
 if(Number.isFinite(next))end=Math.min(end,next);
 return end>now?end:null;
}
