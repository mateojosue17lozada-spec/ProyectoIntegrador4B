import { useEffect } from "react";
import { X } from "lucide-react";
import VirtualTryOnLive from "./VirtualTryOnLive";

/**
 * Envoltorio modal del probador virtual.
 *
 * Al desmontarse, VirtualTryOnLive libera la camara y el detector, por lo que
 * cerrar el modal apaga el indicador de grabacion del navegador.
 */
export default function TryOnModal({ abierto, onCerrar, titulo = "Probador virtual", ...propsEstudio }) {
    // Cerrar con Escape y bloquear el scroll del fondo mientras esta abierto.
    useEffect(() => {
        if (!abierto) return undefined;
        const alPulsar = (evento) => {
            if (evento.key === "Escape") onCerrar?.();
        };
        const overflowPrevio = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", alPulsar);
        return () => {
            window.removeEventListener("keydown", alPulsar);
            document.body.style.overflow = overflowPrevio;
        };
    }, [abierto, onCerrar]);

    if (!abierto) return null;

    return (
        <div className="tryon-backdrop" role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar}>
            <div className="tryon-dialog" onClick={(evento) => evento.stopPropagation()}>
                <header className="tryon-dialog__header">
                    <h2>{titulo}</h2>
                    <button type="button" className="icon-button" onClick={onCerrar} aria-label="Cerrar probador">
                        <X size={22} />
                    </button>
                </header>
                <VirtualTryOnLive {...propsEstudio} />
            </div>
        </div>
    );
}
