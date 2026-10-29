import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

// Marco compartido por la ficha del juego y la confirmación de salida.
export function Modal({ title, onClose, children, footer, compact = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`price-modal modal-frame ${compact ? 'modal-frame-compact' : ''}`}
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-frame-content">
        <header className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Cerrar ventana" autoFocus={!compact}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
