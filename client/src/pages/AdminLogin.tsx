import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface AdminLoginProps {
  onSuccess: (token: string) => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: (data) => {
      onSuccess(data.token);
      toast.success("Добро пожаловать!");
    },
    onError: (err) => {
      toast.error(err.message || "Ошибка входа");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Введите логин и пароль");
      return;
    }
    loginMutation.mutate({ username: username.trim(), password: password.trim() });
  };

  return (
    <div className="admin-login-wrapper">
      <style>{loginStyles}</style>
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-login-logo">🔐</div>
          <h1 className="admin-login-title">Панель управления</h1>
          <p className="admin-login-subtitle">Ковка в Дворик</p>
        </div>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-login-field">
            <label>Логин</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Введите логин"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="admin-login-field">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="admin-login-btn"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Вход..." : "Войти"}
          </button>
        </form>
        <a href="/" className="admin-login-back">← На главную</a>
      </div>
    </div>
  );
}

const loginStyles = `
.admin-login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FAF8F5 0%, #F0EBE4 50%, #E8E0D6 100%);
  font-family: 'Sora', sans-serif;
  padding: 20px;
}

.admin-login-card {
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(44, 42, 38, 0.08), 0 2px 8px rgba(44, 42, 38, 0.04);
  border: 1px solid rgba(199, 93, 60, 0.1);
}

.admin-login-header {
  text-align: center;
  margin-bottom: 32px;
}

.admin-login-logo {
  font-size: 48px;
  margin-bottom: 16px;
}

.admin-login-title {
  font-size: 22px;
  font-weight: 700;
  color: #2D2A26;
  margin: 0 0 4px 0;
}

.admin-login-subtitle {
  font-size: 14px;
  color: #8B8580;
  margin: 0;
}

.admin-login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.admin-login-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.admin-login-field label {
  font-size: 13px;
  font-weight: 600;
  color: #4A4540;
}

.admin-login-field input {
  padding: 12px 16px;
  border: 1.5px solid #E8E4DF;
  border-radius: 12px;
  font-size: 15px;
  font-family: 'Sora', sans-serif;
  color: #2D2A26;
  background: #FAFAF8;
  outline: none;
  transition: all 0.2s;
}

.admin-login-field input:focus {
  border-color: #C75D3C;
  background: white;
  box-shadow: 0 0 0 3px rgba(199, 93, 60, 0.1);
}

.admin-login-field input::placeholder {
  color: #B0AAA4;
}

.admin-login-btn {
  padding: 14px;
  background: #C75D3C;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  font-family: 'Sora', sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 4px;
}

.admin-login-btn:hover:not(:disabled) {
  background: #B04E30;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(199, 93, 60, 0.3);
}

.admin-login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.admin-login-back {
  display: block;
  text-align: center;
  margin-top: 20px;
  color: #8B8580;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}

.admin-login-back:hover {
  color: #C75D3C;
}
`;
