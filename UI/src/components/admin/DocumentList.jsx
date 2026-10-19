import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Trash2,
  RefreshCw,
  Search,
  Database,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileJson,
  Calendar,
  Tag,
  Clock,
  ArrowRight,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useValidation } from '@/contexts/ValidationContext';
import { useToast } from '@/contexts/ToastContext';
import api from '@/services/api';

export function DocumentList({ onNavigateToValidation }) {
  const [documents, setDocuments] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [forceRemovingIds, setForceRemovingIds] = useState(new Set());
  const { validationQueue, VALIDATION_STATES } = useValidation();
  const { showToast } = useToast();

  const getValidationStatus = (documentName, uploadedAt) => {
    if (uploadedAt) {
      const doc = validationQueue.find(
        v => v.documentName === documentName && v.uploadedAt === uploadedAt
      );
      return doc;
    }
    const doc = validationQueue.find(v => v.documentName === documentName);
    return doc;
  };

  const getStatusColor = (status) => {
    const colors = {
      [VALIDATION_STATES.PENDING]: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      [VALIDATION_STATES.ASSIGNED]: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      [VALIDATION_STATES.IN_REVIEW]: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      [VALIDATION_STATES.REJECTED_R1]: 'bg-red-500/10 text-red-500 border-red-500/20',
      [VALIDATION_STATES.REJECTED_R2]: 'bg-red-500/10 text-red-500 border-red-500/20',
      [VALIDATION_STATES.REJECTED_R3]: 'bg-red-500/10 text-red-500 border-red-500/20',
      [VALIDATION_STATES.APPROVED]: 'bg-green-500/10 text-green-500 border-green-500/20',
      [VALIDATION_STATES.READY_FOR_INGEST]: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    // Filter documents based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = documents.filter(
        (doc) =>
          doc.title?.toLowerCase().includes(query) ||
          doc.source?.toLowerCase().includes(query) ||
          doc.type?.toLowerCase().includes(query) ||
          doc.content?.toLowerCase().includes(query)
      );
      setFilteredDocs(filtered);
    } else {
      setFilteredDocs(documents);
    }
  }, [searchQuery, documents]);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.get('/api/documents');
      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError(err.response?.data?.error || 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (documentId, documentTitle) => {
    if (!confirm(`Are you sure you want to delete "${documentTitle}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeletingIds(new Set([...deletingIds, documentId]));
    setError('');
    setSuccess('');

    try {
      await api.delete(`/api/documents/${documentId}`);
      setSuccess(`Document "${documentTitle}" deleted successfully`);
      
      // Remove from local state
      setDocuments(documents.filter((doc) => doc.id !== documentId));
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err.response?.data?.error || 'Failed to delete document');
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const handleForceRemove = async (documentId, documentTitle) => {
    if (!confirm(`This will DELETE the document and UNDO ingestion.\n\nDocuments: "${documentTitle}"\n\nThe document will be removed from the RAG model. This action cannot be undone.`)) {
      return;
    }

    setForceRemovingIds(new Set([...forceRemovingIds, documentId]));
    setError('');
    setSuccess('');

    try {
      await api.delete(`/api/documents/${documentId}/force-remove`);
      showToast('success', `Document ingestion undone. RAG will reinitialize on next query.`);
      
      // Remove from local state
      setDocuments(documents.filter((doc) => doc.id !== documentId));
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error force removing document:', err);
      const errorMsg = err.response?.data?.details || err.response?.data?.error || 'Failed to remove document ingestion';
      showToast('error', errorMsg);
    } finally {
      setForceRemovingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const getSourceColor = (source) => {
    const colors = {
      jira: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      confluence: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      bamboo: 'bg-green-500/10 text-green-500 border-green-500/20',
      uploaded: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    };
    return colors[source] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-500" />
            Ingested Documents
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all documents in the knowledge base
          </p>
        </div>

        <Button
          onClick={loadDocuments}
          disabled={isLoading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-lg bg-red-500/10 border border-red-500/40 text-red-500 flex items-start gap-2"
          >
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <span className="text-sm">{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-lg bg-green-500/10 border border-green-500/40 text-green-500 flex items-start gap-2"
          >
            <CheckCircle className="h-5 w-5 mt-0.5" />
            <span className="text-sm">{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents by title, source, type, or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-effect border border-border/40 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{documents.length}</p>
              <p className="text-xs text-muted-foreground">Total Documents</p>
            </div>
          </div>
        </div>

        <div className="glass-effect border border-border/40 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Database className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Set(documents.map((d) => d.source)).size}
              </p>
              <p className="text-xs text-muted-foreground">Data Sources</p>
            </div>
          </div>
        </div>

        <div className="glass-effect border border-border/40 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <FileJson className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filteredDocs.length}</p>
              <p className="text-xs text-muted-foreground">Filtered Results</p>
            </div>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect border border-border/40 rounded-xl overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">
              {searchQuery ? 'No documents match your search' : 'No documents found'}
            </p>
            {!searchQuery && (
              <p className="text-xs mt-2">Upload documents or run ingestion to add data</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filteredDocs.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="p-4 hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title and Source */}
                    <div className="flex items-start gap-2 mb-2">
                      <FileText className="h-4 w-4 text-purple-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{doc.title}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${getSourceColor(
                              doc.source
                            )}`}
                          >
                            {doc.source}
                          </span>
                          {doc.type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20">
                              {doc.type}
                            </span>
                          )}
                          {/* Validation Status Badge */}
                          {doc.source === 'uploaded' && getValidationStatus(doc.title, doc.metadata?.uploadedAt) && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(getValidationStatus(doc.title, doc.metadata?.uploadedAt).status)}`}>
                              {getValidationStatus(doc.title, doc.metadata?.uploadedAt).status.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content Preview */}
                    {doc.content && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {doc.content}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {doc.metadata?.uploadedAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(doc.metadata.uploadedAt)}
                        </div>
                      )}
                      {doc.sourceId && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {doc.sourceId}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {doc.source === 'uploaded' && getValidationStatus(doc.title, doc.metadata?.uploadedAt) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onNavigateToValidation}
                          className="h-8 px-2 text-xs text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 shrink-0 gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          <span className="hidden sm:inline">Validation</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                        {/* Force Remove Button - for approved docs not yet ingested */}
                        {getValidationStatus(doc.title, doc.metadata?.uploadedAt).status === VALIDATION_STATES.APPROVED && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleForceRemove(doc.id, doc.title)}
                            disabled={forceRemovingIds.has(doc.id)}
                            title="Remove document and undo ingestion"
                            className="h-8 px-3 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 shrink-0"
                          >
                            {forceRemovingIds.has(doc.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Undo2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id, doc.title)}
                      disabled={deletingIds.has(doc.id)}
                      className="h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                    >
                      {deletingIds.has(doc.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
