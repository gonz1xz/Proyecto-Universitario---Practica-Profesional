export const AuthField = ({ label, error, icon: Icon, ...inputProps }) => (
  <label className="grid gap-2 text-sm font-medium text-text">
    {label}
    <span className={`flex items-center gap-3 rounded-md border bg-surface px-4 transition focus-within:ring-2 ${error ? 'border-accent focus-within:ring-accent/20' : 'border-text/20 focus-within:border-accent focus-within:ring-accent/10'}`}>
      <Icon size={18} className={error ? 'text-primary' : 'text-muted'} />
      <input className="min-h-13 min-w-0 flex-1 bg-transparent py-3.5 font-medium text-text outline-none placeholder:text-muted" {...inputProps} />
    </span>
    {error && <span className="text-xs font-semibold text-primary">{error}</span>}
  </label>
);
