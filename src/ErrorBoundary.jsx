import React from "react";

// Evita que un error al renderizar una sección tumbe toda la app (pantalla en
// blanco). Muestra el mensaje y permite reintentar.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch() {}
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#2a1c1c", border: "1px solid #e25c5c", borderRadius: 12, padding: 20, color: "#e8a0a0", fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#e25c5c" }}>Algo falló al mostrar esta sección</div>
          <div style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", marginBottom: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button onClick={() => this.setState({ error: null })}
            style={{ background: "#d4af37", color: "#0c1118", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12 }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
