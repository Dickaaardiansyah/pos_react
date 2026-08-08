// src/context/ShiftContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT — status sesi kas (shift) yang dipakai bersama di seluruh aplikasi:
// Sidebar (tombol "Selesai Shift"), halaman Kasir (gerbang "Belum Mulai Shift"),
// dan halaman Kas Kecil/Biaya. Dengan satu sumber data, buka/tutup kas dari
// mana saja langsung sinkron di semua tempat tanpa perlu pindah halaman.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { cashRegisterApi as cashRegisterModel } from "../features/cashRegister/api";
import { useAuth } from "./AuthContext";

const ShiftContext = createContext(null);

export function ShiftProvider({ children }) {
  const { user } = useAuth();
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadActive = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await cashRegisterModel.getActive();
      setShift(res.data);
    } catch {
      // Diam-diam gagal — halaman yang butuh status shift akan menampilkan
      // gerbang "Belum Mulai Shift" sebagai fallback yang aman.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadActive(); }, [loadActive]);

  const [opening, setOpening] = useState(false);
  async function openShift({ openingBalance, openingNotes }) {
    if (openingBalance === "" || openingBalance === undefined || Number(openingBalance) < 0) {
      toast.error("Modal awal kas wajib diisi dan tidak boleh negatif");
      return false;
    }
    setOpening(true);
    try {
      const res = await cashRegisterModel.open({
        opening_balance: Number(openingBalance),
        opening_notes: openingNotes || "",
        opened_by: user?.name || "Admin",
      });
      setShift(res.data);
      toast.success("Shift dimulai. Selamat bekerja!");
      return true;
    } catch (e) {
      toast.error(e.message || "Gagal membuka kas");
      return false;
    } finally {
      setOpening(false);
    }
  }

  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState(null);
  async function closeShift({ closingBalancePhysical, closingNotes }) {
    if (closingBalancePhysical === "" || closingBalancePhysical === undefined || Number(closingBalancePhysical) < 0) {
      toast.error("Jumlah kas fisik hasil hitung wajib diisi");
      return false;
    }
    setClosing(true);
    try {
      const res = await cashRegisterModel.close(shift.id, {
        closing_balance_physical: Number(closingBalancePhysical),
        closing_notes: closingNotes || "",
        closed_by: user?.name || "Admin",
      });
      setCloseResult(res.data);
      setShift(null);
      toast.success("Shift selesai. Kas berhasil ditutup");
      return true;
    } catch (e) {
      toast.error(e.message || "Gagal menutup kas");
      return false;
    } finally {
      setClosing(false);
    }
  }

  return (
    <ShiftContext.Provider
      value={{ shift, setShift, loading, reload: loadActive, opening, openShift, closing, closeShift, closeResult, setCloseResult }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be used within ShiftProvider");
  return ctx;
}