// src/features/auth/useLogin.js
// Hook fitur login — form state lokal + useMutation untuk request login.
// (Login tidak butuh useQuery karena tidak ada data untuk di-cache/refetch.)
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { authApi } from "./api";
import { useAuth } from "../../context/AuthContext";

export function useLogin() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.login(form.username, form.password),
    onSuccess: (res) => {
      login(res.data.user, res.data.token);
      toast.success(`Selamat datang, ${res.data.user.name}!`);
    },
    onError: (e) => toast.error(e.message || "Login gagal"),
  });

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleShowPassword() {
    setShowPassword((v) => !v);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error("Username dan password wajib diisi");
      return;
    }
    mutation.mutate();
  }

  return {
    form,
    setField,
    showPassword,
    toggleShowPassword,
    submitting: mutation.isPending,
    submit,
  };
}
