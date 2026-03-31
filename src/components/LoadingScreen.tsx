import { motion } from 'framer-motion';

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
}

const LoadingScreen = ({
  title = 'Analyzing Work Pattern...',
  subtitle = 'Evaluating typing behavior and authenticity',
}: LoadingScreenProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md"
  >
    <div className="flex flex-col items-center gap-8">
      <div className="relative h-16 w-16">
        <svg className="h-16 w-16 animate-spin" style={{ animationDuration: '1.5s' }} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeDasharray="80 176"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="relative h-0.5 w-52 overflow-hidden rounded-full bg-muted">
        <div className="animate-analyzing-line absolute h-full rounded-full bg-primary/60" />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium tracking-wide text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  </motion.div>
);

export default LoadingScreen;
