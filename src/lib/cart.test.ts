import { resetCartStorage } from '@/test/cartStorage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canMergeCartItems, selectedCartProduct } from './cart';
import { addGuestCartItem, getGuestCart, saveGuestCart } from './guestCart';

const item = (color: string) => ({ product_id: 'mug', product_color: color, quantity: 1,
  customization_notes: null, engraving_text: null, engraving_position_x: null,
  engraving_position_y: null, engraving_preview_image: null, engraving_file_url: null });

beforeEach(resetCartStorage);
describe('carrinho por cor e personalização', () => {
  it('separa duas cores e soma somente a mesma configuração simples', () => {
    addGuestCartItem(item('Vermelha'));
    addGuestCartItem(item('Azul'));
    addGuestCartItem(item('Azul'));
    expect(getGuestCart().map(row => [row.product_color, row.quantity])).toEqual([['Vermelha', 1], ['Azul', 2]]);
  });
  it('não junta arte, prévia ou texto personalizado com um item simples', () => {
    for (const fields of [{ engraving_file_url: 'https://example.com/logo.pdf' },
      { engraving_text: 'Ana' }, { customization_notes: 'Frente' }, { engraving_preview_image: 'data:image/png;base64,abc' }]) {
      expect(canMergeCartItems(item('Azul'), { ...item('Azul'), ...fields })).toBe(false);
      expect(canMergeCartItems({ ...item('Azul'), ...fields }, item('Azul'))).toBe(false);
    }
  });
  it('usa imagem e estoque da cor, inclusive estoque zero', () => {
    const product = { stock: 99, images: ['default'], product_variants: [
      { color_name: 'Azul', stock: 0, main_image: 'blue' }, { color_name: 'Vermelha', stock: 4, main_image: 'red' },
    ] };
    expect(selectedCartProduct(product, 'Azul')).toMatchObject({ stock: 0, images: ['blue'] });
    expect(selectedCartProduct(product, 'Vermelha').stock).toBe(4);
    expect(selectedCartProduct(product, 'Cor removida').stock).toBe(0);
  });
  it('não finge salvar quando o navegador rejeita a gravação', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => saveGuestCart([])).toThrow('Não foi possível salvar');
  });
});
