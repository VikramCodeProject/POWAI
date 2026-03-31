import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'primary' | 'secondary' | 'destructive';
  index?: number;
}

const accentMap = {
  primary: 'text-primary bg-primary/10',
  secondary: 'text-secondary bg-secondary/10',
  destructive: 'text-destructive bg-destructive/10',
};

const StatCard = ({ label, value, icon: Icon, accent = 'primary', index = 0 }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
    className="rounded-2xl border bg-card p-5 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.08 + 0.2 }}
          className="mt-1 text-2xl font-semibold text-card-foreground"
        >
          {value}
        </motion.p>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentMap[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </motion.div>
);

export default StatCard;
