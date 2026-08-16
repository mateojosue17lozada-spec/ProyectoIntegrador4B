import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, CreditCard, ShoppingBag, CheckCircle } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { apiFetch } from "../../services/api";

export default function Carrito() {
  const navigate = useNavigate();
  const { cart, removeFromCart, updateQuantity, clearCart, totalItems, total } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pedidoData, setPedidoData] = useState(null);

  const formatoPrecio = (valor) =>
    new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(valor || 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      setLoading(true);
      setError("");

      const payload = {
        detalles: cart.map((item) => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad,
        })),
      };

      const res = await apiFetch("/inventario/pedido", {
        method: "POST",
        body: payload,
      });

      setPedidoData(res);
      setSuccess(true);
      clearCart();
    } catch (err) {
      setError(err.message || "Error al generar el pedido");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="module-page" style={{ textAlign: "center", padding: "4rem 2rem" }}>
        <div
          style={{
            maxWidth: "500px",
            margin: "0 auto",
            background: "#fff",
            padding: "3rem",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
            border: "1px solid #eaeaea",
          }}
        >
          <CheckCircle size={64} color="#28a745" style={{ margin: "0 auto 1rem" }} />
          <h1 style={{ marginBottom: "1rem" }}>¡Solicitud Generada!</h1>
          <p style={{ color: "#6c757d", marginBottom: "2rem", lineHeight: "1.6" }}>
            Tu pedido <strong>#{pedidoData?.id_pedido}</strong> ha sido registrado.
            <br />
            <br />
            <strong>Próximo paso:</strong> Acércate a la óptica para confirmar tu receta,
            realizar el pago y retirar tus productos.
          </p>
          <button
            onClick={() => navigate("/dashboard/catalogo")}
            style={{
              width: "100%",
              padding: "1rem",
              background: "#0f3460",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Volver al catálogo
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="module-page cart-page">
      <header className="page-header">
        <div>
          <button
            className="icon-button back-btn"
            onClick={() => navigate("/dashboard/catalogo")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <ArrowLeft size={20} /> Seguir comprando
          </button>
          <h1 style={{ marginTop: "1rem" }}>Tu Carrito ({totalItems} productos)</h1>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      {cart.length === 0 ? (
        <div
          className="empty"
          style={{
            padding: "4rem",
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #eaeaea",
            marginTop: "2rem",
            textAlign: "center",
          }}
        >
          <ShoppingBag size={64} style={{ opacity: 0.2, marginBottom: "1rem" }} />
          <h2>Tu carrito está vacío</h2>
          <p style={{ color: "#6c757d" }}>
            Explora nuestro catálogo y encuentra los mejores productos para tu visión.
          </p>
          <button
            onClick={() => navigate("/dashboard/catalogo")}
            style={{ marginTop: "1rem", padding: "0.8rem 2rem" }}
          >
            Ir al Catálogo
          </button>
        </div>
      ) : (
        <div
          className="cart-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "2rem",
            marginTop: "2rem",
            alignItems: "start",
          }}
        >
          {/* Lista de productos */}
          <div className="cart-items" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {cart.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "1rem",
                  padding: "1.5rem",
                  background: "#fff",
                  borderRadius: "12px",
                  border: "1px solid #eaeaea",
                  alignItems: "center",
                }}
              >
                <img
                  src={
                    item.imagen_data ||
                    "https://placehold.co/100x100/f8f9fa/ced4da?text=IMG"
                  }
                  alt={item.nombre}
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "contain",
                    borderRadius: "8px",
                    border: "1px solid #eaeaea",
                    background: "#f8f9fa",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>
                    {item.nombre}
                  </h3>
                  <p style={{ margin: 0, color: "#6c757d", fontSize: "0.9rem" }}>
                    Opción: {item.options?.tipo || "Estándar"}
                  </p>
                  <strong
                    style={{
                      display: "block",
                      marginTop: "0.5rem",
                      color: "#0f3460",
                    }}
                  >
                    {formatoPrecio(item.precio)} c/u
                  </strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #eaeaea",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={() => updateQuantity(index, item.cantidad - 1)}
                      style={{
                        padding: "0.5rem 0.8rem",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                      }}
                    >
                      -
                    </button>
                    <span
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#f8f9fa",
                        minWidth: "40px",
                        textAlign: "center",
                      }}
                    >
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => updateQuantity(index, item.cantidad + 1)}
                      style={{
                        padding: "0.5rem 0.8rem",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                      }}
                    >
                      +
                    </button>
                  </div>
                  <strong style={{ minWidth: "80px", textAlign: "right" }}>
                    {formatoPrecio(item.cantidad * item.precio)}
                  </strong>
                  <button
                    onClick={() => removeFromCart(index)}
                    className="icon-button"
                    style={{ color: "#dc3545" }}
                    title="Eliminar"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen */}
          <div
            className="cart-summary"
            style={{
              padding: "2rem",
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #eaeaea",
              position: "sticky",
              top: "2rem",
            }}
          >
            <h2 style={{ margin: "0 0 1.5rem 0" }}>Resumen del pedido</h2>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "1rem",
                color: "#6c757d",
              }}
            >
              <span>Subtotal ({totalItems} items)</span>
              <span>{formatoPrecio(total)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "1rem",
                color: "#6c757d",
              }}
            >
              <span>Descuentos</span>
              <span>$0.00</span>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #eaeaea", margin: "1.5rem 0" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "2rem",
                fontSize: "1.2rem",
              }}
            >
              <strong>Total a pagar</strong>
              <strong style={{ color: "#0f3460" }}>{formatoPrecio(total)}</strong>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1.1rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.5rem",
                background: "#0f3460",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: loading || cart.length === 0 ? "not-allowed" : "pointer",
                opacity: loading || cart.length === 0 ? 0.6 : 1,
              }}
            >
              {loading ? (
                "Generando pedido..."
              ) : (
                <>
                  <CreditCard size={18} /> Generar solicitud de compra
                </>
              )}
            </button>
            <p
              style={{
                textAlign: "center",
                color: "#6c757d",
                fontSize: "0.85rem",
                marginTop: "1rem",
              }}
            >
              El pago se realiza físicamente en la óptica.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}