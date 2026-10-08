import { useEffect, useId, useState } from 'react';
import { LoaderCircle, Search } from 'lucide-react';

export const SearchForm = ({ onSearch, isLoading = false, initialValue = '', variant = 'light' }) => {
  const [query, setQuery] = useState(initialValue);
  const [validationMessage, setValidationMessage] = useState('');
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const isCompact = variant === 'compact';

  useEffect(() => setQuery(initialValue), [initialValue]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setValidationMessage('Escribí el nombre de un juego para buscar.');
      return;
    }
    setValidationMessage('');
    onSearch(cleanQuery);
  };

  return (
    <form className={isCompact ? 'w-full text-left' : 'mx-auto mt-7 max-w-2xl text-left'} onSubmit={handleSubmit} noValidate>
      <label className="sr-only" htmlFor={inputId}>Buscar un videojuego</label>
      <div className="flex overflow-hidden rounded-full border border-text/15 bg-surface transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <input className={`min-w-0 flex-1 bg-transparent px-5 text-sm text-text outline-none placeholder:text-muted disabled:opacity-60 ${isCompact ? 'min-h-11' : 'min-h-13'}`} id={inputId} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setValidationMessage(''); }} placeholder="Buscar un juego..." autoComplete="off" aria-describedby={validationMessage ? errorId : undefined} aria-invalid={Boolean(validationMessage)} disabled={isLoading} />
        <button className="flex shrink-0 items-center justify-center gap-2 bg-accent px-5 text-sm font-semibold text-background transition hover:bg-primary hover:text-background focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-background disabled:cursor-wait disabled:opacity-60" type="submit" disabled={isLoading} aria-label={isLoading ? 'Buscando juegos' : 'Buscar juegos'}>
          {isLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Search size={19} />}
          {!isCompact && <span className="hidden sm:inline">{isLoading ? 'Buscando...' : 'Buscar'}</span>}
        </button>
      </div>
      {validationMessage && <p className="mt-2 pl-2 text-sm text-primary" id={errorId} role="alert">{validationMessage}</p>}
    </form>
  );
};
