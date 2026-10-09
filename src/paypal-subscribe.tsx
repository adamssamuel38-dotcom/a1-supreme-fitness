'use client';
import {useEffect,useState} from 'react';
async function paymentApi(method='GET'){
 const response=await fetch('/api/membership',{method,headers:{'Content-Type':'application/json'},cache:'no-store'});
 const data=await response.json() as any;
 if(!response.ok)throw new Error(data.error||'Payment verification is unavailable.');
 return data;
}
export default function PayPalSubscribe(){
 const [status,setStatus]=useState('Continue to PayPal to review your $14.99 monthly membership.');
 const [failed,setFailed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [paid,setPaid]=useState(false);
 async function verify(){
  setBusy(true);setFailed(false);
  try{const data=await paymentApi();setPaid(!!data.paid);
   setStatus(data.paid?'Payment verified. Your client account is ready.':data.status==='CHECKOUT_UNAVAILABLE'?'Your previous checkout is no longer available. Continue to PayPal to start a new checkout.':data.status==='APPROVAL_PENDING'?'Your checkout is waiting for approval. Continue to PayPal to finish.':data.status==='NOT_SUBSCRIBED'?'Complete your first payment to activate your client account.':!data.ready?'Checkout is temporarily unavailable. Please try again shortly.':'Payment has not yet been confirmed. Check payment status after completing checkout.');
  }catch(e){setFailed(true);setStatus(e instanceof Error?e.message:'Payment could not be verified.');}
  finally{setBusy(false);}
 }
 async function subscribe(){
  setBusy(true);setFailed(false);
  try{const data=await paymentApi('POST');const url=new URL(data.approvalUrl);
   if(url.protocol!=='https:'||url.hostname!=='www.paypal.com')throw Error('PayPal checkout link is unavailable.');
   window.location.assign(url.href);
  }catch(e){setFailed(true);setStatus(e instanceof Error?e.message:'Checkout could not open.');setBusy(false);}
 }
 useEffect(()=>{void verify();},[]);
 return <div className="paypal-checkout" style={{marginTop:24}}>
  {paid?<a className="button primary" href="/app">Open my client account</a>:<button className="button full" style={{background:'#ffc439',color:'#003087',border:'2px solid #ffc439',minHeight:52,borderRadius:28,fontWeight:700}} disabled={busy} onClick={()=>void subscribe()}>{busy?'Please wait…':'Continue to PayPal'}</button>}
  <p className="fine">$14.99 USD per month. Review and approve your subscription securely on PayPal.</p>
  <p role={failed?'alert':'status'}>{status}</p>
  <button className="button outline" disabled={busy} onClick={()=>void verify()}>Check payment status</button>
 </div>;
}
