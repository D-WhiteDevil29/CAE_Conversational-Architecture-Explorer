import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { motion } from 'framer-motion';
import {
  Database, Server, MessageSquare, Layers, ExternalLink,
  Globe, Layout, Package, Zap,
} from 'lucide-react';
import { NODE_TYPES, NODE_COLORS } from '@/config/constants';

const iconMap = {
  [NODE_TYPES.SERVICE]:  Server,
  [NODE_TYPES.API]:      Layers,
  [NODE_TYPES.DATABASE]: Database,
  [NODE_TYPES.QUEUE]:    MessageSquare,
  [NODE_TYPES.EXTERNAL]: ExternalLink,
  [NODE_TYPES.GATEWAY]:  Globe,
  [NODE_TYPES.FRONTEND]: Layout,
  [NODE_TYPES.MODULE]:   Package,
  [NODE_TYPES.CACHE]:    Zap,
};

export const CustomNode = memo(({ data, selected }) => {
  const Icon        = iconMap[data.type] || Server;
  const color       = data.color || NODE_COLORS[data.type] || '#667eea';
  const statusColor = data.status === 'active' ? '#10b981'
                    : data.status === 'inactive' ? '#6b7280'
                    : '#f59e0b';

  const techChips = Array.isArray(data.tech) ? data.tech.slice(0, 3) : [];

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="relative group"
    >
      <Handle type="target" position={Position.Top}    className="w-2.5 h-2.5 !bg-purple-500" />

      <div
        className={`
          rounded-xl border-2 glass-effect w-[210px]
          transition-all duration-200
          ${selected
            ? 'border-primary shadow-lg shadow-primary/20'
            : 'border-border/40 hover:border-border/70'}
        `}
      >
        {/* Glow when selected */}
        {selected && (
          <motion.div
            className="absolute inset-0 rounded-xl blur-xl -z-10"
            style={{ backgroundColor: color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
          />
        )}

        {/* Top stripe */}
        <div
          className="h-1 rounded-t-xl"
          style={{ backgroundColor: color }}
        />

        <div className="px-3 py-2.5 space-y-2">
          {/* Header row: icon + label + status */}
          <div className="flex items-start gap-2">
            <div
              className="p-1.5 rounded-lg flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${color}25` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-xs leading-tight truncate flex-1">
                  {data.label}
                </p>
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusColor }}
                  title={data.status}
                />
              </div>

              {/* Layer badge */}
              {data.layer && (
                <span
                  className="inline-block text-[9px] leading-tight px-1.5 py-0.5 rounded-full mt-0.5 font-medium"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {data.layer}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {data.description && (
            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
              {data.description}
            </p>
          )}

          {/* Tech chips */}
          {techChips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {techChips.map((t, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium border"
                  style={{
                    color,
                    borderColor: `${color}40`,
                    backgroundColor: `${color}12`,
                  }}
                >
                  {t}
                </span>
              ))}
              {Array.isArray(data.tech) && data.tech.length > 3 && (
                <span className="text-[9px] text-muted-foreground px-1">
                  +{data.tech.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer: type + owner */}
          <div className="flex items-center justify-between pt-0.5 border-t border-border/20">
            <span
              className="text-[9px] font-semibold uppercase tracking-wide"
              style={{ color }}
            >
              {data.type}
            </span>
            {data.owner && (
              <span className="text-[9px] text-muted-foreground truncate max-w-[100px]">
                {data.owner}
              </span>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-purple-500" />
    </motion.div>
  );
});

CustomNode.displayName = 'CustomNode';

