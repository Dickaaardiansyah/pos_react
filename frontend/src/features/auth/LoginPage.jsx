// src/features/auth/LoginPage.jsx
import { User, Lock, Eye, EyeOff, Store } from "lucide-react";
import { useLogin } from "./useLogin";

export default function Login() {
  const { form, setField, showPassword, toggleShowPassword, submitting, submit } = useLogin();

  return (
    <div className="login-screen">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="logo-icon"><Store size={26} /></div>
          <div className="login-title">Kasirqu</div>
          <div className="login-subtitle">Masuk untuk melanjutkan</div>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="login-field-icon-wrap">
              <User size={16} />
              <input
                className="form-input"
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                placeholder="Masukkan username"
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="login-field-icon-wrap">
              <Lock size={16} />
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder="Masukkan password"
              />
              <button type="button" className="login-toggle-password" onClick={toggleShowPassword}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full mt-3" disabled={submitting}>
            {submitting ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <div className="login-footer-hint">
          Demo: admin / admin123 &nbsp;•&nbsp; kasir1 / kasir123
        </div>
      </div>
    </div>
  );
}
