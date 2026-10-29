import { useId } from 'react';

export const AuthField = ({ label, error, icon: Icon, ...inputProps }) => {
  const errorId = useId();
  return (
  <label className="grid gap-2 text-sm font-medium text-text">
    {label}
    <span className={`auth-control flex items-center gap-3 rounded-md border bg-surface px-4 ${error ? 'border-accent' : 'border-text/20'}`}>
      <Icon size={18} className={error ? 'text-primary' : 'text-muted'} aria-hidden="true" />
      <input className="min-h-13 min-w-0 flex-1 bg-transparent py-3.5 font-medium text-text outline-none placeholder:text-muted" {...inputProps} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
    </span>
    {error && <span id={errorId} className="text-xs font-semibold text-primary">{error}</span>}
  </label>
  );
};
