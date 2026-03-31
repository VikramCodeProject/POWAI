import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Shield, Chrome, Linkedin, Facebook, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import useStore from '@/store/useStore';
import MovingDots from '@/components/MovingDots';
import PageTransition from '@/components/PageTransition';
import { apiLogin, apiRegister, setAuthToken } from '@/lib/api';
import { AnimatedInput } from '@/components/ui/animated-input';
import { toast } from 'sonner';
import powLogo from '../../insipiration/pow.png';

const buttonSpring = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 22,
  mass: 0.65,
};

const Auth = () => {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(location.state?.mode !== 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const reduceMotion = useReducedMotion();

  const setUser = useStore((s) => s.setUser);
  const user = useStore((s) => s.user);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  useEffect(() => {
    if (isTransitioning && targetPath) {
      const primaryTimer = setTimeout(() => {
        navigate(targetPath, { replace: true });
      }, 850);

      // Safety fallback: never let transition overlay hang.
      const fallbackTimer = setTimeout(() => {
        setIsTransitioning(false);
        window.location.href = targetPath;
      }, 2200);

      return () => {
        clearTimeout(primaryTimer);
        clearTimeout(fallbackTimer);
      };
    }
  }, [isTransitioning, targetPath, navigate]);

  if (user && !isTransitioning) {
    return <Navigate to={user.role === 'teacher' ? '/dashboard' : '/workspace'} replace />;
  }

  const triggerMorph = (userName: string, path: string) => {
    setWelcomeName(userName);
    setTargetPath(path);
    setIsTransitioning(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      const res = isLogin
        ? await apiLogin({ email, password, role })
        : await apiRegister({ name: name || email.split('@')[0], email, password, role });

      setAuthToken(res.token);
      setUser(res.user);
      triggerMorph(res.user.name, res.user.role === 'teacher' ? '/dashboard' : '/workspace');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition className="min-h-screen relative overflow-hidden flex flex-col md:flex-row bg-ivory text-slate-ink font-sans isolate transition-colors duration-500">
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute right-4 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/70 text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <MovingDots
        color={theme === 'dark' ? '148, 163, 184' : '30, 41, 59'}
        count={240}
        opacityBase={theme === 'dark' ? 0.26 : 0.16}
        sizeMultiplier={1.3}
      />
      <div className="absolute inset-0 subtle-dot-bg dark:opacity-20 -z-10 bg-repeat mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200/40 blur-3xl pointer-events-none"
        animate={reduceMotion ? undefined : { scale: [1, 1.08, 0.98, 1], opacity: [0.34, 0.5, 0.28, 0.34] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            key="blur-fade-overlay"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(18px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/52 dark:bg-slate-950/62"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="text-center flex flex-col items-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: [1, 1.03, 1] }}
                transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1], repeat: Infinity }}
                className="mb-4"
              >
                <img
                  src={powLogo}
                  alt="POW"
                  className="h-16 w-16 md:h-20 md:w-20 object-contain mix-blend-multiply dark:mix-blend-screen opacity-90"
                />
              </motion.div>
              <p className="text-sm font-semibold tracking-[0.14em] uppercase text-slate-700 dark:text-slate-200">
                {isLogin ? 'Signing In' : 'Creating Account'}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Welcome{welcomeName ? `, ${welcomeName}` : ''}. Preparing your workspace...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => navigate('/')}
        whileHover={{ x: -2, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={buttonSpring}
        className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2 text-slate-muted hover:text-slate-ink dark:hover:text-white transition-colors z-20"
      >
        <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
        <span className="font-semibold text-sm hidden sm:block">Back to Home</span>
      </motion.button>

      <div className="hidden md:flex flex-1 flex-col justify-center px-16 lg:px-24 xl:px-32 z-10">
        <div className="mb-10">
          <div className="w-14 h-14 bg-accent-midnight rounded-lg flex items-center justify-center text-white mb-8 shadow-sm"><Shield className="h-8 w-8" /></div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-ink mb-6 font-headline">Welcome to POWAI</h1>
          <p className="text-lg text-slate-muted max-w-md leading-relaxed mb-12">The proof-of-work academic integrity system that verifies effort, not just output.</p>
          <div className="grid grid-cols-3 gap-8">
            <div><div className="text-2xl font-bold text-slate-ink">99%</div><div className="text-xs font-bold uppercase tracking-widest text-slate-muted mt-1">Accuracy</div></div>
            <div><div className="text-2xl font-bold text-slate-ink">10K+</div><div className="text-xs font-bold uppercase tracking-widest text-slate-muted mt-1">Verified</div></div>
            <div><div className="text-2xl font-bold text-slate-ink">&lt;2s</div><div className="text-xs font-bold uppercase tracking-widest text-slate-muted mt-1">Analysis</div></div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:px-0 z-10">
        <div className="w-full max-w-md space-y-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-8 md:p-10 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
          <div>
            <h2 className="text-3xl font-bold text-slate-ink font-headline">{isLogin ? 'Sign in' : 'Create account'}</h2>
            <p className="text-slate-muted mt-2">{isLogin ? 'Welcome back. Enter your details.' : 'Get started with POWAI today.'}</p>
          </div>
          {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-semibold border border-red-100 dark:border-red-900/50">{error}</div>}
          <form className="flex flex-col" onSubmit={handleSubmit} autoComplete="off">
            <div className={`grid transition-all duration-300 ease-in-out ${!isLogin ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden pt-2"><div className="mb-6">
                <AnimatedInput
                  id="name"
                  label="Full Name"
                  placeholder="John Doe"
                  required={!isLogin}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pt-1"
                />
              </div></div>
            </div>
            <div className="mb-6">
              <AnimatedInput
                id="email"
                name="email"
                label="Email"
                autoComplete="off"
                placeholder="you@example.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="mb-6">
              <AnimatedInput
                id="password"
                name="password"
                label="Password"
                autoComplete="new-password"
                placeholder="••••••••"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-ink mb-3">Role</label>
              <div className="relative grid grid-cols-2 p-1 rounded-xl bg-slate-100/90 border border-slate-200 overflow-hidden">
                <motion.span
                  aria-hidden
                  className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-slate-800 shadow-[0_10px_20px_-14px_rgba(15,23,42,0.8)]"
                  animate={{ x: role === 'teacher' ? '0%' : '100%' }}
                  transition={buttonSpring}
                />
                <motion.button
                  layout
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={buttonSpring}
                  className={`relative z-10 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${role === 'teacher' ? 'text-white' : 'text-slate-muted hover:text-slate-700'}`}
                  onClick={() => setRole('teacher')}
                  type="button"
                  disabled={isSubmitting}
                >
                  Teacher
                </motion.button>
                <motion.button
                  layout
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={buttonSpring}
                  className={`relative z-10 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${role === 'student' ? 'text-white' : 'text-slate-muted hover:text-slate-700'}`}
                  onClick={() => setRole('student')}
                  type="button"
                  disabled={isSubmitting}
                >
                  Student
                </motion.button>
              </div>
            </div>
            <motion.button
              whileHover={{ y: -1.5, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={buttonSpring}
              className="w-full bg-accent-midnight text-white py-4 rounded-lg font-bold text-sm transition-all hover:opacity-90 shadow-sm mt-2 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                {isSubmitting ? (isLogin ? 'Signing in' : 'Creating account') : (isLogin ? 'Sign in' : 'Create account')}
                {isSubmitting && (
                  <motion.span
                    className="inline-flex items-center gap-1"
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.span className="h-1.5 w-1.5 rounded-full bg-white/95" animate={{ y: [0, -2, 0], opacity: [0.35, 1, 0.35] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0 }} />
                    <motion.span className="h-1.5 w-1.5 rounded-full bg-white/95" animate={{ y: [0, -2, 0], opacity: [0.35, 1, 0.35] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.12 }} />
                    <motion.span className="h-1.5 w-1.5 rounded-full bg-white/95" animate={{ y: [0, -2, 0], opacity: [0.35, 1, 0.35] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.24 }} />
                  </motion.span>
                )}
              </span>
            </motion.button>
          </form>

          {/* Social Auth Buttons */}
          <div className="space-y-3">
            <p className="text-center text-xs font-semibold text-slate-muted uppercase tracking-widest">Or continue with</p>
            <div className="grid grid-cols-3 gap-3">
              {/* Facebook */}
              <motion.button
                onClick={() => toast.info('Facebook login coming soon! 🚀')}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={buttonSpring}
                className="group relative h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 opacity-90 hover:opacity-100 hover:brightness-75 transition-all shadow-sm hover:shadow-md overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
                <div className="relative flex items-center justify-center h-full">
                  <motion.div
                    initial={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    transition={buttonSpring}
                  >
                    <Facebook className="w-5 h-5 text-white" />
                  </motion.div>
                </div>
              </motion.button>

              {/* Google */}
              <motion.button
                onClick={() => toast.info('Google login coming soon! 🚀')}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={buttonSpring}
                className="group relative h-12 rounded-lg bg-gradient-to-br from-red-500 to-yellow-500 opacity-90 hover:opacity-100 hover:brightness-75 transition-all shadow-sm hover:shadow-md overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
                <div className="relative flex items-center justify-center h-full">
                  <motion.div
                    initial={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    transition={buttonSpring}
                  >
                    <Chrome className="w-5 h-5 text-white" />
                  </motion.div>
                </div>
              </motion.button>

              {/* LinkedIn */}
              <motion.button
                onClick={() => toast.info('LinkedIn login coming soon! 🚀')}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={buttonSpring}
                className="group relative h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 opacity-90 hover:opacity-100 hover:brightness-75 transition-all shadow-sm hover:shadow-md overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-slate-900/55 opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
                <div className="relative flex items-center justify-center h-full">
                  <motion.div
                    initial={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    transition={buttonSpring}
                  >
                    <Linkedin className="w-5 h-5 text-white" />
                  </motion.div>
                </div>
              </motion.button>
            </div>
          </div>

          <p className="text-center text-sm text-slate-muted">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <motion.button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={buttonSpring}
              className="ml-1 text-slate-ink font-semibold hover:underline"
              disabled={isSubmitting}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </motion.button>
          </p>
        </div>
      </div>

      <header className="absolute top-0 left-0 w-full p-8 md:hidden">
        <div className="flex items-center gap-2.5">
          <img src={powLogo} alt="POWAI logo" className="h-8 w-8 rounded-lg object-contain" />
          <div className="text-xl font-extrabold tracking-tighter text-slate-ink uppercase font-headline">POWAI</div>
        </div>
      </header>
    </PageTransition>
  );
};

export default Auth;
