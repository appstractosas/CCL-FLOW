import React, { useState } from 'react';
import { Truck, Lock, LogIn, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import logoSrc from '/assets/logo.png';

export const LoginScreen: React.FC = () => {
  const { login } = useAuthStore();
  const [cedula, setCedula] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    const ok = await login(cedula, clave);
    setLoading(false);
    if (!ok) {
      setError('Cédula o clave incorrectas. Verifica tus credenciales.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#121726] rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-6 pb-5 border-b border-zinc-800 flex items-center space-x-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Torre de Control Logística</h1>
              <p className="text-xs text-zinc-400">Inicio de sesión · CCL-FLOW</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Cédula</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Número de cédula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Clave</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold px-3 py-2 rounded-xl flex items-center space-x-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>{loading ? 'Verificando...' : 'Ingresar al sistema'}</span>
            </button>

            <div className="pt-2 text-center">
              <div className="flex items-center justify-center space-x-1.5 text-[10px] text-zinc-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  ADMIN por defecto: cédula <strong className="text-zinc-300 font-mono">0000000000</strong> / clave{' '}
                  <strong className="text-zinc-300 font-mono">admin</strong>
                </span>
              </div>
              <img src={logoSrc} alt="CCL" className="h-7 mx-auto mt-3 opacity-70" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
