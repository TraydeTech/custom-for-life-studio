import { resetCartStorage } from '@/test/cartStorage';
import { beforeEach, expect, it, vi } from 'vitest';
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ upsert }) } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
import { syncGuestCartToSupabase } from './useCart';
import { getGuestCart, saveGuestCart } from '@/lib/guestCart';
const row = { id: 'guest-id', product_id: 'mug', product_color: 'Azul', quantity: 2,
  customization_notes: 'Frente', engraving_text: 'Ana', engraving_position_x: 50,
  engraving_position_y: 72, engraving_preview_image: 'data:preview', engraving_file_url: 'https://example.com/art.pdf' };
beforeEach(() => { resetCartStorage(); vi.clearAllMocks(); });
it('preserva todos os dados e só limpa depois de confirmação do banco', async () => {
  saveGuestCart([row]);
  upsert.mockResolvedValueOnce({ error: { message: 'offline' } });
  await expect(syncGuestCartToSupabase('customer')).rejects.toMatchObject({ message: 'offline' });
  expect(getGuestCart()).toEqual([row]);
  upsert.mockResolvedValueOnce({ error: null });
  await syncGuestCartToSupabase('customer');
  expect(upsert).toHaveBeenLastCalledWith([{ ...row, user_id: 'customer' }], { onConflict: 'id', ignoreDuplicates: true });
  expect(getGuestCart()).toEqual([]);
});
it('compartilha a sincronização concorrente disparada pelo login', async () => {
  saveGuestCart([row]);
  let complete!: (value: { error: null }) => void;
  upsert.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  const first = syncGuestCartToSupabase('customer');
  const second = syncGuestCartToSupabase('customer');
  expect(first).toBe(second);
  complete({ error: null });
  await first;
  expect(upsert).toHaveBeenCalledTimes(1);
});
