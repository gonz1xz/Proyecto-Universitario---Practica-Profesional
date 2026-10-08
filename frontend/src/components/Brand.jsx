import { Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Brand = () => (
  <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-text">
    <Gamepad2 size={26} className="text-primary" strokeWidth={1.8} />
    <span>Aura<span className="text-primary">Prices</span></span>
  </Link>
);
