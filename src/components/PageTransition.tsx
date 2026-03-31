import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
    filter: 'blur(4px)',
  },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -3,
    filter: 'blur(2.5px)',
    transition: {
      duration: 0.44,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

/**
 * Wraps a page in a buttery-smooth enter/exit transition.
 * Must be used inside an <AnimatePresence> (provided in App.tsx).
 */
const PageTransition = ({ children, className = '' }: PageTransitionProps) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="enter"
    exit="exit"
    className={className}
    style={{ willChange: 'opacity, transform, filter' }}
  >
    {children}
  </motion.div>
);

export default PageTransition;
