import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickSuggestions({ suggestions, onSelect }) {
  return (
    <div className="w-full max-w-2xl space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="h-4 w-4" />
        <span>Quick suggestions:</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {suggestions.map((suggestion, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Button
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 px-4 glass-effect hover:border-primary transition-all group"
              onClick={() => onSelect(suggestion)}
            >
              <motion.div
                className="w-full overflow-hidden"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <p className="text-sm group-hover:text-primary transition-colors break-words whitespace-normal leading-snug">
                  {suggestion}
                </p>
              </motion.div>
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
