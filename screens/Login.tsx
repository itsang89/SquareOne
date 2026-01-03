import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Mail, UserCircle, Apple, Lock, Eye, EyeOff } from 'lucide-react';
import { NeoButton, NeoCard } from '../components/NeoComponents';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithEmail, signInWithPassword, signUp, signInWithGoogle, signInWithApple, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loginMode, setLoginMode] = useState<'magic' | 'password'>('magic');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);
    
    // Save remember me preference
    localStorage.setItem('squareone_remember_me', rememberMe.toString());

    if (loginMode === 'magic') {
      const { error } = await signInWithEmail(email);
      
      if (error) {
        setMessage({ type: 'error', text: error.message || 'Failed to send magic link' });
      } else {
        setMessage({ type: 'success', text: 'Check your email for the magic link!' });
      }
    } else {
      if (!password) {
        setMessage({ type: 'error', text: 'Please enter a password' });
        setLoading(false);
        return;
      }

      if (isSignUp) {
        const { error } = await signUp(email, password, name || undefined);
        
        if (error) {
          setMessage({ type: 'error', text: error.message || 'Failed to sign up' });
        } else {
          setMessage({ type: 'success', text: 'Account created! Check your email to verify your account.' });
        }
      } else {
        const { error } = await signInWithPassword(email, password);
        
        if (error) {
          setMessage({ type: 'error', text: error.message || 'Failed to sign in' });
        }
      }
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage(null);
    localStorage.setItem('squareone_remember_me', rememberMe.toString());
    const { error } = await signInWithGoogle();
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to sign in with Google' });
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    setMessage(null);
    localStorage.setItem('squareone_remember_me', rememberMe.toString());
    const { error } = await signInWithApple();
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to sign in with Apple' });
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
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
                {message && (
                    <div className={`mb-4 p-3 border-2 border-black ${
                        message.type === 'success' ? 'bg-neo-green' : 'bg-neo-red'
                    }`}>
                        <p className="text-sm font-bold uppercase text-black">{message.text}</p>
                    </div>
                )}

                {/* Login Mode Toggle */}
                <div className="mb-4 flex gap-2 border-2 border-black bg-gray-100 p-1">
                    <button
                        onClick={() => {
                            setLoginMode('magic');
                            setMessage(null);
                        }}
                        className={`flex-1 py-2 border border-black font-bold text-sm transition-colors ${
                            loginMode === 'magic' 
                                ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' 
                                : 'hover:bg-white text-gray-500 hover:text-black'
                        }`}
                    >
                        Magic Link
                    </button>
                    <button
                        onClick={() => {
                            setLoginMode('password');
                            setMessage(null);
                        }}
                        className={`flex-1 py-2 border border-black font-bold text-sm transition-colors ${
                            loginMode === 'password' 
                                ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' 
                                : 'hover:bg-white text-gray-500 hover:text-black'
                        }`}
                    >
                        Password
                    </button>
                </div>
                
                <form onSubmit={handleEmailLogin}>
                    {isSignUp && loginMode === 'password' && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold uppercase tracking-widest mb-2 ml-1">Name (Optional)</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={loading}
                                    className="w-full h-14 bg-white border-2 border-black px-4 text-lg font-bold placeholder:text-gray-400 focus:outline-none focus:bg-neo-yellow/20 focus:shadow-neo transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-bold uppercase tracking-widest mb-2 ml-1">Enter Email</label>
                        <div className="relative">
                            <input 
                                type="email" 
                                placeholder="friend@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                required
                                className="w-full h-14 bg-white border-2 border-black px-4 text-lg font-bold placeholder:text-gray-400 focus:outline-none focus:bg-neo-yellow/20 focus:shadow-neo transition-all disabled:opacity-50"
                            />
                            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                        </div>
                    </div>

                    {loginMode === 'password' && (
                        <div className="mb-6">
                            <label className="block text-sm font-bold uppercase tracking-widest mb-2 ml-1">Password</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                    className="w-full h-14 bg-white border-2 border-black px-4 pr-12 text-lg font-bold placeholder:text-gray-400 focus:outline-none focus:bg-neo-yellow/20 focus:shadow-neo transition-all disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:opacity-70 transition-opacity"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 mb-6 ml-1">
                        <div 
                            className={`w-6 h-6 border-2 border-black flex items-center justify-center cursor-pointer transition-all ${
                                rememberMe ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'
                            }`}
                            onClick={() => setRememberMe(!rememberMe)}
                        >
                            {rememberMe && <Zap size={14} className="fill-black" />}
                        </div>
                        <label 
                            className="text-xs font-bold uppercase tracking-widest cursor-pointer select-none"
                            onClick={() => setRememberMe(!rememberMe)}
                        >
                            Remember Me
                        </label>
                    </div>

                    <NeoButton fullWidth type="submit" disabled={loading} className="group">
                        <span>
                            {loading 
                                ? (loginMode === 'magic' ? 'Sending...' : isSignUp ? 'Signing up...' : 'Signing in...')
                                : (loginMode === 'magic' 
                                    ? 'Get Magic Link' 
                                    : isSignUp 
                                        ? 'Sign Up' 
                                        : 'Sign In')
                            }
                        </span>
                        {loginMode === 'magic' ? (
                            <Zap className="fill-black group-hover:scale-110 transition-transform" />
                        ) : (
                            <Lock className="fill-black group-hover:scale-110 transition-transform" />
                        )}
                    </NeoButton>

                    {loginMode === 'password' && (
                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setMessage(null);
                                    setPassword('');
                                }}
                                className="text-xs font-bold uppercase text-gray-500 hover:text-black hover:underline decoration-2 underline-offset-4 transition-all"
                            >
                                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                            </button>
                        </div>
                    )}
                </form>

                <div className="flex items-center gap-4 my-6">
                    <div className="h-[2px] bg-black flex-1 opacity-20"></div>
                    <span className="text-xs font-black uppercase tracking-widest bg-neo-purple/20 px-2 py-1 border border-black transform -rotate-3">Or</span>
                    <div className="h-[2px] bg-black flex-1 opacity-20"></div>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full h-12 bg-neo-pink border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-3 font-bold uppercase text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserCircle size={20} /> Google
                    </button>
                    <button 
                        onClick={handleAppleLogin}
                        disabled={loading}
                        className="w-full h-12 bg-neo-blue border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-3 font-bold uppercase text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Apple size={20} /> Apple
                    </button>
                </div>
            </NeoCard>

            <div className="text-center">
                <button onClick={handleGuestLogin} className="inline-flex items-center gap-2 text-gray-500 font-bold uppercase text-xs hover:text-black hover:underline decoration-2 underline-offset-4 transition-all">
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