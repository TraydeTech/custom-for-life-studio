import { forwardRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tables } from '@/integrations/supabase/types';

type Order = Tables<'orders'>;
type OrderItem = Tables<'order_items'>;

interface OrderReceiptProps {
  order: Order;
  items: OrderItem[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatAddress = (address: unknown) => {
  if (!address || typeof address !== 'object') return 'Não informado';
  const addr = address as Record<string, string>;
  return `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ''}, ${addr.neighborhood}, ${addr.city} - ${addr.state}, ${addr.zip_code}`;
};

export const OrderReceipt = forwardRef<HTMLDivElement, OrderReceiptProps>(
  ({ order, items }, ref) => {
    return (
      <div ref={ref} className="p-8 bg-white text-black min-w-[300px] max-w-[400px] mx-auto font-mono text-sm">
        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
          <h1 className="text-xl font-bold mb-1">CUSTOM FOR LIFE</h1>
          <p className="text-xs text-gray-600">Brindes Personalizados</p>
          <p className="text-xs text-gray-600 mt-2">CNPJ: 00.000.000/0001-00</p>
        </div>

        {/* Order Info */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <div className="flex justify-between">
            <span className="font-bold">Pedido:</span>
            <span>{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Data:</span>
            <span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Origem:</span>
            <span>{order.source === 'pdv' ? 'LOJA' : 'SITE'}</span>
          </div>
          {order.payment_method && (
            <div className="flex justify-between">
              <span className="font-bold">Pagamento:</span>
              <span className="uppercase">{order.payment_method}</span>
            </div>
          )}
        </div>

        {/* Customer/Address */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <p className="font-bold mb-1">Entrega:</p>
          <p className="text-xs leading-relaxed">{formatAddress(order.shipping_address)}</p>
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <p className="font-bold mb-2">ITENS:</p>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs">
                <div className="flex-1 pr-2">
                  <p className="truncate">{item.product_name}</p>
                  <p className="text-gray-600">{item.quantity}x {formatCurrency(item.unit_price)}</p>
                </div>
                <span className="font-medium whitespace-nowrap">{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-xs">
            <span>Subtotal:</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Frete:</span>
            <span>{formatCurrency(order.shipping_cost || 0)}</span>
          </div>
          {order.discount && order.discount > 0 && (
            <div className="flex justify-between text-xs text-green-700">
              <span>Desconto:</span>
              <span>-{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-400">
            <span>TOTAL:</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="border-t border-dashed border-gray-400 pt-3 mb-4">
            <p className="font-bold text-xs">Obs:</p>
            <p className="text-xs text-gray-600">{order.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center border-t-2 border-dashed border-gray-400 pt-4">
          <p className="text-xs text-gray-600 mb-2">Obrigado pela preferência!</p>
          <p className="text-xs text-gray-500">www.customforlife.com.br</p>
          <p className="text-xs text-gray-400 mt-2">
            {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
    );
  }
);

OrderReceipt.displayName = 'OrderReceipt';
