type AlertTone = 'success' | 'error' | 'warning' | 'info';

const TONE_CLASS: Record<AlertTone, string> = {
  success: 'alert-success',
  error: 'alert-error',
  warning: 'alert-warning',
  info: 'alert-info',
};

interface AlertProps {
  tone?: AlertTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Alert({ tone = 'info', children, className = '', title }: AlertProps) {
  return (
    <div className={`${TONE_CLASS[tone]} ${className}`.trim()} role="status">
      {title && <p className="font-medium">{title}</p>}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  );
}
