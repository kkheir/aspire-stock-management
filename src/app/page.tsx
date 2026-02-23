"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type StockStatus = "in stock" | "low stock" | "ordered" | "discontinued";
type Role = "admin" | "manager" | "procurement" | "viewer";

type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  category: string;
  status: StockStatus;
  reorderLevel: number;
  location: string;
  supplier: string;
  notes: string;
  updatedAt: string;
};

type TeamMember = {
  username: string;
  password: string;
  role: Role;
  displayName: string;
};

type Toast = { id: string; message: string; type: "success" | "error" | "info" };

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const STORAGE_KEYS = { user: "ims_user_v4" };

const TEAM: TeamMember[] = [
  { username: "admin", password: "admin123", role: "admin", displayName: "Alice Admin" },
  { username: "manager", password: "manager123", role: "manager", displayName: "Mark Manager" },
  { username: "buyer", password: "buyer123", role: "procurement", displayName: "Priya Procurement" },
  { username: "viewer", password: "viewer123", role: "viewer", displayName: "Victor Viewer" },
];

const PERMISSIONS: Record<Role, { canCreate: boolean; canEdit: boolean; canDelete: boolean }> = {
  admin: { canCreate: true, canEdit: true, canDelete: true },
  manager: { canCreate: true, canEdit: true, canDelete: false },
  procurement: { canCreate: true, canEdit: true, canDelete: false },
  viewer: { canCreate: false, canEdit: false, canDelete: false },
};

const STATUSES: StockStatus[] = ["in stock", "low stock", "ordered", "discontinued"];

const STATUS_STYLE: Record<StockStatus, { bg: string; text: string; dot: string }> = {
  "in stock": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  "low stock": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  ordered: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  discontinued: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-400" },
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "bg-violet-100 text-violet-700",
  manager: "bg-sky-100 text-sky-700",
  procurement: "bg-amber-100 text-amber-700",
  viewer: "bg-slate-100 text-slate-600",
};

const emptyForm: Omit<InventoryItem, "id" | "updatedAt"> = {
  name: "",
  sku: "",
  quantity: 0,
  category: "",
  status: "in stock",
  reorderLevel: 5,
  location: "",
  supplier: "",
  notes: "",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function suggestCategory(name: string) {
  const v = name.toLowerCase();
  if (/(scanner|printer|laptop|monitor|usb|mouse|keyboard|charger|cable)/.test(v)) return "Electronics";
  if (/(tape|box|label|bubble|pallet|wrap|crate)/.test(v)) return "Warehouse Supplies";
  if (/(clean|sanit|glove|mask|goggles|helmet|vest)/.test(v)) return "Safety & Cleaning";
  if (/(pen|paper|staple|folder|binder|clip|envelope)/.test(v)) return "Office Supplies";
  return "General";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

function stockPercent(qty: number, reorder: number) {
  if (reorder === 0) return qty > 0 ? 100 : 0;
  return Math.min(Math.round((qty / (reorder * 2.5)) * 100), 100);
}

/* ------------------------------------------------------------------ */
/*  Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */
const Icons = {
  search: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    </svg>
  ),
  box: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  alert: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  truck: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  ban: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  sparkle: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
  edit: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  trash: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  logout: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
  check: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  x: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
  user: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  plus: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }: { status: StockStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function StockBar({ quantity, reorderLevel }: { quantity: number; reorderLevel: number }) {
  const pct = stockPercent(quantity, reorderLevel);
  const color = pct > 60 ? "bg-emerald-500" : pct > 30 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 text-right text-xs font-semibold tabular-nums">{quantity}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <p className="mb-1 text-base font-semibold text-slate-900">Confirm Deletion</p>
        <p className="mb-5 text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastBar({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all duration-300
            ${
              t.type === "success"
                ? "bg-emerald-600 text-white"
                : t.type === "error"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-800 text-white"
            }`}
        >
          {t.type === "success" ? Icons.check : t.type === "error" ? Icons.x : Icons.info}
          {t.message}
          <button onClick={() => dismiss(t.id)} className="ml-2 opacity-70 hover:opacity-100">
            {Icons.x}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Home() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [user, setUser] = useState<TeamMember | null>(null);
  const [mounted, setMounted] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoadingItems(true);
      const res = await fetch("/api/items", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load inventory items");
      }

      const data = (await res.json()) as InventoryItem[];
      setItems(data);
    } catch {
      toast("Could not load items from PostgreSQL", "error");
    } finally {
      setIsLoadingItems(false);
    }
  }, [toast]);

  /* Persistence */
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.user);
    if (storedUser) setUser(JSON.parse(storedUser));
    void fetchItems();
    setMounted(true);
  }, [fetchItems]);

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }, [user]);

  /* Computed */
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(items.map((i) => i.category))).sort()],
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((item) => {
      const hay = [item.name, item.category, item.status, item.sku, item.location, item.supplier, item.notes]
        .join(" ")
        .toLowerCase();
      return (
        (!q || hay.includes(q)) &&
        (statusFilter === "all" || item.status === statusFilter) &&
        (categoryFilter === "all" || item.category === categoryFilter)
      );
    });
  }, [items, query, statusFilter, categoryFilter]);

  const aiRestockInsights = useMemo(() => {
    return items
      .filter((i) => i.status !== "discontinued")
      .map((item) => {
        const risk =
          item.quantity <= item.reorderLevel
            ? "high"
            : item.quantity <= item.reorderLevel * 1.5
              ? "medium"
              : "low";
        return {
          ...item,
          risk,
          recommendation:
            risk === "high"
              ? `Reorder ${Math.max(item.reorderLevel * 2 - item.quantity, 1)} units immediately.`
              : risk === "medium"
                ? "Monitor closely this week."
                : "Stock level healthy.",
        };
      })
      .sort(
        (a, b) =>
          ({ high: 0, medium: 1, low: 2 }[a.risk] ?? 2) - ({ high: 0, medium: 1, low: 2 }[b.risk] ?? 2),
      )
      .slice(0, 6);
  }, [items]);

  const perms = user ? PERMISSIONS[user.role] : PERMISSIONS.viewer;

  /* Actions */
  const submitItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity),
      reorderLevel: Number(form.reorderLevel),
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/items/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = (await res.json()) as { error?: string };
          throw new Error(error.error ?? "Failed to update item");
        }

        const updated = (await res.json()) as InventoryItem;
        setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
        toast("Item updated successfully");
        setEditingId(null);
      } else {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = (await res.json()) as { error?: string };
          throw new Error(error.error ?? "Failed to create item");
        }

        const created = (await res.json()) as InventoryItem;
        setItems((prev) => [created, ...prev]);
        toast("Item added to inventory");
      }

      setForm(emptyForm);
      setShowForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save item";
      toast(message, "error");
    }
  };

  const editItem = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      category: item.category,
      status: item.status,
      reorderLevel: item.reorderLevel,
      location: item.location,
      supplier: item.supplier,
      notes: item.notes,
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/items/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = (await res.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to delete item");
      }

      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      toast("Item deleted", "error");
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete item";
      toast(message, "error");
    }
  };

  const login = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = TEAM.find((m) => m.username === username && m.password === password);
    if (!found) {
      setLoginError("Invalid username or password. Try again.");
      return;
    }
    setLoginError("");
    setUser(found);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.user);
  };

  /* SSR guard */
  if (!mounted) return null;

  /* -------------------------------------------------------------- */
  /*  Login Screen                                                   */
  /* -------------------------------------------------------------- */
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
              {Icons.box}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">StockPilot</h1>
            <p className="mt-1 text-sm text-indigo-300/80">Inventory Management System</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="mb-1 text-lg font-semibold text-white">Welcome back</h2>
            <p className="mb-6 text-sm text-slate-400">Sign in with your team credentials</p>

            <form onSubmit={login} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Username</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none ring-indigo-500 transition focus:border-indigo-500 focus:ring-1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none ring-indigo-500 transition focus:border-indigo-500 focus:ring-1"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              {loginError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {Icons.x}
                  {loginError}
                </div>
              )}
              <button className="w-full rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 hover:shadow-indigo-500/40 active:scale-[0.98]">
                Sign In
              </button>
            </form>
          </div>

          {/* Demo credentials */}
          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
              Demo Credentials
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {TEAM.map((m) => (
                <button
                  key={m.username}
                  onClick={() => {
                    setUsername(m.username);
                    setPassword(m.password);
                  }}
                  className="rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-left text-slate-400 transition hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300"
                >
                  <span className="font-medium text-slate-300">{m.username}</span>
                  <span className="ml-1 text-slate-600">· {m.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* -------------------------------------------------------------- */
  /*  Dashboard                                                      */
  /* -------------------------------------------------------------- */
  const statCards = [
    {
      label: "Total Items",
      value: items.length,
      icon: Icons.box,
      accent: "text-indigo-600",
      iconBg: "bg-indigo-50",
      border: "border-indigo-100",
    },
    {
      label: "Low Stock",
      value: items.filter((i) => i.status === "low stock").length,
      icon: Icons.alert,
      accent: "text-amber-600",
      iconBg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "On Order",
      value: items.filter((i) => i.status === "ordered").length,
      icon: Icons.truck,
      accent: "text-sky-600",
      iconBg: "bg-sky-50",
      border: "border-sky-100",
    },
    {
      label: "Discontinued",
      value: items.filter((i) => i.status === "discontinued").length,
      icon: Icons.ban,
      accent: "text-rose-600",
      iconBg: "bg-rose-50",
      border: "border-rose-100",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              {Icons.box}
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold leading-tight text-slate-900">StockPilot</h1>
              <p className="text-xs text-slate-500">Inventory Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 py-1.5 pl-3 pr-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                {Icons.user}
              </div>
              <div className="hidden pr-1 sm:block">
                <p className="text-sm font-medium leading-tight text-slate-800">
                  {user.displayName}
                </p>
                <p className="text-[10px] leading-tight">
                  <span
                    className={`inline-block rounded-full px-1.5 py-0.5 font-medium ${ROLE_COLOR[user.role]}`}
                  >
                    {user.role}
                  </span>
                </p>
              </div>
              <button
                onClick={logout}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Sign out"
              >
                {Icons.logout}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Stat Cards */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <article
              key={card.label}
              className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${card.border}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{card.label}</p>
                  <p className={`mt-1 text-3xl font-bold tabular-nums ${card.accent}`}>
                    {card.value}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg} ${card.accent}`}
                >
                  {card.icon}
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Search + Filters + Add */}
        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {Icons.search}
            </span>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-sm outline-none ring-indigo-500 transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Search items by name, SKU, category, supplier…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-300"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StockStatus | "all")}
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-300"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </option>
              ))}
            </select>
            {perms.canCreate && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingId(null);
                  setForm(emptyForm);
                  setTimeout(
                    () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    100,
                  );
                }}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98]"
              >
                {Icons.plus} Add Item
              </button>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Items Table */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Inventory Items</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {filteredItems.length} items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Item</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="group transition hover:bg-indigo-50/40">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.sku} · {item.location}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StockBar quantity={item.quantity} reorderLevel={item.reorderLevel} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{item.supplier}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          {perms.canEdit && (
                            <button
                              onClick={() => editItem(item)}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
                            >
                              {Icons.edit} Edit
                            </button>
                          )}
                          {perms.canDelete && (
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                            >
                              {Icons.trash} Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {isLoadingItems && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm font-medium text-slate-600">Loading items from PostgreSQL...</p>
                </div>
              )}
              {!isLoadingItems && filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    {Icons.search}
                  </div>
                  <p className="text-sm font-medium text-slate-600">No items found</p>
                  <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </section>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            {/* Add / Edit Form */}
            {showForm && (
              <div
                ref={formRef}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    {editingId ? "Edit Item" : "New Item"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {Icons.x}
                  </button>
                </div>
                <form onSubmit={submitItem} className="space-y-3 p-5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      Item Name
                    </label>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      placeholder="e.g. Wireless Scanner"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">SKU</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                        value={form.sku}
                        onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                        required
                        placeholder="SCAN-001"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                        value={form.quantity}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, quantity: Number(e.target.value) }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Category</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                        value={form.category}
                        onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                        required
                        placeholder="Electronics"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, category: suggestCategory(p.name) }))}
                        className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
                        title="AI auto-suggest based on item name"
                      >
                        {Icons.sparkle} Suggest
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
                        value={form.status}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, status: e.target.value as StockStatus }))
                        }
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Reorder Level
                      </label>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                        value={form.reorderLevel}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, reorderLevel: Number(e.target.value) }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Location
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                        value={form.location}
                        onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                        placeholder="Aisle A-1"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        Supplier
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                        value={form.supplier}
                        onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
                        placeholder="TechSource Ltd"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
                    <textarea
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      placeholder="Optional notes…"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 active:scale-[0.98]"
                    >
                      {editingId ? "Save Changes" : "Add Item"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                        setForm(emptyForm);
                      }}
                      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* AI Restock Insights */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4">
                <span className="text-indigo-600">{Icons.sparkle}</span>
                <h2 className="text-base font-semibold text-slate-900">AI Restock Insights</h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {aiRestockInsights.map((insight) => {
                  const riskColor =
                    insight.risk === "high"
                      ? "border-l-rose-500 bg-rose-50/40"
                      : insight.risk === "medium"
                        ? "border-l-amber-500 bg-amber-50/40"
                        : "border-l-emerald-500 bg-emerald-50/30";
                  const riskBadge =
                    insight.risk === "high"
                      ? "bg-rose-100 text-rose-700"
                      : insight.risk === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700";
                  return (
                    <li key={insight.id} className={`border-l-4 px-5 py-3 ${riskColor}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{insight.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{insight.recommendation}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${riskBadge}`}
                        >
                          {insight.risk}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {aiRestockInsights.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  All stock levels look healthy!
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Modals & Toasts */}
      {deleteTarget && (
        <ConfirmModal
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <ToastBar toasts={toasts} dismiss={dismissToast} />
    </main>
  );
}
