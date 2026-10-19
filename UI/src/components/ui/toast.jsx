import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  XCircle, 
  X,
  Sparkles,
  Globe,
  Lock,
  Zap
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

const typeConfig = {
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/10 border-blue-500/40',
    iconClass: 'text-blue-500',
    titleClass: 'text-blue-400',
  },
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-green-500/10 border-green-500/40',
    iconClass: 'text-green-500',
    titleClass: 'text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-yellow-500/10 border-yellow-500/40',
    iconClass: 'text-yellow-500',
    titleClass: 'text-yellow-400',
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-500/10 border-red-500/40',
    iconClass: 'text-red-500',
    titleClass: 'text-red-400',
  },
};

// Special icons for specific modes
const customIcons = {
  hybrid: Globe,
  contextOnly: Lock,
  mock: Sparkles,
  real: Zap,
};

function Toast({ toast }) {
  const { removeToast } = useToast();
  const config = typeConfig[toast.type] || typeConfig.info;
  
  // Use custom icon if provided, otherwise use type icon
  const IconComponent = toast.iconType && customIcons[toast.iconType] 
    ? customIcons[toast.iconType]
    : config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`
        relative w-full max-w-md p-4 rounded-lg border glass-effect
        ${config.bgClass}
        shadow-lg backdrop-blur-md
      `}
    >
      {/* Glow effect */}
      <motion.div
        className={`absolute inset-0 rounded-lg blur-xl -z-10 ${config.bgClass}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
      />

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${config.iconClass}`}>
          <IconComponent className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={`font-semibold text-sm mb-1 ${config.titleClass}`}>
              {toast.title}
            </p>
          )}
          <p className="text-sm text-foreground/90 whitespace-pre-line">
            {toast.message}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={() => removeToast(toast.id)}
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4 text-foreground/60" />
        </button>
      </div>

      {/* Progress bar (optional) */}
      {toast.duration > 0 && (
        <motion.div
          className={`absolute bottom-0 left-0 h-1 ${config.iconClass} bg-current rounded-b-lg`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
