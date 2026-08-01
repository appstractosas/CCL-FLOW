import { create } from 'zustand';
import { fetchClientes, fetchCiudades } from '../services/catalogosService';
import { isSupabaseConfigured } from '../lib/supabase';
import { initialClientes, initialCiudades } from './initialData';
import type { Cliente, Ciudad } from '../types';

interface CatalogosState {
  initialized: boolean;
  clientes: Cliente[];
  ciudades: Ciudad[];
  initialize: () => Promise<void>;
}

export const useCatalogosStore = create<CatalogosState>((set, get) => ({
  initialized: false,
  clientes: initialClientes,
  ciudades: initialCiudades,

  initialize: async () => {
    if (get().initialized) return;
    if (!isSupabaseConfigured) {
      set({ initialized: true });
      return;
    }
    try {
      const [clientes, ciudades] = await Promise.all([fetchClientes(), fetchCiudades()]);
      set({ clientes, ciudades, initialized: true });
    } catch (err) {
      console.error('Error loading catalogos:', err);
      set({ initialized: true });
    }
  },
}));
