import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Upload, RotateCcw, Download, ShoppingCart, Wand2, User } from "lucide-react";
import { calcularAjusteMontura } from "../../utils/faceLandmarks";
import { cargarImagen, leerArchivo, optimizarImagen, pesoAproximado, formatearPeso } from "../../utils/imagen";
import { compatibles, esRedondeada, colorMontura, dibujarMonturaVectorial } from "./frameShapes";

const AJUSTE_INICIAL = { anchoPct: 62, topPct: 39, leftPct: 50, rotacion: 0 };

/**
 * Probador virtual de monturas sobre una foto estatica.
 *
 * Fuentes de imagen: camara del dispositivo, archivo local o una foto ya
 * asociada al paciente. Tras cargar la foto intenta un encuadre automatico con
 * deteccion facial y, si falla, deja el ajuste manual como unico camino.
 *
 * @param {object[]} monturas monturas disponibles para probar
 * @param {number|string} monturaInicial id_producto preseleccionado
 * @param {string} fotoPaciente dataURL de la foto guardada del paciente (opcional)
 * @param {string} formaRostro forma de rostro registrada, para recomendaciones
 * @param {(dataUrl:string|null, montura:object)=>void} onAnadirAlCarrito
 * @param {boolean} permitirCarrito muestra el boton de anadir al carrito
 */
export default function VirtualTryOnStudio({
    monturas = [],
    monturaInicial = "",
    fotoPaciente = "",
    formaRostro = "",
    onAnadirAlCarrito,
    permitirCarrito = true
}) {
    const [foto, setFoto] = useState(fotoPaciente || "");
    const [idMontura, setIdMontura] = useState(String(monturaInicial || ""));
    const [ajuste, setAjuste] = useState(AJUSTE_INICIAL);
    const [camaraActiva, setCamaraActiva] = useState(false);
    const [analizando, setAnalizando] = useState(false);
    const [aviso, setAviso] = useState("");
    const [error, setError] = useState("");
    const [consiente, setConsiente] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const inputRef = useRef(null);

    const recomendadas = useMemo(
        () => monturas.filter((m) => !formaRostro || compatibles[formaRostro]?.includes(m.forma_montura)),
        [monturas, formaRostro]
    );

    const montura = useMemo(
        () => monturas.find((m) => String(m.id_producto) === idMontura) || monturas[0] || null,
        [monturas, idMontura]
    );

    const detenerCamara = useCallback(() => {
        streamRef.current?.getTracks().forEach((pista) => pista.stop());
        streamRef.current = null;
        setCamaraActiva(false);
    }, []);

    // La camara debe liberarse siempre que el componente desaparezca, o el
    // navegador mantiene el indicador de grabacion encendido.
    useEffect(() => detenerCamara, [detenerCamara]);

    const autoAjustar = useCallback(async (dataUrl) => {
        setAnalizando(true);
        setAviso("");
        try {
            const imagen = await cargarImagen(dataUrl);
            setAjuste(await calcularAjusteMontura(imagen));
            setAviso("Montura encuadrada automaticamente. Puede afinarla con los controles.");
        } catch {
            setAjuste(AJUSTE_INICIAL);
            setAviso("No se pudo detectar el rostro automaticamente. Ajuste la montura con los controles.");
        } finally {
            setAnalizando(false);
        }
    }, []);

    const usarFoto = useCallback(
        async (dataUrl) => {
            setError("");
            try {
                const optimizada = await optimizarImagen(dataUrl);
                setFoto(optimizada);
                await autoAjustar(optimizada);
            } catch (err) {
                setError(err.message || "No se pudo procesar la imagen");
            }
        },
        [autoAjustar]
    );

    const abrirCamara = async () => {
        setError("");
        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Este navegador no permite el acceso a la camara. Suba una foto en su lugar.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
                audio: false
            });
            streamRef.current = stream;
            setCamaraActiva(true);
            // El elemento video solo existe despues de este render.
            requestAnimationFrame(() => {
                if (videoRef.current) videoRef.current.srcObject = stream;
            });
        } catch {
            setError("No se pudo acceder a la camara. Revise los permisos del navegador.");
        }
    };

    const capturar = async () => {
        const video = videoRef.current;
        if (!video?.videoWidth) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        detenerCamara();
        await usarFoto(canvas.toDataURL("image/jpeg", 0.9));
    };

    const subirArchivo = async (evento) => {
        const archivo = evento.target.files?.[0];
        evento.target.value = ""; // permite volver a elegir el mismo archivo
        if (!archivo) return;
        setError("");
        try {
            await usarFoto(await leerArchivo(archivo));
        } catch (err) {
            setError(err.message || "No se pudo leer el archivo");
        }
    };

    /** Vuelve al estado inicial sin recargar la pagina. */
    const reiniciar = () => {
        detenerCamara();
        setFoto("");
        setAjuste(AJUSTE_INICIAL);
        setAviso("");
        setError("");
        setConsiente(false);
    };

    /** Compone foto + montura en un unico JPEG. */
    const componer = async () => {
        const base = await cargarImagen(foto);
        const canvas = document.createElement("canvas");
        canvas.width = base.naturalWidth;
        canvas.height = base.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(base, 0, 0);

        const centroX = (ajuste.leftPct / 100) * canvas.width;
        const centroY = (ajuste.topPct / 100) * canvas.height;
        const ancho = (ajuste.anchoPct / 100) * canvas.width;

        if (montura?.imagen_data) {
            const superpuesta = await cargarImagen(montura.imagen_data);
            const alto = (superpuesta.naturalHeight / superpuesta.naturalWidth) * ancho;
            ctx.save();
            ctx.translate(centroX, centroY);
            ctx.rotate((ajuste.rotacion * Math.PI) / 180);
            ctx.drawImage(superpuesta, -ancho / 2, -alto / 2, ancho, alto);
            ctx.restore();
        } else if (montura) {
            dibujarMonturaVectorial(ctx, {
                centroX,
                centroY,
                ancho,
                rotacionGrados: ajuste.rotacion,
                color: colorMontura(montura),
                redondeada: esRedondeada(montura)
            });
        }

        return canvas.toDataURL("image/jpeg", 0.85);
    };

    const descargar = async () => {
        try {
            const dataUrl = await componer();
            const enlace = document.createElement("a");
            enlace.href = dataUrl;
            enlace.download = "prueba-" + (montura?.sku || montura?.id_producto || "montura") + ".jpg";
            enlace.click();
        } catch (err) {
            setError(err.message || "No se pudo generar la imagen");
        }
    };

    const anadir = async () => {
        try {
            // La foto solo viaja al backend si el usuario lo autorizo de forma
            // explicita; sin consentimiento se anade el producto sin imagen.
            const dataUrl = consiente && foto ? await componer() : null;
            onAnadirAlCarrito?.(dataUrl, montura);
        } catch (err) {
            setError(err.message || "No se pudo generar la imagen");
        }
    };

    const estiloCapa = {
        width: ajuste.anchoPct + "%",
        top: ajuste.topPct + "%",
        left: ajuste.leftPct + "%",
        transform: "translate(-50%,-50%) rotate(" + ajuste.rotacion + "deg)"
    };

    const control = (etiqueta, clave, min, max, sufijo) => (
        <label>
            {etiqueta}: {Math.round(ajuste[clave])}
            {sufijo}
            <input
                type="range"
                min={min}
                max={max}
                value={ajuste[clave]}
                disabled={!foto}
                onChange={(e) => setAjuste((previo) => ({ ...previo, [clave]: Number(e.target.value) }))}
            />
        </label>
    );

    return (
        <div className="tryon-studio">
            <div className="tryon-canvas tryon-canvas--studio">
                {camaraActiva && <video ref={videoRef} autoPlay playsInline muted />}

                {!camaraActiva && foto && (
                    <>
                        <img src={foto} alt="Foto para la prueba virtual" />
                        {montura?.imagen_data ? (
                            <img
                                className="frame-overlay"
                                src={montura.imagen_data}
                                alt={montura.nombre}
                                style={estiloCapa}
                            />
                        ) : (
                            montura && (
                                <div
                                    className={"generated-frame " + (esRedondeada(montura) ? "round" : "angular")}
                                    style={{ ...estiloCapa, color: colorMontura(montura) }}
                                    aria-label={"Vista provisional de " + montura.nombre}
                                >
                                    <span />
                                    <i />
                                    <span />
                                </div>
                            )
                        )}
                    </>
                )}

                {!camaraActiva && !foto && (
                    <div className="tryon-vacio">
                        <Camera size={40} />
                        <p>Tome una foto o suba una imagen frontal para probar la montura.</p>
                    </div>
                )}

                {analizando && <div className="tryon-cargando">Detectando rostro...</div>}
            </div>

            <div className="tryon-controls">
                {error && <div className="notice error">{error}</div>}
                {aviso && !error && <div className="notice">{aviso}</div>}

                <div className="tryon-fuentes">
                    {camaraActiva ? (
                        <>
                            <button type="button" onClick={capturar}>
                                <Camera size={16} /> Capturar
                            </button>
                            <button type="button" className="secundario" onClick={detenerCamara}>
                                Cancelar
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={abrirCamara}>
                                <Camera size={16} /> Usar camara
                            </button>
                            <button type="button" className="secundario" onClick={() => inputRef.current?.click()}>
                                <Upload size={16} /> Subir foto
                            </button>
                            {fotoPaciente && (
                                <button type="button" className="secundario" onClick={() => usarFoto(fotoPaciente)}>
                                    <User size={16} /> Foto del paciente
                                </button>
                            )}
                        </>
                    )}
                    <input ref={inputRef} type="file" accept="image/*" hidden onChange={subirArchivo} />
                </div>

                {monturas.length > 1 && (
                    <label>
                        Montura
                        <select value={montura?.id_producto || ""} onChange={(e) => setIdMontura(e.target.value)}>
                            {monturas.map((m) => (
                                <option key={m.id_producto} value={m.id_producto}>
                                    {recomendadas.includes(m) ? "* " : ""}
                                    {m.nombre} - {m.forma_montura || "sin forma"}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {control("Ancho", "anchoPct", 25, 95, "%")}
                {control("Altura", "topPct", 10, 90, "%")}
                {control("Horizontal", "leftPct", 10, 90, "%")}
                {control("Rotacion", "rotacion", -25, 25, "°")}

                <div className="tryon-acciones">
                    <button
                        type="button"
                        className="secundario"
                        onClick={() => foto && autoAjustar(foto)}
                        disabled={!foto || analizando}
                    >
                        <Wand2 size={16} /> Reencuadrar
                    </button>
                    <button type="button" className="secundario" onClick={reiniciar} disabled={!foto}>
                        <RotateCcw size={16} /> Reiniciar
                    </button>
                    <button type="button" className="secundario" onClick={descargar} disabled={!foto}>
                        <Download size={16} /> Descargar
                    </button>
                </div>

                {permitirCarrito && (
                    <>
                        <label className="tryon-consentimiento">
                            <input
                                type="checkbox"
                                checked={consiente}
                                onChange={(e) => setConsiente(e.target.checked)}
                                disabled={!foto}
                            />
                            <span>
                                Autorizo adjuntar esta foto al pedido para que el optico revise el calce de la
                                montura. Si no marca la casilla, el producto se anade sin imagen.
                            </span>
                        </label>

                        <button type="button" onClick={anadir} disabled={!montura}>
                            <ShoppingCart size={16} /> Anadir al carrito
                        </button>
                    </>
                )}

                {foto && (
                    <small className="tryon-peso">
                        Foto optimizada: {formatearPeso(pesoAproximado(foto))}. Se procesa en su dispositivo.
                    </small>
                )}
            </div>
        </div>
    );
}
