import { Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Brand = () => (
  <Link to="/" className="brand" aria-label="AuraPrices, inicio">
    <span className="brand-mark"><Gamepad2 size={25} strokeWidth={2} aria-hidden="true" /></span>
    <span>Aura<span className="text-primary">Prices</span></span>
  </Link>
);
