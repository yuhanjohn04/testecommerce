"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import "../globals.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api";
const ADMIN_PASSWORD = "admin123";

const emptyProduct = {
  title: "",
  price: "",
  stock: "",
  image_url: "",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "products", label: "Products" },
  { id: "orders", label: "Orders" },
];

const PAGE_SIZE = 5;

function asList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function errorMessage(data) {
  if (!data || typeof data !== "object") return "Request failed";
  if (typeof data.detail === "string") return data.detail;
  const parts = Object.entries(data).map(([key, value]) => {
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    return key === "non_field_errors" ? text : `${key}: ${text}`;
  });
  return parts.join(" ") || "Request failed";
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorMessage(data));
  return data;
}

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function orderItemCount(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function orderCountLabel(count) {
  return `${count} ${count === 1 ? "Item" : "Items"}`;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productPage, setProductPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modal, setModal] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    const [productData, orderData] = await Promise.all([
      api("/products/"),
      api("/orders/"),
    ]);
    setProducts(asList(productData));
    setOrders(asList(orderData));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated, load]);

  function login(event) {
    event.preventDefault();
    if (passcode !== ADMIN_PASSWORD) {
      alert("Incorrect password.");
      return;
    }
    setPasscode("");
    setIsAuthenticated(true);
  }

  function logout() {
    setIsAuthenticated(false);
    setPasscode("");
    setProducts([]);
    setOrders([]);
    setProductPage(1);
    setOrderPage(1);
    setSelectedOrder(null);
    setModal(null);
    setEditingId(null);
    setForm(emptyProduct);
    setMessage("");
    setError("");
    setLoading(true);
    setActiveTab("overview");
  }

  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(productPage, pageCount);
  const visibleProducts = products.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const orderPageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentOrderPage = Math.min(orderPage, orderPageCount);
  const visibleOrders = orders.slice(
    (currentOrderPage - 1) * PAGE_SIZE,
    currentOrderPage * PAGE_SIZE
  );

  function closeModal() {
    setModal(null);
    setEditingId(null);
    setForm(emptyProduct);
    setError("");
  }

  function openAddModal() {
    setForm(emptyProduct);
    setEditingId(null);
    setError("");
    setModal("add");
  }

  function openEditModal(product) {
    setForm({
      title: product.title,
      price: String(product.price),
      stock: String(product.stock),
      image_url: product.image_url || "",
    });
    setEditingId(product.id);
    setError("");
    setModal("edit");
  }

  useEffect(() => {
    if (!modal && !selectedOrder) return undefined;
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      if (modal) closeModal();
      setSelectedOrder(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, selectedOrder]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitProduct(event) {
    event.preventDefault();
    const payload = {
      title: form.title.trim(),
      price: form.price,
      stock: Number(form.stock),
      image_url: form.image_url.trim(),
    };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (modal === "edit") {
        await api(`/products/${editingId}/`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMessage(`Updated ${payload.title}.`);
      } else {
        await api("/products/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Product added.");
      }
      closeModal();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete ${product.title}?`)) return;
    setDeletingId(product.id);
    setMessage("");
    setError("");
    try {
      await api(`/products/${product.id}/`, { method: "DELETE" });
      await load();
      setMessage(`Deleted ${product.title}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="login-wrap">
        <section className="panel login-card">
          <h1>Admin</h1>
          <p className="muted">Enter the admin password to manage the store.</p>
          <form onSubmit={login}>
            <label className="field">
              Password
              <input
                required
                autoFocus
                type="password"
                autoComplete="current-password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
              />
            </label>
            <button type="submit">Log in</button>
          </form>
          <p className="muted">
            <Link href="/">Back to store</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <h1>Admin</h1>
        <div className="topbar-actions">
          <button type="button" className="ghost" onClick={logout}>
            Logout
          </button>
          <Link href="/">Back to store</Link>
        </div>
      </header>

      <nav className="tabs" aria-label="Admin sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedOrder(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? <p className="banner error">{error}</p> : null}
      {message ? <p className="banner">{message}</p> : null}

      {activeTab === "overview" ? (
        <div className="stack">
          <section>
            <h2>Dashboard</h2>
            {loading ? <p className="muted">Loading…</p> : null}
            <div className="stats">
              <article className="stat">
                <span>Total revenue</span>
                <strong>₹{revenue.toFixed(2)}</strong>
              </article>
              <article className="stat">
                <span>Products</span>
                <strong>{products.length}</strong>
              </article>
              <article className="stat">
                <span>Orders</span>
                <strong>{orders.length}</strong>
              </article>
            </div>
          </section>
          <section className="panel">
            <h2>Quick links</h2>
            <div className="quick-links">
              <button type="button" onClick={() => setActiveTab("products")}>
                Manage products
              </button>
              <button type="button" className="ghost" onClick={() => setActiveTab("orders")}>
                View orders
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "products" ? (
        <section>
          <div className="section-head">
            <h2>Products ({products.length})</h2>
            <button type="button" onClick={openAddModal}>
              + Add New Product
            </button>
          </div>
          {loading ? <p className="muted">Loading…</p> : null}
          {!loading && products.length === 0 ? <p className="muted">No products yet.</p> : null}
          {products.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          {product.image_url ? (
                            <img className="thumb" src={product.image_url} alt="" />
                          ) : null}
                          <strong>{product.title}</strong>
                        </div>
                      </td>
                      <td>₹{product.price}</td>
                      <td>{product.stock}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="ghost" onClick={() => openEditModal(product)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="danger"
                            disabled={deletingId === product.id}
                            onClick={() => deleteProduct(product)}
                          >
                            {deletingId === product.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pager">
                <button
                  type="button"
                  className="ghost"
                  disabled={currentPage <= 1}
                  onClick={() => setProductPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  className="ghost"
                  disabled={currentPage >= pageCount}
                  onClick={() => setProductPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section>
          <h2>Orders ({orders.length})</h2>
          {loading ? <p className="muted">Loading…</p> : null}
          {!loading && orders.length === 0 ? <p className="muted">No orders yet.</p> : null}
          {orders.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr key={order.id}>
                      <td>#{order.id}</td>
                      <td>
                        <strong>{order.customer_name}</strong>
                        <div className="muted">{order.email}</div>
                      </td>
                      <td>{formatWhen(order.created_at)}</td>
                      <td>
                        <div className="row-actions">
                          <span className="count-badge">{orderCountLabel(orderItemCount(order))}</span>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => setSelectedOrder(order)}
                          >
                            View Details
                          </button>
                        </div>
                      </td>
                      <td>₹{order.total}</td>
                      <td>
                        <span className="status-badge">Placed</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pager">
                <button
                  type="button"
                  className="ghost"
                  disabled={currentOrderPage <= 1}
                  onClick={() => setOrderPage(currentOrderPage - 1)}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {currentOrderPage} of {orderPageCount}
                </span>
                <button
                  type="button"
                  className="ghost"
                  disabled={currentOrderPage >= orderPageCount}
                  onClick={() => setOrderPage(currentOrderPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedOrder ? (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div
            className="modal order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="order-modal-head">
              <h2 id="order-modal-title">Order #{selectedOrder.id}</h2>
              <span className="status-badge">Placed</span>
            </div>
            <p>
              <strong>{selectedOrder.customer_name}</strong>
            </p>
            <p className="muted">{selectedOrder.email}</p>
            <p className="muted">{formatWhen(selectedOrder.created_at)}</p>
            {(selectedOrder.items || []).length ? (
              <ul className="detail-list">
                {selectedOrder.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.product?.title || "Item"}</span>
                    <span>
                      {item.quantity} × ₹{item.unit_price}
                    </span>
                    <strong>₹{item.subtotal}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No items on this order.</p>
            )}
            <p className="detail-total">
              <span>Total</span>
              <strong>₹{selectedOrder.total}</strong>
            </p>
            <div className="row-actions modal-actions">
              <button type="button" className="ghost" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="product-modal-title">
              {modal === "edit" ? "Edit product" : "Add new product"}
            </h2>
            {error ? <p className="banner error">{error}</p> : null}
            <form onSubmit={submitProduct}>
              <label className="field">
                Title
                <input
                  required
                  autoFocus
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                />
              </label>
              <label className="field">
                Price
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.price}
                  onChange={(event) => updateForm("price", event.target.value)}
                />
              </label>
              <label className="field">
                Stock
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={form.stock}
                  onChange={(event) => updateForm("stock", event.target.value)}
                />
              </label>
              <label className="field">
                Image URL
                <input
                  type="url"
                  placeholder="https://"
                  value={form.image_url}
                  onChange={(event) => updateForm("image_url", event.target.value)}
                />
              </label>
              <div className="row-actions modal-actions">
                <button type="button" className="ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : modal === "edit" ? "Save" : "Add product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
