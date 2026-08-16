import { useEffect, useState } from "react";
import { Search, ShoppingBag, Eye } from "lucide-react";
import { apiFetch } from "../../services/api";

export default function Catalogo() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const data = await apiFetch(`/inventario/catalogo?${params}`);
        setProductos(data);
        setError("");
      } catch (err) {
        setError(err.message || "Error al cargar el catálogo");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [query]);

  // Formatear precio en USD
  const formatoPrecio = (valor) =>
    new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: "USD",
    }).format(valor || 0);

  return (
    <section className="module-page catalogo-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Tienda</span>
          <h1>Catálogo de productos</h1>
          <p>{productos.length} productos disponibles</p>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      <div className="table-toolbar">
        <label>
          Buscar producto
          <div className="input-icon">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, código o SKU"
            />
          </div>
        </label>
        <span className="result-count">
          {loading ? "Cargando…" : `${productos.length} resultados`}
        </span>
      </div>

      {loading ? (
        <div className="loading-spinner">Cargando catálogo…</div>
      ) : productos.length === 0 ? (
        <div className="empty">
          <ShoppingBag size={48} />
          <p>No hay productos disponibles en este momento.</p>
        </div>
      ) : (
        <div className="catalogo-grid">
          {productos.map((producto) => (
            <article className="product-card" key={producto.id_producto}>
              <div className="product-image">
                {producto.imagen_data ? (
                  <img src={producto.imagen_data} alt={producto.nombre} />
                ) : (
                  <div className="image-placeholder">
                    <ShoppingBag size={40} />
                  </div>
                )}
                {producto.stock <= 0 && (
                  <span className="badge-out-of-stock">Sin stock</span>
                )}
                {producto.stock > 0 && producto.stock <= producto.stock_minimo && (
                  <span className="badge-low-stock">Pocas unidades</span>
                )}
              </div>
              <div className="product-info">
                <h3>{producto.nombre}</h3>
                {producto.categoria && (
                  <span className="product-category">{producto.categoria}</span>
                )}
                <p className="product-description">
                  {producto.descripcion || "Sin descripción"}
                </p>
                {producto.material && (
                  <small>Material: {producto.material}</small>
                )}
                <div className="product-price">
                  <strong>{formatoPrecio(producto.precio)}</strong>
                  {producto.stock > 0 && (
                    <span className="stock-info">Stock: {producto.stock}</span>
                  )}
                </div>
                <button className="secondary" disabled={producto.stock <= 0} onClick={() => window.location.href = `/dashboard/producto/${producto.id_producto}`}>
                  <Eye size={16} /> Ver detalles
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}