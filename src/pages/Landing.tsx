import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import MovingDots from '@/components/MovingDots';
import PageTransition from '@/components/PageTransition';
import useStore from '@/store/useStore';
import powLogo from '../../insipiration/pow.png';

const Landing = () => {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const reduceMotion = useReducedMotion();

  const handleGetStarted = () => {
    if (user) {
      navigate(user.role === 'teacher' ? '/dashboard' : '/workspace');
    } else {
      navigate('/auth', { state: { mode: 'login' } });
    }
  };



  return (
    <PageTransition className="bg-background font-body text-foreground selection:bg-accent selection:text-accent-foreground min-h-screen relative font-sans isolate transition-colors duration-500">
      <MovingDots
        color={theme === 'dark' ? '148, 163, 184' : '0, 0, 0'}
        count={460}
        opacityBase={theme === 'dark' ? 0.28 : 0.16}
        sizeMultiplier={1.35}
      />

      {/* TopNavBar Shell */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/85 backdrop-blur-2xl backdrop-saturate-200 shadow-sm">
        <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 max-w-full">
          <button
            onClick={() => {
              if (user) {
                navigate(user.role === 'teacher' ? '/dashboard' : '/workspace');
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <img src={powLogo} alt="POWAI" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-contain" />
            <span className="text-lg sm:text-xl font-bold tracking-tighter text-foreground font-headline hidden sm:block">POWAI</span>
          </button>
          <div className="hidden md:flex items-center gap-8 font-medium text-sm tracking-tight">
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/70 text-foreground transition-colors hover:bg-accent"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {!user && (
              <button
                onClick={() => navigate('/auth', { state: { mode: 'signup' } })}
                className="text-sm font-semibold hover:text-primary transition-colors text-muted-foreground hidden sm:block"
              >
                Sign Up
              </button>
            )}
            <button
              onClick={handleGetStarted}
              className="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-dim transition-all active:opacity-80 active:scale-95"
            >
              {user ? 'Go to Dashboard' : 'Get Started'}
            </button>
          </div>
        </div>
      </nav>

      <main className="relative pt-32 pb-24 overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute inset-0 subtle-dot-bg dark:opacity-20 -z-10 bg-repeat decoration-slate-400 pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-fixed-dim/20 dark:bg-primary-fixed-dim/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/4 -z-10 pointer-events-none"></div>
        <motion.div
          aria-hidden
          className="absolute -left-28 top-20 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl pointer-events-none -z-10"
          animate={reduceMotion ? undefined : { x: [0, 36, -12, 0], y: [0, -24, 18, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute right-10 top-40 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl pointer-events-none -z-10"
          animate={reduceMotion ? undefined : { x: [0, -28, 10, 0], y: [0, 24, -14, 0], scale: [1, 0.95, 1.06, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />
        <motion.div
          aria-hidden
          className="absolute bottom-8 left-1/3 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl pointer-events-none -z-10"
          animate={reduceMotion ? undefined : { x: [0, 22, -18, 0], y: [0, -16, 14, 0], scale: [1, 1.04, 0.98, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        />

        {/* Hero Section */}
        <motion.section
          className="max-w-7xl mx-auto px-6 mb-32"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="max-w-4xl">
            <div className="inline-flex items-center px-3 py-1 bg-accent rounded-full mb-8">
              <span className="text-[10px] uppercase tracking-widest font-bold text-accent-foreground">Academic Integrity Platform</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-foreground font-headline mb-8 leading-[1.1]">
              Verify Authentic Learning,<br />Not Just Final Submissions.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10 font-body">
              Traditional grading only looks at the final output. POWAI analyzes the cognitive process—tracking typing cadence, behavioral patterns, and revision history to ensure 100% genuine, AI-free student work.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleGetStarted}
                className="bg-primary text-on-primary px-8 py-4 rounded-xl text-md font-bold hover:shadow-xl hover:shadow-primary/10 transition-all flex items-center gap-2"
              >
                {user ? 'Open Workspace' : 'Access Platform'}
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </motion.section>

        {/* Bento Visualization Section */}
        <motion.section
          className="max-w-7xl mx-auto px-6 mb-32"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.12 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="grid grid-cols-12 gap-6">
            {/* Large Feature: Cognitive Load Index */}
            <div className="col-span-12 md:col-span-8 bg-white/10 dark:bg-white/5 p-10 rounded-2xl shadow-lg border border-white/20 dark:border-white/10 backdrop-blur-xl group hover:border-primary/40 hover:bg-white/15 dark:hover:bg-white/10 transition-all relative z-10">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <span className="label-sm uppercase tracking-[0.1em] text-[10px] font-bold text-primary mb-2 block font-label">Real-time Analytics</span>
                  <h3 className="text-3xl font-bold font-headline">Authenticity Score Index</h3>
                </div>
                <div className="bg-surface-container-low p-2 rounded-lg">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                </div>
              </div>
              <div className="relative h-64 w-full flex items-end justify-between gap-1 mb-6">
                <div className="w-full h-24 bg-primary-fixed-dim/30 rounded-t-lg transition-all group-hover:h-32"></div>
                <div className="w-full h-32 bg-primary-fixed-dim/40 rounded-t-lg transition-all group-hover:h-48"></div>
                <div className="w-full h-48 bg-primary/60 rounded-t-lg transition-all group-hover:h-56"></div>
                <div className="w-full h-36 bg-primary-fixed-dim/40 rounded-t-lg transition-all group-hover:h-40"></div>
                <div className="w-full h-56 bg-primary rounded-t-lg transition-all group-hover:h-64"></div>
                <div className="w-full h-40 bg-primary-fixed-dim/50 rounded-t-lg transition-all group-hover:h-44"></div>
                <div className="w-full h-28 bg-primary-fixed-dim/30 rounded-t-lg transition-all group-hover:h-36"></div>
              </div>
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-outline-variant/10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Average Authenticity</p>
                  <p className="text-2xl font-bold text-on-surface font-headline">94.2%</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Genuine Effort</p>
                  <p className="text-2xl font-bold text-on-surface font-headline">5h 12m</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Anomaly Flags</p>
                  <p className="text-2xl font-bold text-on-surface font-headline">Low</p>
                </div>
              </div>
            </div>

            {/* Side Feature: Typing Consistency */}
            <div className="col-span-12 md:col-span-4 bg-white/10 dark:bg-white/5 p-8 rounded-2xl shadow-lg border border-white/20 dark:border-white/10 backdrop-blur-xl z-10">
              <div className="bg-white/20 dark:bg-white/10 p-6 rounded-xl mb-6 backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-primary mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>keyboard</span>
                <h4 className="text-lg font-bold mb-2 font-headline">Typing Cadence</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed font-body">
                  Verifying genuine human rhythms to detect AI-generated code dumps and sudden mass-pasting events.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                  <span>Human Signature</span>
                  <span className="text-primary">Verified</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
                  <div className="w-[88%] h-full bg-primary"></div>
                </div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-tight">
                  <span>AI Variance</span>
                  <span>2.4%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
                  <div className="w-[12%] h-full bg-outline-variant"></div>
                </div>
              </div>
            </div>

            {/* Bottom Features */}
            <div className="col-span-12 md:col-span-4 bg-white/10 dark:bg-white/5 p-8 rounded-2xl shadow-lg border border-white/20 dark:border-white/10 backdrop-blur-xl z-10">
              <h4 className="text-xl font-bold mb-4 font-headline">Revision Integrity</h4>
              <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">
                Measures the natural progression of an assignment—how a student builds, edits, and refines their original work.
              </p>
              <img
                className="w-full h-40 object-contain rounded-lg shadow-sm bg-surface-container p-1"
                alt="Architecture"
                loading="lazy"
                decoding="async"
                src="/revision-integrity.png"
              />
            </div>

            <div className="col-span-12 md:col-span-8 bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-slate-900/80 dark:from-primary/30 dark:via-primary/20 dark:to-slate-900/40 p-10 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl text-white relative overflow-hidden z-10">
              <div className="relative z-10">
                <h4 className="text-2xl font-bold mb-4 font-headline">Zero-Plagiarism Assurance</h4>
                <p className="text-surface-variant/80 text-lg max-w-lg mb-8 font-body">
                  Our analytics algorithm precisely detects sudden spikes in completion metrics, flagging suspicious behavioral patterns instantly.
                </p>
                <button
                  onClick={handleGetStarted}
                  className="bg-surface-container-lowest text-on-background px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-surface-bright transition-all"
                >
                  Start Tracking Effort
                  <span className="material-symbols-outlined scale-75">arrow_forward</span>
                </button>
              </div>
              <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-gradient-to-l from-primary/20 to-transparent flex items-center justify-center">
                <span className="material-symbols-outlined text-[120px] opacity-10" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Product Details / Asymmetric Layout */}
        <motion.section
          className="max-w-7xl mx-auto px-4 sm:px-6 mb-20 md:mb-32 grid grid-cols-12 gap-8 md:gap-12"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.12 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="col-span-12 md:col-span-5 md:mt-24 z-10">
            <div className="bg-primary-fixed-dim/20 w-12 h-12 flex items-center justify-center rounded-lg mb-8">
              <span className="material-symbols-outlined text-primary">psychology</span>
            </div>
            <h2 className="text-3xl sm:text-4xl max-[380px]:text-2xl font-bold font-headline mb-5 sm:mb-6 leading-tight">Focus on the Process, Not the Product.</h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-6 sm:mb-8 font-body max-[380px]:text-[13px]">
              Modern education faces unprecedented challenges with generative AI. POWAI tracks the pauses, the deletions, and the gradual evolution of assignments that define a student's actual learning journey.
            </p>
            <ul className="space-y-3 sm:space-y-4 font-body max-[380px]:space-y-2.5">
              <li className="flex items-center gap-2.5 sm:gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-medium text-sm sm:text-base max-[380px]:text-[13px]">Submission timeline tracking</span>
              </li>
              <li className="flex items-center gap-2.5 sm:gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-medium text-sm sm:text-base max-[380px]:text-[13px]">Large-paste and AI-generation detection</span>
              </li>
              <li className="flex items-center gap-2.5 sm:gap-3">
                <span className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-medium text-sm sm:text-base max-[380px]:text-[13px]">Behavioral anomaly highlighting</span>
              </li>
            </ul>
          </div>
          <div className="col-span-12 md:col-span-7 z-10">
            <div className="relative overflow-hidden bg-white/10 dark:bg-white/5 p-3 sm:p-4 rounded-2xl backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-lg">
              <img
                className="w-full h-auto max-h-[62vh] sm:max-h-[70vh] md:max-h-none object-cover rounded-xl shadow-2xl"
                alt="Code editor"
                src="/process-tracking.png"
              />
              <div className="absolute -bottom-8 -left-8 bg-white/15 dark:bg-white/10 p-6 rounded-xl shadow-xl border border-white/20 dark:border-white/10 backdrop-blur-xl max-w-xs hidden md:block">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center font-bold text-white">JS</div>
                  <div>
                    <p className="text-sm font-bold font-headline text-slate-900 dark:text-white">James Sterling</p>
                    <p className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-label">Computer Science Student</p>
                  </div>
                </div>
                <div className="h-2 w-full bg-white/20 rounded-full mb-2 flex">
                  <div className="h-full w-4/5 bg-gradient-to-r from-primary to-primary/60 rounded-full"></div>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 font-label">Authenticity Verified: 98th Percentile</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          className="max-w-5xl mx-auto px-6 mb-32 z-10 relative"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="bg-gradient-to-br from-white/15 via-white/10 to-white/5 dark:from-white/8 dark:via-white/5 dark:to-white/3 rounded-3xl p-16 text-center border border-white/20 dark:border-white/10 backdrop-blur-xl shadow-lg">
            <h2 className="text-4xl font-extrabold font-headline mb-6 text-slate-900 dark:text-white">Protect Your Institution's Academic Integrity.</h2>
            <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-body">
              Create an educator account today to secure your classroom with verifiable, undeniable proof-of-work tracking and value genuine human effort.
            </p>
            <div className="flex justify-center">
              <button
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-primary to-primary/80 text-white px-12 py-5 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 border border-primary/30 backdrop-blur-sm"
              >
                {user ? 'Return to Application' : 'Get Started for Free'}
              </button>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer Shell */}
      <footer className="w-full border-t border-white/10 dark:border-white/5 bg-white/5 dark:bg-slate-900/50 backdrop-blur-lg relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 py-12 max-w-7xl mx-auto gap-6">
          <div className="flex items-center gap-2.5 text-lg font-black text-slate-900 dark:text-white font-headline">
            <img src={powLogo} alt="POWAI" className="h-8 w-8 rounded-lg object-contain" />
            POWAI
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-xs tracking-wide uppercase font-medium font-body">
            <a className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hover:underline decoration-slate-300 dark:decoration-slate-600 underline-offset-4" href="#">Documentation</a>
            <a className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hover:underline decoration-slate-300 dark:decoration-slate-600 underline-offset-4" href="#">Changelog</a>
            <a className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hover:underline decoration-slate-300 dark:decoration-slate-600 underline-offset-4" href="#">Status</a>
            <a className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hover:underline decoration-slate-300 dark:decoration-slate-600 underline-offset-4" href="#">Privacy</a>
          </div>
          <div className="text-slate-600 dark:text-slate-400 font-body text-xs tracking-wide uppercase font-medium">
            © 2026 POWAI. Built for the modern architect.
          </div>
        </div>
      </footer>
    </PageTransition>
  );
};

export default Landing;
