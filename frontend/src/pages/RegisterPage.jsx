import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthField } from '../components/AuthField.jsx';
import { AuthShell } from '../components/AuthShell.jsx';
import { registerUser, validateCredentials } from '../services/authApi.js';
import { useAuth } from '../context/AuthContext.jsx';

export const RegisterPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
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
    const nextErrors = validateCredentials(form, true);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      await registerUser(form);
      navigate('/iniciar-sesion', { replace: true, state: { registered: true } });
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !loading) return <Navigate to="/" replace />;

  return (
    <AuthShell eyebrow="AuraPrices" title="Crear cuenta" subtitle="Completá tus datos para registrarte.">
      <form className="mt-8 grid gap-4" onSubmit={submit} noValidate>
        <AuthField label="Nombre de usuario" icon={UserRound} name="username" value={form.username} onChange={update} placeholder="Tu nombre o nickname" autoComplete="username" error={errors.username} />
        <AuthField label="Correo electrónico" icon={Mail} name="email" type="email" value={form.email} onChange={update} placeholder="vos@ejemplo.com" autoComplete="email" error={errors.email} />
        <AuthField label="Contraseña" icon={LockKeyhole} name="password" type="password" value={form.password} onChange={update} placeholder="Mínimo 6 caracteres" autoComplete="new-password" error={errors.password} />
        {message && <p className="rounded-2xl bg-surface p-4 text-sm font-semibold leading-6 text-primary" role="status">{message}</p>}
        <button disabled={submitting || loading} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-background transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60" type="submit">{submitting ? 'Creando cuenta...' : 'Crear mi cuenta'} <ArrowRight size={17} /></button>
      </form>
      <p className="mt-7 text-center text-sm font-medium text-muted">¿Ya tenés una cuenta? <Link to="/iniciar-sesion" className="font-extrabold text-primary hover:text-primary">Iniciá sesión</Link></p>
    </AuthShell>
  );
};
