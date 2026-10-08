import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthField } from '../components/AuthField.jsx';
import { AuthShell } from '../components/AuthShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateCredentials } from '../services/authApi.js';

export const LoginPage = () => {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: '' }));
    setMessage('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateCredentials(form);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      await login(form, false);
      navigate('/', { replace: true });
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !loading) return <Navigate to="/" replace />;

  return (
    <AuthShell eyebrow="AuraPrices" title="Iniciar sesión" subtitle="Ingresá con tu correo electrónico y contraseña.">
      <form className="mt-8 grid gap-5" onSubmit={submit} noValidate>
        {location.state?.registered && <p className="text-sm font-semibold text-primary" role="status">Tu cuenta fue creada. Iniciá sesión para continuar.</p>}
        <AuthField label="Correo electrónico" icon={Mail} name="email" type="email" value={form.email} onChange={update} placeholder="vos@ejemplo.com" autoComplete="email" error={errors.email} />
        <AuthField label="Contraseña" icon={LockKeyhole} name="password" type="password" value={form.password} onChange={update} placeholder="Tu contraseña" autoComplete="current-password" error={errors.password} />
        {message && <p className="rounded-2xl bg-surface p-4 text-sm font-semibold leading-6 text-primary" role="status">{message}</p>}
        <button disabled={submitting || loading} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-background transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60" type="submit">{submitting ? 'Ingresando...' : 'Iniciar sesión'} <ArrowRight size={17} /></button>
      </form>
      <p className="mt-7 text-center text-sm font-medium text-muted">¿Todavía no tenés cuenta? <Link to="/registro" className="font-extrabold text-primary hover:text-primary">Registrate gratis</Link></p>
    </AuthShell>
  );
};
