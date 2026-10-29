import { LogOut } from 'lucide-react';
import { Modal } from './Modal.jsx';

export function LogoutModal({ onClose, onConfirm }) {
  return (
    <Modal compact title="¿Cerrar sesión?" onClose={onClose} footer={<>
      <button type="button" onClick={onClose} className="button border border-text/20 text-text" autoFocus>Seguir aquí</button>
      <button type="button" onClick={onConfirm} className="button button-primary"><LogOut size={17} aria-hidden="true" />Cerrar sesión</button>
    </>}>
      <p className="text-sm leading-7 text-muted">Tus favoritos y alertas seguirán guardados. Para volver a verlos, tendrás que iniciar sesión nuevamente.</p>
    </Modal>
  );
}
