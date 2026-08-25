import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, CheckCheck, DoorClosed, MapPin, X } from 'lucide-react';
import { useLogisticsStore } from '../../store/useLogisticsStore';
import { timeAgo } from '../../lib/dateUtils';
import type { Notificacion } from '../../types';

const TOAST_MS = 6000;

function notifMeta(n: Notificacion): { icon: React.ReactNode; box: string; border: string } {
  if (n.tipo === 'MUELLE_ASIGNADO') {
    return {
      icon: <MapPin className="w-4 h-4" />,
      box: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      border: 'border-blue-500/40',
    };
  }
  return {
    icon: <DoorClosed className="w-4 h-4" />,
    box: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    border: 'border-rose-500/40',
  };
}

export const NotificationsBell: React.FC = () => {
  const { notificaciones, unreadNotifCount, markNotifRead } = useLogisticsStore();

  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Notificacion | null>(null);
  const firstIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Banner estilo WhatsApp: solo cuando llega una notificación NUEVA (id distinto
  // al último visto), nunca al cargar el historial inicial.
  useEffect(() => {
    const latest = notificaciones[0];
    if (!latest) return;
    if (firstIdRef.current === null) {
      firstIdRef.current = latest.id;
      return;
    }
    if (latest.id !== firstIdRef.current) {
      firstIdRef.current = latest.id;
      setToast(latest);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
    }
  }, [notificaciones]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadNotifCount > 0) markNotifRead();
  };

  return (
    <div className="relative">
      {/* Campana con contador de no leídas */}
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unreadNotifCount > 0 && !open && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
            {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Fondo invisible: un clic fuera cierra el panel */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="fixed top-16 left-3 right-3 z-50 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-96 bg-[#121726] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-[#0b0f19]">
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30">
                  <Bell className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Notificaciones</h4>
                  <p className="text-[10px] text-zinc-400">Eventos de la operación (en vivo)</p>
                </div>
              </div>
              <button
                onClick={markNotifRead}
                disabled={unreadNotifCount === 0}
                className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Leer todas
              </button>
            </div>

            {/* Lista de notificaciones */}
            {notificaciones.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <BellOff className="w-6 h-6 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-500">Sin notificaciones por ahora</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/80">
                {notificaciones.slice(0, 30).map((n) => {
                  const meta = notifMeta(n);
                  return (
                    <div
                      key={n.id}
                      className={`px-3 py-2.5 flex items-start gap-2.5 ${n.leida ? 'opacity-60' : 'bg-emerald-500/5'}`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 ${meta.box}`}>{meta.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold text-white truncate">{n.titulo}</p>
                          <span className="text-[9px] text-zinc-500 whitespace-nowrap">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        {n.llaveRelacionada && (
                          <span className="inline-block text-[9px] bg-zinc-900 font-mono px-1 py-0.5 rounded font-bold text-zinc-300 mt-0.5 border border-zinc-800">
                            {n.llaveRelacionada}
                          </span>
                        )}
                        <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5">
                          {n.mensaje}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Banner flotante (estilo WhatsApp) al llegar una notificación nueva */}
      {toast && (
        <div className="fixed top-16 right-3 left-3 z-[70] sm:right-6 sm:left-auto sm:w-96 animate-in slide-in-from-top-5 fade-in duration-200">
          <div
            className={`bg-[#121726] border rounded-xl shadow-2xl overflow-hidden ${notifMeta(toast).border}`}
          >
            <div className="flex items-start gap-2.5 p-3.5">
              <div className={`p-2 rounded-lg shrink-0 ${notifMeta(toast).box}`}>
                {notifMeta(toast).icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white">{toast.titulo}</p>
                  <button
                    onClick={() => setToast(null)}
                    className="text-zinc-400 hover:text-white p-0.5 rounded"
                    aria-label="Cerrar notificación"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {toast.llaveRelacionada && (
                  <span className="inline-block text-[9px] bg-zinc-900 font-mono px-1 py-0.5 rounded font-bold text-zinc-300 mt-1 border border-zinc-800">
                    {toast.llaveRelacionada}
                  </span>
                )}
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">{toast.mensaje}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
