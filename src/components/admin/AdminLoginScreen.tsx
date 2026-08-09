import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export function AdminLoginScreen({ onLogin, onBack }: { onLogin:(email:string,password:string)=>Promise<void>; onBack:()=>void }) {
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  return <main className="min-h-screen bg-[#fdf8f8] grid place-items-center p-5"><form className="w-full max-w-md bg-white border border-[#e0bec6] rounded-3xl p-7 shadow-xl space-y-5" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onLogin(email,password)}catch(x){setError(x instanceof Error?x.message:'Admin login failed.')}finally{setBusy(false)}}}>
    <div className="text-center"><ShieldCheck className="w-12 h-12 text-[#8e004b] mx-auto"/><h1 className="text-2xl font-extrabold mt-3">Nexora Jobs Admin</h1><p className="text-sm text-[#594047]">Restricted approval workspace</p></div>
    <label className="block text-xs font-bold">Admin email<input className="mt-1 w-full border border-[#e0bec6] rounded-xl p-3" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <label className="block text-xs font-bold">Password<input className="mt-1 w-full border border-[#e0bec6] rounded-xl p-3" type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
    {error&&<p className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">{error}</p>}
    <button disabled={busy} className="w-full bg-[#e2007c] text-white rounded-full p-3 font-bold disabled:opacity-60">{busy?'Signing in…':'Sign in as Admin'}</button>
    <button type="button" onClick={onBack} className="w-full text-xs font-bold text-[#8e004b]">Back to Job Portal</button>
  </form></main>;
}
