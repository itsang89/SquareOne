import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Mail, UserCircle, Apple } from 'lucide-react';
import { NeoButton, NeoCard } from '../components/NeoComponents';

export const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-neo-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative background blob */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-neo-green/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10">
            <div className="mb-10 pl-4 border-l-[6px] border-black">
                <h1 className="text-6xl font-black uppercase leading-[0.85] tracking-tighter mb-4">
                    Square<br/>
                    <span className="bg-neo-yellow px-2 inline-block border-2 border-black shadow-neo-sm transform -skew-x-6 mt-2">One</span>
                </h1>
                <div className="inline-block bg-neo-purple border-2 border-black px-3 py-1 shadow-neo-sm">
                    <span className="text-xs font-bold uppercase tracking-widest text-black">Settle Up. Stay Friends.</span>
                </div>
            </div>

            <NeoCard className="mb-8">
                <div className="mb-6">
                    <label className="block text-sm font-bold uppercase tracking-widest mb-2 ml-1">Enter Email</label>
                    <div className="relative">
                        <input 
                            type="email" 
                            placeholder="friend@example.com" 
                            className="w-full h-14 bg-gray-50 border-2 border-black px-4 text-lg font-bold placeholder:text-gray-400 focus:outline-none focus:bg-neo-yellow/20 focus:shadow-neo transition-all"
                        />
                        <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                    </div>
                </div>

                <NeoButton fullWidth onClick={handleLogin} className="group">
                    <span>Get Magic Link</span>
                    <Zap className="fill-black group-hover:scale-110 transition-transform" />
                </NeoButton>

                <div className="flex items-center gap-4 my-6">
                    <div className="h-[2px] bg-black flex-1 opacity-20"></div>
                    <span className="text-xs font-black uppercase tracking-widest bg-neo-purple/20 px-2 py-1 border border-black transform -rotate-3">Or</span>
                    <div className="h-[2px] bg-black flex-1 opacity-20"></div>
                </div>

                <div className="flex flex-col gap-3">
                    <button className="w-full h-12 bg-neo-pink border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-3 font-bold uppercase text-sm">
                        <UserCircle size={20} /> Google
                    </button>
                    <button className="w-full h-12 bg-neo-blue border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-3 font-bold uppercase text-sm">
                        <Apple size={20} /> Apple
                    </button>
                </div>
            </NeoCard>

            <div className="text-center">
                <button onClick={handleLogin} className="inline-flex items-center gap-2 text-gray-500 font-bold uppercase text-xs hover:text-black hover:underline decoration-2 underline-offset-4 transition-all">
                    Try as Guest
                </button>
                <p className="mt-6 text-[10px] text-gray-400 font-medium max-w-[200px] mx-auto leading-relaxed">
                    By entering, you agree to our Terms & Privacy Policy.
                </p>
            </div>
        </div>
    </div>
  );
};