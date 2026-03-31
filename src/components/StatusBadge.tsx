const styles = {
  genuine: 'border border-emerald-200/80 bg-emerald-100/90 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300',
  suspicious: 'border border-red-200/80 bg-red-100/90 text-red-700 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-300',
  review: 'border border-sky-200/80 bg-sky-100/90 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-300',
};

const StatusBadge = ({ status }: { status: 'genuine' | 'suspicious' | 'review' }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
    {status}
  </span>
);

export default StatusBadge;
