import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImagePlus,
  X,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function validateFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Only PNG and JPG images are supported.';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Image must be under 20 MB.';
  }
  return null;
}

export function ArchitectureImageUpload({ onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState(null); // null | 'uploading' | 'success' | 'error'
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [ingested, setIngested] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [viewingImg, setViewingImg] = useState(null); // img entry being viewed
  const fileInputRef = useRef(null);

  // Load previously ingested architecture images
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/architecture-images');
        setIngested(res.data.images || []);
      } catch {
        setIngested([]);
      } finally {
        setLoadingList(false);
      }
    };
    load();
  }, [status]);

  const handleFile = useCallback((file) => {
    const err = validateFile(file);
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg('');
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setLabel('');
    setErrorMsg('');
    setStatus(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStatus('uploading');
    setErrorMsg('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('label', label.trim() || selectedFile.name);

      const response = await api.post('/api/upload-architecture-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });

      setStatus('success');
      setResult(response.data);
      setSelectedFile(null);
      setPreview(null);
      setLabel('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploadComplete?.();
    } catch (err) {
      setStatus('error');
      const detail = err.response?.data?.details || err.response?.data?.error || err.message;
      setErrorMsg(detail || 'Upload failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this architecture image from the knowledge base?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/architecture-images/${id}`);
      setIngested(prev => prev.filter(img => img.id !== id));
      if (viewingImg?.id === id) setViewingImg(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone — only shown when no file is selected */}
      {!selectedFile && status !== 'success' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
            isDragging
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-border/40 hover:border-purple-500/50 hover:bg-accent/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
          <ImagePlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium mb-1">Drop architecture diagram here</p>
          <p className="text-sm text-muted-foreground">PNG or JPG, up to 20 MB</p>
          {errorMsg && (
            <p className="mt-3 text-sm text-red-500 flex items-center justify-center gap-1">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errorMsg}
            </p>
          )}
        </div>
      )}

      {/* Selected file preview and upload controls */}
      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-border/40 rounded-xl p-4 space-y-4"
        >
          <div className="flex items-start gap-4">
            <img
              src={preview}
              alt="preview"
              className="w-32 h-24 object-cover rounded-lg border border-border/40 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
              <Input
                className="mt-3 h-9 text-sm"
                placeholder="Diagram label (e.g. ECOM Front End Architecture v2)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={status === 'uploading'}
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 flex-shrink-0"
              onClick={clearSelection}
              disabled={status === 'uploading'}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={status === 'uploading'}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {status === 'uploading' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing with Qwen Vision...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Ingest Architecture Image
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={clearSelection} disabled={status === 'uploading'}>
              Cancel
            </Button>
          </div>

          {status === 'uploading' && (
            <p className="text-xs text-muted-foreground text-center">
              Qwen2.5-VL is reading the diagram. This may take 1-2 minutes on first run.
            </p>
          )}

          {status === 'error' && errorMsg && (
            <div className="text-sm text-red-500 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Extraction result */}
      <AnimatePresence>
        {status === 'success' && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-green-500/30 bg-green-500/5 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">Architecture ingested successfully</span>
            </div>

            {result.description && (
              <p className="text-sm text-muted-foreground">{result.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {result.components?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    Components ({result.components.length})
                  </p>
                  <ul className="space-y-1">
                    {result.components.slice(0, 8).map((c, i) => (
                      <li key={i} className="text-xs flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">({c.type})</span>
                      </li>
                    ))}
                    {result.components.length > 8 && (
                      <li className="text-xs text-muted-foreground pl-3.5">
                        +{result.components.length - 8} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {result.relationships?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    Relationships ({result.relationships.length})
                  </p>
                  <ul className="space-y-1">
                    {result.relationships.slice(0, 8).map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground truncate">
                        {r.from} {'->'} {r.to}
                      </li>
                    ))}
                    {result.relationships.length > 8 && (
                      <li className="text-xs text-muted-foreground">
                        +{result.relationships.length - 8} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatus(null)}
              className="text-muted-foreground"
            >
              Upload another diagram
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Already-ingested architecture images list */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Ingested Architecture Diagrams
        </h3>
        {loadingList ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </p>
        ) : ingested.length === 0 ? (
          <p className="text-sm text-muted-foreground">No architecture images ingested yet.</p>
        ) : (
          <div className="space-y-3">
            {ingested.map((img) => (
              <div key={img.id}>
                <div className="border border-border/40 rounded-lg p-3 flex items-start gap-3">
                  <ImagePlus className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{img.label}</p>
                    {img.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {img.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {img.components?.length || 0} components &middot;{' '}
                      {img.relationships?.length || 0} relationships &middot;{' '}
                      {new Date(img.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-purple-500"
                      title="View details"
                      onClick={() => setViewingImg(viewingImg?.id === img.id ? null : img)}
                    >
                      {viewingImg?.id === img.id ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      title="Delete"
                      onClick={() => handleDelete(img.id)}
                      disabled={deletingId === img.id}
                    >
                      {deletingId === img.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Inline detail panel */}
                <AnimatePresence>
                  {viewingImg?.id === img.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border border-t-0 border-border/40 rounded-b-lg p-4 bg-accent/5 space-y-4">
                        {img.description && (
                          <p className="text-sm text-muted-foreground">{img.description}</p>
                        )}
                        {img.layers?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Layers</p>
                            <div className="flex flex-wrap gap-1">
                              {img.layers.map((l, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">{l}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {img.components?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                Components ({img.components.length})
                              </p>
                              <ul className="space-y-1 max-h-48 overflow-y-auto">
                                {img.components.map((c, i) => (
                                  <li key={i} className="text-xs flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                                    <span className="font-medium">{c.name}</span>
                                    <span className="text-muted-foreground">({c.type})</span>
                                    {c.layer && <span className="text-muted-foreground/60 text-[10px]">[{c.layer}]</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {img.relationships?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                                Relationships ({img.relationships.length})
                              </p>
                              <ul className="space-y-1 max-h-48 overflow-y-auto">
                                {img.relationships.map((r, i) => (
                                  <li key={i} className="text-xs text-muted-foreground truncate">
                                    <span className="text-foreground font-medium">{r.from}</span>
                                    {' → '}
                                    <span className="text-foreground font-medium">{r.to}</span>
                                    {r.label && <span className="ml-1 text-muted-foreground/60">({r.label})</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
