import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, Info, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconMap = {
  danger: { Icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  warning: { Icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  info: { Icon: Info, color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  success: { Icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  delete: { Icon: Trash2, color: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Ação',
  message = 'Você tem certeza que deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger', // 'danger', 'warning', 'info', 'success', 'delete'
  loading = false,
}) => {
  const { Icon, color, bg, border } = iconMap[variant] || iconMap.danger;

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="bg-card text-foreground rounded-xl shadow-2xl w-full max-w-md border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com Ícone */}
            <div className="p-6 pb-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${bg} border ${border} flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-8 w-8"
                  onClick={onClose}
                  disabled={loading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Footer com Botões */}
            <div className="px-6 py-4 bg-muted/30 rounded-b-xl flex gap-3 justify-end border-t">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="min-w-[100px]"
              >
                {cancelText}
              </Button>
              <Button
                variant={variant === 'danger' || variant === 'delete' ? 'destructive' : 'default'}
                onClick={handleConfirm}
                disabled={loading}
                className="min-w-[100px]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                    />
                    Processando...
                  </span>
                ) : (
                  confirmText
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
