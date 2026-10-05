'use client';
export default function Modal({ titulo, children, onCancelar, onAceptar, textoAceptar = 'Guardar', ocupado }) {
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onCancelar()}>
      <div className="card">
        <h3>{titulo}</h3>
        {children}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancelar}>Cancelar</button>
          {onAceptar && <button className="btn pri" onClick={onAceptar} disabled={ocupado}>{ocupado ? 'Guardando…' : textoAceptar}</button>}
        </div>
      </div>
    </div>
  );
}
