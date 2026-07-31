import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

export const PageHeader = ({ eyebrow, title, description, actions }) => <header className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;

export const StatusBadge = ({ children, tone = "neutral" }) => <span className={`status-badge ${tone}`}>{children}</span>;

export const LoadingState = ({ label = "Cargando información…" }) => <div className="state-view" role="status"><LoaderCircle className="spin"/><strong>{label}</strong><span>Esto puede tomar unos segundos.</span></div>;

export const EmptyState = ({ title = "No hay resultados", description = "Ajusta los filtros o crea un nuevo registro." }) => <div className="state-view"><Inbox/><strong>{title}</strong><span>{description}</span></div>;

export const ErrorState = ({ message, onRetry }) => <div className="state-view error" role="alert"><AlertCircle/><strong>No pudimos cargar la información</strong><span>{message}</span>{onRetry && <button type="button" className="secondary" onClick={onRetry}>Reintentar</button>}</div>;

export const SectionCard = ({ eyebrow, title, children, className = "" }) => <section className={`panel ${className}`}><div className="panel-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div></div>{children}</section>;
