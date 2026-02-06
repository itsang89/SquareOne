import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Apple, Lock, Eye, EyeOff, UserCircle } from 'lucide-react';
import { NeoButton, NeoCard, NeoInput } from '../components/NeoComponents';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContext';
import { isValidEmail } from '../utils/validation';
import { springs, slideInRight, slideInLeft, staggerContainer, staggerItem } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { 
    signInWithPassword, 
    signUp, 
    signInWithGoogle, 
    signInWithApple, 
    signInAsGuest,
    user, 
    isProcessing 
  } = useAuth();
  const { success, error: showError } = useToast();
  const { getVariants, getTransition } = useAnimations();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setEmailError('');
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Save remember me preference
    localStorage.setItem('squareone_remember_me', rememberMe.toString());

    if (isSignUp) {
      const { error } = await signUp(email, password, name || undefined);
      if (error) {
        showError('Sign up failed', error.message);
      } else {
        success('Account created!', 'Check your email to verify your account.');
      }
    } else {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        showError('Sign in failed', error.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    localStorage.setItem('squareone_remember_me', rememberMe.toString());
    const { error } = await signInWithGoogle();
    if (error) {
      showError('Google sign in failed', error.message);
    }
  };

  const handleAppleLogin = async () => {
    localStorage.setItem('squareone_remember_me', rememberMe.toString());
    const { error } = await signInWithApple();
    if (error) {
      showError('Apple sign in failed', error.message);
    }
  };

  const handleGuestLogin = () => {
    signInAsGuest();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-neo-bg dark:bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
        {/* Decorative background blob */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-neo-green/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10">
            <div className="mb-10 pl-4 border-l-[6px] border-black dark:border-zinc-100">
                <h1 className="text-6xl font-black uppercase leading-[0.85] tracking-tighter mb-4 dark:text-zinc-100">
                    Square<br/>
                    <span className="bg-neo-yellow px-2 inline-block border-2 border-black shadow-neo-sm transform -skew-x-6 mt-2 text-black">One</span>
                </h1>
                <div className="inline-block bg-neo-purple border-2 border-black px-3 py-1 shadow-neo-sm">
                    <span className="text-xs font-bold uppercase tracking-widest text-black">Settle Up. Stay Friends.</span>
                </div>
            </div>

            <NeoCard className="mb-8">
                <motion.form 
                  onSubmit={handleEmailLogin}
                  variants={getVariants(staggerContainer)}
                  initial="hidden"
                  animate="visible"
                  key={isSignUp ? 'signup' : 'signin'}
                >
                    <AnimatePresence mode="wait">
                      {isSignUp && (
                        <motion.div
                          variants={getVariants(staggerItem)}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          transition={getTransition(springs.bouncy)}
                        >
                          <NeoInput
                            label="Name (Optional)"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isProcessing}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div variants={getVariants(staggerItem)}>
                      <NeoInput
                        label="Enter Email"
                        type="email"
                        placeholder="friend@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isProcessing}
                        error={emailError}
                        required
                      />
                    </motion.div>

                    <motion.div 
                      className="relative"
                      variants={getVariants(staggerItem)}
                    >
                      <NeoInput
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isProcessing}
                        required
                        className="pr-12"
                      />
                      <motion.button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-[38px] text-black dark:text-zinc-100"
                        tabIndex={-1}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={showPassword ? 'eyeoff' : 'eye'}
                            initial={{ rotate: -180, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 180, opacity: 0 }}
                            transition={springs.bouncy}
                          >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </motion.div>
                        </AnimatePresence>
                      </motion.button>
                    </motion.div>

                    <motion.div 
                      className="flex items-center gap-2 mb-6 ml-1"
                      variants={getVariants(staggerItem)}
                    >
                        <motion.button
                            type="button"
                            className={`w-6 h-6 border-2 border-black flex items-center justify-center cursor-pointer ${
                                rememberMe ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white dark:bg-zinc-800'
                            }`}
                            onClick={() => setRememberMe(!rememberMe)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <AnimatePresence>
                              {rememberMe && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={springs.bouncy}
                                >
                                  <Mail size={14} className="fill-black" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                        </motion.button>
                        <label 
                            className="text-xs font-bold uppercase tracking-widest cursor-pointer select-none dark:text-zinc-100"
                            onClick={() => setRememberMe(!rememberMe)}
                        >
                            Remember Me
                        </label>
                    </motion.div>

                    <motion.div variants={getVariants(staggerItem)}>
                      <NeoButton fullWidth type="submit" isLoading={isProcessing} className="group">
                          {!isProcessing && (
                            <>
                              <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
                              <Lock className="fill-black group-hover:scale-110 transition-transform" />
                            </>
                          )}
                      </NeoButton>
                    </motion.div>

                    <motion.div 
                      className="mt-4 text-center"
                      variants={getVariants(staggerItem)}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setPassword('');
                                setEmailError('');
                            }}
                            className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-100 hover:underline decoration-2 underline-offset-4 transition-all"
                        >
                            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                        </button>
                    </motion.div>
                </motion.form>

                <div className="flex items-center gap-4 my-6">
                    <div className="h-[2px] bg-black dark:bg-zinc-100 flex-1 opacity-20"></div>
                    <span className="text-xs font-black uppercase tracking-widest bg-neo-purple/20 px-2 py-1 border border-black dark:border-zinc-100 dark:text-zinc-100 transform -rotate-3">Or</span>
                    <div className="h-[2px] bg-black dark:bg-zinc-100 flex-1 opacity-20"></div>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleGoogleLogin}
                        disabled={isProcessing}
                        className="w-full h-12 bg-neo-pink text-black border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-3 font-bold uppercase text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserCircle size={20} /> Google
                    </button>
                    <button 
                        onClick={handleAppleLogin}
                        disabled={isProcessing}
                        className="w-full h-12 bg-neo-blue text-black border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-3 font-bold uppercase text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Apple size={20} /> Apple
                    </button>
                </div>
            </NeoCard>

            <div className="text-center">
                <button onClick={handleGuestLogin} className="inline-flex items-center gap-2 text-gray-500 dark:text-zinc-500 font-bold uppercase text-xs hover:text-black dark:hover:text-zinc-100 hover:underline decoration-2 underline-offset-4 transition-all">
                    Try as Guest
                </button>
                <p className="mt-6 text-[10px] text-gray-400 dark:text-zinc-500 font-medium max-w-[200px] mx-auto leading-relaxed">
                    By entering, you agree to our Terms & Privacy Policy.
                </p>
            </div>
        </div>
    </div>
  );
};
