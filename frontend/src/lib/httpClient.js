// src/lib/httpClient.js
// ─────────────────────────────────────────────────────────────────────────────
// MODEL-LAYER FOUNDATION — satu-satunya tempat yang tahu cara berbicara ke
// REST API. Domain model (productModel, transactionModel, dst.) memakai
// client ini, sehingga presenter/hook tidak pernah memanggil fetch() langsung.
// ─────────────────────────────────────────────────────────────────────────────
const raw = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const BASE_URL = raw ? `${raw}/api` : "/api";

function getToken() {
  try {
    return (
      JSON.parse(localStorage.getItem("pos_auth") || "{}").token ||
      localStorage.getItem("pos_token") ||
      ""
    );
  } catch {
    return localStorage.getItem("pos_token") || "";
  }
}

function toQueryString(params) {
  if (!params) return "";
  if (typeof params === "string") return params;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? "?" + qs : "";
}

async function request(method, path, body = null, isBlob = false) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);

  if (res.status === 401) {
    // Token tidak valid/kadaluarsa — beri tahu AuthContext untuk logout paksa.
    window.dispatchEvent(new CustomEvent("pos:unauthorized"));
  }

  if (isBlob) {
    if (!res.ok) throw new Error("Gagal mengunduh file");
    return res.blob();
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// Untuk request yang membawa file (mis. upload nota supplier). Tidak set
// Content-Type manual supaya browser otomatis menambahkan multipart boundary.
async function requestFormData(method, path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("pos:unauthorized"));
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function downloadFile(path, filename) {
  const blob = await request("GET", path, null, true);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Untuk melihat file yang butuh header Authorization (mis. nota supplier —
// sekarang disajikan lewat route API terautentikasi, bukan lagi file
// statis publik). <a href> biasa tidak bisa dipakai karena browser tidak
// menyertakan header custom saat membuka link, jadi file-nya diambil dulu
// lewat fetch (otomatis bawa token), lalu ditampilkan sebagai blob URL di
// tab baru.
async function openFile(path) {
  // Tab kosong dibuka SINKRON di dalam handler klik pengguna (sebelum
  // await fetch), supaya tidak diblokir popup blocker browser — banyak
  // browser menolak window.open yang dipanggil setelah proses async selesai.
  const tab = window.open("", "_blank");
  try {
    const blob = await request("GET", path, null, true);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
  } catch (err) {
    if (tab) tab.close();
    throw err;
  }
}

export const httpClient = {
  get: (path, params) => request("GET", `${path}${toQueryString(params)}`),
  post: (path, body) => request("POST", path, body),
  postFormData: (path, formData) => requestFormData("POST", path, formData),
  put: (path, body) => request("PUT", path, body),
  delete: (path) => request("DELETE", path),
  downloadFile,
  openFile,
};
