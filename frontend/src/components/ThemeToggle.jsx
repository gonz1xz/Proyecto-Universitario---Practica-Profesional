import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Activar tema claro' : 'Activar tema oscuro';

  return (
    <button type="button" onClick={toggleTheme} className="theme-toggle" aria-label={label} title={label}>
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{isDark ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}
