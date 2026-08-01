import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Aislar los tests: nunca tocar el Supabase real.
// isSupabaseConfigured=false hace que store/services usen solo estado en memoria.
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));
