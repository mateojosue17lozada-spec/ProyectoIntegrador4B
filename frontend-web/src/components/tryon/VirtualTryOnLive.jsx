import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Upload, RotateCcw, RefreshCw, Download, ShoppingCart, Loader } from "lucide-react";
import { crearDetector, transformarDesdeLandmarks, suavizar, nombreOrientacion } from "./faceMesh";
import { colorMontura, esRedondeada, dibujarMonturaVectorial } from "./frameShapes";

const MS_ENTRE_DETECCIONES = 100; // limita FaceMesh a ~10 fps, suficiente y liviano
const MS_SIN_ROSTRO = 1500; // tras este tiempo sin deteccion, se avisa

// Ajustes manuales por defecto (multiplicadores y desplazamientos sobre el
// encuadre automatico).
const AJUSTES_INICIALES = { ancho: 1, alto: 1, offX: 0, offY: 0, rot: 0 };

/**
 * Comprueba si una imagen ya cargada tiene pixeles semitransparentes.
 * Muestrea a baja resolucion: basta un pixel con alfa < 250 para considerarla
 * transparente y usarla como overlay real.
 */
const tieneTransparencia = (img) => {
    try {
        const lado = 32;
        const c = document.createElement("canvas");
        c.width = lado; c.height = lado;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, lado, lado);
        const datos = ctx.getImageData(0, 0, lado, lado).data;
        for (let i = 3; i < datos.length; i += 4) {
            if (datos[i] < 250) return true;
        }
        return false;
    } catch {
        return false; // ante cualquier problema, se usa la silueta vectorial
    }
};

/**
 * Probador virtual de monturas en tiempo real.
 *
 * Fuentes: camara en vivo (video + Face Mesh por frame) o una foto subida
 * (deteccion en una sola pasada). Todo se dibuja sobre un unico <canvas>, lo que
 * hace trivial capturar la imagen final. El ajuste manual (deslizadores y
 * arrastre) siempre esta disponible; la deteccion solo aporta el encuadre.
 *
 * @param {object[]} monturas monturas disponibles para probar
 * @param {number|string} monturaInicial id_producto preseleccionado
 * @param {(imagen:string|null, montura:object)=>void} onAnadirAlCarrito
 * @param {boolean} permitirCarrito muestra el boton de anadir al carrito
 */
export default function VirtualTryOnLive({
    monturas = [],
    monturaInicial = "",
    onAnadirAlCarrito,
    permitirCarrito = true
}) {
    const [modo, setModo] = useState("inicio"); // inicio | camara | foto
    const [idMontura, setIdMontura] = useState(String(monturaInicial || ""));
    const [ajustes, setAjustes] = useState(AJUSTES_INICIALES);
    const [seguir, setSeguir] = useState(true);
    const [cargandoModelo, setCargandoModelo] = useState(false);
    const [orientacion, setOrientacion] = useState("");
    const [rostroDetectado, setRostroDetectado] = useState(false);
    const [consiente, setConsiente] = useState(false);
    const [error, setError] = useState("");

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const detectorRef = useRef(null);
    const rafRef = useRef(0);
    const imagenFotoRef = useRef(null); // Image de una foto subida
    const imgMonturaRef = useRef(null); // Image PNG del armazon
    const objetivoRef = useRef(null); // transformacion objetivo (ultima deteccion)
    const suavRef = useRef(null); // transformacion suavizada que se dibuja
    const ultimoEnvioRef = useRef(0);
    const enviandoRef = useRef(false);
    const ultimaDeteccionRef = useRef(0);
    const ajustesRef = useRef(ajustes);
    const seguirRef = useRef(seguir);
    const arrastreRef = useRef(null);
    const activoRef = useRef(true);
    const monturaRef = useRef(null);
    // Espejo: la camara frontal (facingMode 'user' o indefinido en escritorio)
    // se ve reflejada; la trasera o una foto subida, no.
    const espejoRef = useRef(true);

    // El bucle de render lee estos valores por ref para no re-crearse en cada cambio.
    useEffect(() => { ajustesRef.current = ajustes; }, [ajustes]);
    useEffect(() => { seguirRef.current = seguir; }, [seguir]);

    const montura = useMemo(
        () => monturas.find((m) => String(m.id_producto) === idMontura) || monturas[0] || null,
        [monturas, idMontura]
    );
    useEffect(() => { monturaRef.current = montura; }, [montura]);

    // Precarga la imagen del armazon (columna imagen_data, base64) SOLO si tiene
    // transparencia real. Un JPEG opaco superpuesto se veria como un rectangulo,
    // asi que en ese caso (y cuando no hay imagen) se usa la silueta vectorial,
    // que si parece unas gafas.
    useEffect(() => {
        imgMonturaRef.current = null;
        const datos = montura?.imagen_data;
        // Solo los PNG (y WEBP) pueden llevar canal alfa; un data URI JPEG nunca.
        if (!datos || !/^data:image\/(png|webp)/i.test(datos)) return;

        const img = new Image();
        img.onload = () => {
            if (tieneTransparencia(img)) imgMonturaRef.current = img;
        };
        img.src = datos;
    }, [montura]);

    const detenerTodo = useCallback(() => {
        activoRef.current = false;
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        detectorRef.current?.close?.();
        detectorRef.current = null;
    }, []);

    // Libera camara y detector al desmontar (apaga el indicador de grabacion).
    useEffect(() => detenerTodo, [detenerTodo]);

    /** Dibuja la montura sobre el punto (cx,cy) con su rotacion y compresion lateral. */
    const dibujarMontura = (ctx, t) => {
        const a = ajustesRef.current;
        const ancho = t.anchoMontura * a.ancho;
        ctx.save();
        ctx.translate(t.cx + a.offX, t.cy + a.offY);
        ctx.rotate(((t.rotacion + a.rot) * Math.PI) / 180);
        ctx.scale(t.compresionX, 1); // perspectiva al girar la cabeza de lado
        const img = imgMonturaRef.current;
        const m = monturaRef.current;
        if (img) {
            const alto = (img.naturalHeight / img.naturalWidth) * ancho * a.alto;
            ctx.drawImage(img, -ancho / 2, -alto / 2, ancho, alto);
        } else if (m) {
            dibujarMonturaVectorial(ctx, {
                centroX: 0, centroY: 0, ancho, rotacionGrados: 0,
                color: colorMontura(m), redondeada: esRedondeada(m)
            });
        }
        ctx.restore();
    };

    /** Transformacion por defecto: montura centrada, para el modo manual. */
    const transformacionPorDefecto = (ancho, alto) => ({
        cx: ancho / 2, cy: alto * 0.42, anchoMontura: ancho * 0.4,
        rotacion: 0, compresionX: 1, yaw: 0
    });

    // Bucle unico de render mientras hay una fuente activa.
    const iniciarBucle = useCallback((esVideo) => {
        const render = async (t) => {
            if (!activoRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            const video = videoRef.current;
            if (!ctx) { rafRef.current = requestAnimationFrame(render); return; }

            const w = canvas.width;
            const h = canvas.height;

            // Fondo: video (en espejo solo si es camara frontal) o la foto subida.
            if (esVideo && video?.videoWidth) {
                ctx.save();
                if (espejoRef.current) { ctx.translate(w, 0); ctx.scale(-1, 1); }
                ctx.drawImage(video, 0, 0, w, h);
                ctx.restore();
            } else if (!esVideo && imagenFotoRef.current) {
                ctx.drawImage(imagenFotoRef.current, 0, 0, w, h);
            }

            // Deteccion limitada en frecuencia, y solo si seguimos el rostro.
            if (esVideo && seguirRef.current && detectorRef.current && video?.videoWidth &&
                !enviandoRef.current && t - ultimoEnvioRef.current > MS_ENTRE_DETECCIONES) {
                ultimoEnvioRef.current = t;
                enviandoRef.current = true;
                detectorRef.current.send({ image: video }).catch(() => {}).finally(() => {
                    enviandoRef.current = false;
                });
            }

            // Elige la transformacion a dibujar.
            const sinRostro = performance.now() - ultimaDeteccionRef.current > MS_SIN_ROSTRO;
            let objetivo = objetivoRef.current;
            if (!seguirRef.current || sinRostro || !objetivo) {
                objetivo = suavRef.current || transformacionPorDefecto(w, h);
            }
            suavRef.current = suavizar(suavRef.current, objetivo, seguirRef.current ? 0.3 : 1);
            dibujarMontura(ctx, suavRef.current);

            rafRef.current = requestAnimationFrame(render);
        };
        rafRef.current = requestAnimationFrame(render);
    }, []);

    /** Recibe los landmarks de Face Mesh y actualiza la transformacion objetivo. */
    const alDetectar = useCallback((resultado) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const marcas = resultado?.multiFaceLandmarks?.[0];
        if (!marcas) { setRostroDetectado(false); return; }
        // Espejo solo en camara frontal; en foto subida se dibuja tal cual.
        const espejo = modo === "camara" && espejoRef.current;
        const t = transformarDesdeLandmarks(marcas, canvas.width, canvas.height, espejo);
        objetivoRef.current = t;
        ultimaDeteccionRef.current = performance.now();
        setRostroDetectado(true);
        setOrientacion(nombreOrientacion(t.yaw));
    }, [modo]);

    const asegurarDetector = useCallback(async () => {
        if (detectorRef.current) return detectorRef.current;
        setCargandoModelo(true);
        try {
            const detector = await crearDetector();
            detector.onResults(alDetectar);
            detectorRef.current = detector;
            return detector;
        } finally {
            setCargandoModelo(false);
        }
    }, [alDetectar]);

    const usarCamara = async () => {
        setError("");
        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Este navegador no permite el acceso a la camara. Sube una foto en su lugar.");
            return;
        }
        try {
            activoRef.current = true;
            await asegurarDetector();
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            streamRef.current = stream;
            imagenFotoRef.current = null;
            // La camara frontal ('user' o indefinida en escritorio) se ve
            // reflejada; la trasera ('environment') no. De esto depende que el
            // seguimiento sea natural y no invertido.
            const facing = stream.getVideoTracks?.()?.[0]?.getSettings?.()?.facingMode;
            espejoRef.current = facing !== "environment";
            setModo("camara");
            requestAnimationFrame(() => {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                if (!video || !canvas) return;
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    video.play();
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 480;
                    iniciarBucle(true);
                };
            });
        } catch (err) {
            if (err?.message?.includes("MediaPipe")) {
                setError("No se pudo cargar la deteccion facial. Puedes ajustar la montura manualmente.");
            } else {
                setError("No se pudo acceder a la camara. Revisa los permisos del navegador.");
            }
        }
    };

    const subirFoto = async (evento) => {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo || !archivo.type?.startsWith("image/")) return;
        setError("");
        detenerTodo();
        activoRef.current = true;

        const img = new Image();
        img.onload = async () => {
            imagenFotoRef.current = img;
            espejoRef.current = false; // una foto subida no se refleja
            const canvas = canvasRef.current;
            if (!canvas) return;
            // Limita el lado mayor para no trabajar con fotos enormes.
            const escala = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
            canvas.width = Math.round(img.naturalWidth * escala);
            canvas.height = Math.round(img.naturalHeight * escala);
            setModo("foto");
            objetivoRef.current = null;
            suavRef.current = null;
            iniciarBucle(false);

            try {
                const detector = await asegurarDetector();
                detector.onResults(alDetectar);
                await detector.send({ image: img });
            } catch {
                setError("No se detecto el rostro. Ajusta la montura con los controles.");
            }
        };
        img.onerror = () => setError("No se pudo leer la imagen.");
        img.src = URL.createObjectURL(archivo);
    };

    const reencuadrar = () => {
        objetivoRef.current = null;
        suavRef.current = null;
        setAjustes(AJUSTES_INICIALES);
        if (modo === "foto" && imagenFotoRef.current && detectorRef.current) {
            detectorRef.current.send({ image: imagenFotoRef.current }).catch(() => {});
        }
    };

    const reiniciar = () => {
        detenerTodo();
        imagenFotoRef.current = null;
        objetivoRef.current = null;
        suavRef.current = null;
        setAjustes(AJUSTES_INICIALES);
        setModo("inicio");
        setRostroDetectado(false);
        setOrientacion("");
        setConsiente(false);
        setError("");
        const canvas = canvasRef.current;
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };

    // --- Arrastre manual de la montura sobre el canvas ---
    const alBajarPuntero = (e) => {
        if (modo === "inicio") return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        arrastreRef.current = {
            x: e.clientX, y: e.clientY,
            escalaX: canvas.width / rect.width, escalaY: canvas.height / rect.height,
            base: ajustesRef.current
        };
        canvas.setPointerCapture?.(e.pointerId);
    };
    const alMoverPuntero = (e) => {
        const d = arrastreRef.current;
        if (!d) return;
        // El arrastre ajusta un desplazamiento manual que se SUMA al seguimiento
        // automatico: puedes reencuadrar sin apagar el seguidor. El offset esta
        // en pixeles del canvas (espacio de pantalla), igual que la posicion que
        // calcula la deteccion, asi que arrastrar a la derecha siempre mueve la
        // montura a la derecha, con o sin espejo.
        setAjustes({
            ...d.base,
            offX: d.base.offX + (e.clientX - d.x) * d.escalaX,
            offY: d.base.offY + (e.clientY - d.y) * d.escalaY
        });
    };
    const alSoltarPuntero = (e) => {
        arrastreRef.current = null;
        canvasRef.current?.releasePointerCapture?.(e.pointerId);
    };

    // Para el carrito se usa JPEG (mas liviano, respeta el limite de 2.2 MB del
    // backend); para descargar, PNG segun lo pedido.
    const componer = (tipo = "image/jpeg", calidad = 0.85) =>
        canvasRef.current?.toDataURL(tipo, calidad) || null;

    const descargar = () => {
        const url = componer("image/png");
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = `prueba-${montura?.sku || montura?.id_producto || "montura"}.png`;
        a.click();
    };

    const anadir = () => {
        const imagen = consiente ? componer("image/jpeg", 0.85) : null;
        onAnadirAlCarrito?.(imagen, montura);
    };

    const control = (etiqueta, clave, min, max, paso) => (
        <label className="tryon-control">
            <span>{etiqueta}</span>
            <input
                type="range" min={min} max={max} step={paso}
                value={ajustes[clave]} disabled={modo === "inicio"}
                onChange={(e) => setAjustes((p) => ({ ...p, [clave]: Number(e.target.value) }))}
            />
        </label>
    );

    const hayFuente = modo !== "inicio";

    return (
        <div className="tryon-studio">
            <div className="tryon-canvas tryon-canvas--live">
                {/* El video es solo la fuente; lo visible es el canvas. */}
                <video ref={videoRef} playsInline muted style={{ display: "none" }} />
                <canvas
                    ref={canvasRef}
                    className="tryon-lienzo"
                    onPointerDown={alBajarPuntero}
                    onPointerMove={alMoverPuntero}
                    onPointerUp={alSoltarPuntero}
                    onPointerCancel={alSoltarPuntero}
                    style={{ touchAction: "none", cursor: hayFuente ? "grab" : "default" }}
                />

                {!hayFuente && (
                    <div className="tryon-vacio">
                        <Camera size={40} />
                        <p>Activa la camara para probarte la montura en tiempo real, o sube una foto frontal.</p>
                    </div>
                )}

                {cargandoModelo && (
                    <div className="tryon-cargando">
                        <Loader size={16} className="tryon-girando" /> Cargando deteccion facial...
                    </div>
                )}

                {hayFuente && !cargandoModelo && (
                    <div className={`tryon-estado ${rostroDetectado ? "ok" : "buscando"}`}>
                        {rostroDetectado ? `Rostro ${orientacion} detectado` : "Buscando rostro... usa los controles si no aparece"}
                    </div>
                )}
            </div>

            <div className="tryon-controls">
                {error && <div className="notice error">{error}</div>}

                <div className="tryon-fuentes">
                    <button type="button" onClick={usarCamara}>
                        <Camera size={16} /> {modo === "camara" ? "Reiniciar camara" : "Usar camara"}
                    </button>
                    <label className="secundario tryon-subir">
                        <Upload size={16} /> Subir foto
                        <input type="file" accept="image/*" hidden onChange={subirFoto} />
                    </label>
                </div>

                {monturas.length > 1 && (
                    <label className="tryon-control">
                        <span>Montura</span>
                        <select value={montura?.id_producto || ""} onChange={(e) => setIdMontura(e.target.value)}>
                            {monturas.map((m) => (
                                <option key={m.id_producto} value={m.id_producto}>{m.nombre}</option>
                            ))}
                        </select>
                    </label>
                )}

                <label className="tryon-seguir">
                    <input type="checkbox" checked={seguir} disabled={modo !== "camara"}
                        onChange={(e) => setSeguir(e.target.checked)} />
                    <span>Seguir el rostro automaticamente</span>
                </label>

                {control("Ancho", "ancho", 0.5, 1.6, 0.01)}
                {control("Altura", "alto", 0.5, 1.6, 0.01)}
                {control("Horizontal", "offX", -150, 150, 1)}
                {control("Vertical", "offY", -150, 150, 1)}
                {control("Rotacion", "rot", -30, 30, 1)}

                <div className="tryon-acciones">
                    <button type="button" className="secundario" onClick={reencuadrar} disabled={!hayFuente}>
                        <RefreshCw size={16} /> Reencuadrar
                    </button>
                    <button type="button" className="secundario" onClick={reiniciar} disabled={!hayFuente}>
                        <RotateCcw size={16} /> Reiniciar
                    </button>
                    <button type="button" className="secundario" onClick={descargar} disabled={!hayFuente}>
                        <Download size={16} /> Descargar
                    </button>
                </div>

                {permitirCarrito && (
                    <>
                        <label className="tryon-consentimiento">
                            <input type="checkbox" checked={consiente} disabled={!hayFuente}
                                onChange={(e) => setConsiente(e.target.checked)} />
                            <span>
                                Autorizo adjuntar esta imagen al pedido para que el optico revise el calce.
                                Si no la marcas, el producto se anade sin foto.
                            </span>
                        </label>
                        <button type="button" onClick={anadir} disabled={!montura}>
                            <ShoppingCart size={16} /> Anadir al carrito
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
