import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, AlertTriangle, X, ZoomIn } from "lucide-react";
import { apiFetch } from "../../services/api";
import { useCart } from "../../context/CartContext";

export default function ProductoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opcion, setOpcion] = useState("Solo armazón");
  const [cantidad, setCantidad] = useState(1);
  const [imagenActiva, setImagenActiva] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/inventario/catalogo/${id}`);
        setProducto(data);
        setImagenActiva(0);
        setError("");
      } catch (err) {
        setError(err.message || "Error al cargar el producto");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  const formatoPrecio = (valor) =>
    new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(valor || 0);

  // Construir array de imágenes dinámicamente (sin duplicados)
  const imagenes = [];
  const PLACEHOLDER = "https://placehold.co/600x400/f8f9fa/ced4da?text=Sin+Imagen";

  if (producto?.imagen_data) {
    imagenes.push(producto.imagen_data);
  } else {
    imagenes.push(PLACEHOLDER);
  }

  // Si en el futuro hay más imágenes, se agregarían aquí
  // Por ahora solo usamos la principal

  const handleComprar = () => {
    if (producto.stock <= 0) return;
    addToCart(producto, cantidad, { tipo: opcion });
    navigate("/dashboard/carrito");
  };

  const cuota3 = producto ? formatoPrecio(producto.precio / 3) : "";
  const cuota6 = producto ? formatoPrecio(producto.precio / 6) : "";

  if (loading) {
    return (
      <section className="module-page">
        <div style={{ textAlign: "center", padding: "4rem" }}>Cargando detalles...</div>
      </section>
    );
  }

  if (error || !producto) {
    return (
      <section className="module-page">
        <div className="notice error">{error || "Producto no encontrado"}</div>
      </section>
    );
  }

  return (
    <section className="module-page product-detail-page">
      {/* Header con botón volver */}
      <header className="page-header">
        <div>
          <button
            className="icon-button back-btn"
            onClick={() => navigate("/dashboard/catalogo")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <ArrowLeft size={20} /> Volver al catálogo
          </button>
        </div>
      </header>

      <div
        className="product-detail-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
          alignItems: "start",
          marginTop: "1rem",
        }}
      >
        {/* COLUMNA IZQUIERDA - GALERÍA */}
        <div className="product-gallery">
          {/* Imagen principal (click para abrir modal) */}
          <div
            className="main-image"
            style={{
              border: "1px solid #eaeaea",
              borderRadius: "12px",
              overflow: "hidden",
              background: "#f8f9fa",
              position: "relative",
              cursor: "pointer",
            }}
            onClick={() => setModalAbierto(true)}
          >
            <img
              src={imagenes[imagenActiva]}
              alt={producto.nombre}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                objectFit: "contain",
                aspectRatio: "1/1",
                maxHeight: "500px",
              }}
            />
            {/* Botón de lupa */}
            <div
              style={{
                position: "absolute",
                bottom: "12px",
                right: "12px",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.8rem",
                pointerEvents: "none",
              }}
            >
              <ZoomIn size={18} /> Ampliar
            </div>
          </div>

          {/* Miniaturas (solo si hay más de 1 imagen) */}
          {imagenes.length > 1 && (
            <div
              className="thumbnail-list"
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "1rem",
                flexWrap: "wrap",
              }}
            >
              {imagenes.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImagenActiva(i)}
                  style={{
                    width: "70px",
                    height: "70px",
                    padding: 0,
                    border:
                      imagenActiva === i
                        ? "2px solid #0f3460"
                        : "1px solid #eaeaea",
                    borderRadius: "8px",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#fff",
                    transition: "border-color 0.2s",
                  }}
                >
                  <img
                    src={img}
                    alt={`Vista ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA - INFORMACIÓN */}
        <div
          className="product-info-panel"
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div>
            <span className="eyebrow">{producto.categoria || "Óptica"}</span>
            <h1 style={{ fontSize: "2rem", margin: "0.5rem 0" }}>
              {producto.nombre}
            </h1>
            <p style={{ color: "#6c757d", fontSize: "0.85rem" }}>
              SKU: {producto.sku || producto.codigo_barra || "N/A"}
            </p>
          </div>

          {/* Precio y cuotas */}
          <div
            className="price-box"
            style={{
              padding: "1.5rem",
              background: "#f8f9fa",
              borderRadius: "12px",
              border: "1px solid #eaeaea",
            }}
          >
            <h2 style={{ fontSize: "2.5rem", margin: 0, color: "#0f3460" }}>
              {formatoPrecio(producto.precio)}
            </h2>
            <div
              className="installments"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "0.5rem",
                color: "#6c757d",
                fontSize: "0.9rem",
              }}
            >
              <CreditCardIcon />
              <span>
                Hasta 3 cuotas sin interés de <strong>{cuota3}</strong> o 6 de{" "}
                <strong>{cuota6}</strong>
              </span>
            </div>
          </div>

          {/* Descripción y detalles */}
          <div className="product-description">
            <h3 style={{ marginBottom: "0.5rem" }}>Descripción</h3>
            <p>{producto.descripcion || "No hay descripción detallada disponible."}</p>
            <ul
              style={{
                paddingLeft: 0,
                marginTop: "0.5rem",
                color: "#495057",
                listStyle: "none",
              }}
            >
              {producto.material && (
                <li>
                  <strong>Material:</strong> {producto.material}
                </li>
              )}
              {producto.forma_montura && (
                <li>
                  <strong>Forma:</strong> {producto.forma_montura}
                </li>
              )}
              {producto.color_montura && (
                <li>
                  <strong>Color:</strong> {producto.color_montura}
                </li>
              )}
              <li>
                <strong>Stock disponible:</strong> {producto.stock} unidades
              </li>
            </ul>
          </div>

          {/* Opciones de compra */}
          <div
            className="purchase-options"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              borderTop: "1px solid #eaeaea",
              paddingTop: "1rem",
            }}
          >
            <label>
              <strong>Opciones de compra</strong>
              <select
                value={opcion}
                onChange={(e) => setOpcion(e.target.value)}
                style={{
                  marginTop: "0.5rem",
                  width: "100%",
                  padding: "0.8rem",
                  borderRadius: "8px",
                  border: "1px solid #eaeaea",
                  background: "#fff",
                }}
              >
                <option value="Solo armazón">Solo armazón (Sin graduación)</option>
                <option value="Armazón + Lentes de descanso">
                  Armazón + Lentes de descanso anti-reflejo (+$20)
                </option>
                <option value="Armazón + Lentes graduados">
                  Armazón + Lentes graduados (Requiere receta)
                </option>
              </select>
            </label>

            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
              <label style={{ width: "100px" }}>
                <strong>Cantidad</strong>
                <input
                  type="number"
                  min="1"
                  max={producto.stock}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  style={{
                    marginTop: "0.5rem",
                    width: "100%",
                    padding: "0.8rem",
                    borderRadius: "8px",
                    border: "1px solid #eaeaea",
                    background: "#fff",
                  }}
                />
              </label>
              <button
                onClick={handleComprar}
                disabled={producto.stock <= 0}
                style={{
                  flex: 1,
                  padding: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  fontSize: "1.1rem",
                  background: producto.stock > 0 ? "#0f3460" : "#6c757d",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: producto.stock > 0 ? "pointer" : "not-allowed",
                  transition: "background 0.2s",
                }}
              >
                <ShoppingCart size={18} />
                {producto.stock > 0 ? "Añadir al Carrito" : "Agotado"}
              </button>
            </div>

            {producto.stock > 0 && producto.stock <= producto.stock_minimo && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "#dc3545",
                  fontSize: "0.9rem",
                }}
              >
                <AlertTriangle size={16} /> ¡Apresúrate! Solo quedan {producto.stock}{" "}
                unidades disponibles.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE IMAGEN A PANTALLA COMPLETA (LUPA) */}
      {modalAbierto && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            cursor: "zoom-out",
          }}
          onClick={() => setModalAbierto(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalAbierto(false)}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                zIndex: 10,
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.8)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.6)")}
            >
              <X size={24} />
            </button>
            <img
              src={imagenes[imagenActiva]}
              alt={producto.nombre}
              style={{
                maxWidth: "100%",
                maxHeight: "90vh",
                display: "block",
                objectFit: "contain",
                margin: "0 auto",
              }}
            />
            {/* Contador de imágenes (si hay más de una) */}
            {imagenes.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "16px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                  display: "flex",
                  gap: "8px",
                }}
              >
                {imagenes.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: i === imagenActiva ? "#fff" : "rgba(255,255,255,0.4)",
                      display: "inline-block",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onClick={() => setImagenActiva(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Ícono de tarjeta de crédito
const CreditCardIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);