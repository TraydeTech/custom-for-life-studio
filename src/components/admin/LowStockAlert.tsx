import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLowStockProducts, useLowStockCount } from '@/hooks/useLowStockProducts';
import { cn } from '@/lib/utils';

export function LowStockAlert() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { data: products, isLoading } = useLowStockProducts();
  const { criticalCount, totalCount } = useLowStockCount();

  if (isLoading || totalCount === 0 || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Alert Banner */}
      <div className={cn(
        "rounded-lg p-4 flex items-center gap-4",
        criticalCount > 0 
          ? "bg-destructive/10 border border-destructive/20" 
          : "bg-warning/10 border border-warning/20"
      )}>
        <div className={cn(
          "p-2 rounded-full",
          criticalCount > 0 ? "bg-destructive/20" : "bg-warning/20"
        )}>
          <AlertTriangle className={cn(
            "h-5 w-5",
            criticalCount > 0 ? "text-destructive" : "text-warning"
          )} />
        </div>
        
        <div className="flex-1">
          <p className="font-medium">
            {criticalCount > 0 
              ? `${criticalCount} produto${criticalCount > 1 ? 's' : ''} com estoque crítico!`
              : `${totalCount} produto${totalCount > 1 ? 's' : ''} com estoque baixo`
            }
          </p>
          <p className="text-sm text-muted-foreground">
            Considere reabastecer para evitar ruptura de estoque
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            Ver produtos
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Modal with product list */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Produtos com Estoque Baixo
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {products?.map((product) => (
                <div 
                  key={product.id} 
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    product.stockLevel === 'critical' 
                      ? "border-destructive/30 bg-destructive/5" 
                      : "border-warning/30 bg-warning/5"
                  )}
                >
                  {product.images?.[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      SKU: {product.slug}
                    </p>
                  </div>

                  <div className="text-right">
                    <Badge 
                      variant="outline"
                      className={cn(
                        "font-bold",
                        product.stockLevel === 'critical'
                          ? "border-destructive text-destructive"
                          : "border-warning text-warning"
                      )}
                    >
                      {product.stock} un.
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {product.stockLevel === 'critical' ? 'Crítico' : 'Baixo'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
            <Button asChild>
              <Link to="/admin/produtos" onClick={() => setIsOpen(false)}>
                Gerenciar Produtos
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
