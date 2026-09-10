import { create } from 'zustand';
import { fetchClientes, fetchCiudades, fetchTransportadoras } from '../services/catalogosService';
import { isSupabaseConfigured } from '../lib/supabase';
import { initialClientes, initialCiudades, initialTransportadoras } from './initialData';
import type { Cliente, Ciudad, Transportadora } from '../types';

interface CatalogosState {
  initialized: boolean;
  clientes: Cliente[];
  ciudades: Ciudad[];
  transportadoras: Transportadora[];
  initialize: () => Promise<void>;
}

export const useCatalogosStore = create<CatalogosState>((set, get) => ({
  initialized: false,
  clientes: initialClientes,
  ciudades: initialCiudades,
  transportadoras: initialTransportadoras,

  initialize: async () => {
    if (get().initialized) return;
    if (!isSupabaseConfigured) {
      set({ initialized: true });
      return;
    }
    try {
      const [clientes, ciudades, transportadoras] = await Promise.all([
        fetchClientes(),
        fetchCiudades(),
        fetchTransportadoras(),
      ]);
      set({ clientes, ciudades, transportadoras, initialized: true });
    } catch (err) {
      console.error('Error loading catalogos:', err);
      set({ initialized: true });
    }
  },
}));
