const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  declined: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  expired: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  open: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  void: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  safety_critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  required: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  recommended: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  optional: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const TYPE_STYLES: Record<string, string> = {
  part: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  labor: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  misc: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  fee: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const VENDOR_STYLES: Record<string, string> = {
  AutoZone: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  RockAuto: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

function formatLabel(value: string): string {
  if (!value) return '';
  if (value === 'void') return 'Voided';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  rounded?: 'full' | 'md';
}

export function Badge({ children, className = '', rounded = 'full' }: BadgeProps) {
  const radius = rounded === 'full' ? 'rounded-full' : 'rounded';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${radius} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const key = (status || 'draft').toLowerCase();
  return (
    <Badge className={STATUS_STYLES[key] || STATUS_STYLES.draft}>
      {formatLabel(key)}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const key = (type || 'misc').toLowerCase();
  return (
    <Badge rounded="md" className={TYPE_STYLES[key] || TYPE_STYLES.misc}>
      {key}
    </Badge>
  );
}

export function VendorBadge({ vendor }: { vendor: string }) {
  return (
    <Badge rounded="md" className={VENDOR_STYLES[vendor] || 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'}>
      {vendor}
    </Badge>
  );
}
