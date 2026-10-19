import { motion } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const mockResults = [
  {
    id: 1,
    title: 'ECOM Billing Service',
    type: 'Service',
    owner: 'Team Alpha',
    description: 'Core billing service for ECOM platform',
  },
  {
    id: 2,
    title: 'Kenan API Gateway',
    type: 'API',
    owner: 'Team Beta',
    description: 'Main API gateway for Kenan services',
  },
  {
    id: 3,
    title: 'ESOM Authentication',
    type: 'Service',
    owner: 'Team Gamma',
    description: 'Authentication and authorization service',
  },
];

export function SearchPanel({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = (value) => {
    setQuery(value);
    if (value.length > 2) {
      setResults(mockResults);
    } else {
      setResults([]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: -20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: -20 }}
        className="w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="glass-effect border-border/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search services, APIs, deployments..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1 bg-secondary/50"
              />
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar"
              >
                {results.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto py-3 px-4 glass-effect hover:border-primary"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{result.title}</p>
                          <Badge variant="outline">{result.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {result.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Owner: {result.owner}
                        </p>
                      </div>
                    </Button>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {query.length > 2 && results.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No results found for "{query}"
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
