import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div style={{
      width: "200px",
      background: "#1f2937",
      color: "#fff",
      minHeight: "100vh",
      padding: "20px"
    }}>
      <h3>Modules</h3>

      <Link to="/products" style={linkStyle}>
        Products
      </Link>
    </div>
  );
}

const linkStyle = {
  display: "block",
  margin: "10px 0",
  background: "#d22d4b",
  color: "#fff",
  padding: "8px",
  borderRadius: "6px",
  textDecoration: "none"
};