import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Users,
  Send,
  Filter,
  MoreVertical,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useValidation } from '@/contexts/ValidationContext';
import { useAuth } from '@/contexts/AuthContext';

const VALIDATION_STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  assigned: { label: 'Assigned', icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  in_review: { label: 'In Review', icon: Clock, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  approved: { label: 'Approved (All)', icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  rejected_r1: { label: 'Rejected (R1)', icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  rejected_r2: { label: 'Rejected (R2)', icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  rejected_r3: { label: 'Rejected (R3)', icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  ready_for_ingest: { label: 'Ready for Ingest', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-600/10' },
};

export function DocumentValidation() {
  const { validationQueue, assignReviewers, VALIDATION_STATES, deleteValidation } = useValidation();
  const { getAllUsers } = useAuth();
  const [selectedValidation, setSelectedValidation] = useState(null);
  const [reviewerEmails, setReviewerEmails] = useState(['', '', '']);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    try {
      const allUsers = getAllUsers();
      setUsers(allUsers.map((u) => u.email));
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }, [getAllUsers]);

  const handleAssignReviewers = (validationId) => {
    if (reviewerEmails.some((email) => !email)) {
      alert('Please select all 3 reviewers');
      return;
    }

    assignReviewers(validationId, reviewerEmails);
    setReviewerEmails(['', '', '']);
    setSelectedValidation(null);
  };

  const handleDeleteValidation = (validationId, documentName) => {
    if (window.confirm(`Delete "${documentName}" from the validation queue? This will also remove it from ingestion.`)) {
      deleteValidation(validationId);
    }
  };

  const filteredQueue = validationQueue.filter((item) => {
    const matchesSearch =
      item.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.feedback.r1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.feedback.r2?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.feedback.r3?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;

    // Per-reviewer filters
    if (filterStatus === 'r1_approved') return item.reviews.r1?.approved === true;
    if (filterStatus === 'r1_rejected') return item.reviews.r1?.approved === false;
    if (filterStatus === 'r1_pending') return item.reviewers.r1 && !item.reviews.r1;
    if (filterStatus === 'r2_approved') return item.reviews.r2?.approved === true;
    if (filterStatus === 'r2_rejected') return item.reviews.r2?.approved === false;
    if (filterStatus === 'r2_pending') return item.reviewers.r2 && !item.reviews.r2;
    if (filterStatus === 'r3_approved') return item.reviews.r3?.approved === true;
    if (filterStatus === 'r3_rejected') return item.reviews.r3?.approved === false;
    if (filterStatus === 'r3_pending') return item.reviewers.r3 && !item.reviews.r3;

    // Document-level status filters
    return item.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-purple-500" />
            Document Validation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {validationQueue.length} documents in validation queue
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </motion.div>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-effect border border-border/40 rounded-lg p-4 space-y-4"
      >
        <div className="flex gap-4 flex-wrap">
          <Input
            placeholder="Search documents or feedback..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-64"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-md bg-background border border-border text-sm"
          >
            <option value="all">All Status</option>
            <optgroup label="Document Status">
              {Object.entries(VALIDATION_STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="R1 — Syntax &amp; Format">
              <option value="r1_approved">R1 Approved</option>
              <option value="r1_rejected">R1 Rejected</option>
              <option value="r1_pending">R1 Pending</option>
            </optgroup>
            <optgroup label="R2 — Security">
              <option value="r2_approved">R2 Approved</option>
              <option value="r2_rejected">R2 Rejected</option>
              <option value="r2_pending">R2 Pending</option>
            </optgroup>
            <optgroup label="R3 — Accuracy">
              <option value="r3_approved">R3 Approved</option>
              <option value="r3_rejected">R3 Rejected</option>
              <option value="r3_pending">R3 Pending</option>
            </optgroup>
          </select>
          {filterStatus !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterStatus('all')}
              className="text-muted-foreground"
            >
              Clear filter ×
            </Button>
          )}
        </div>

        {/* Status Overview — clickable cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(VALIDATION_STATUS_CONFIG).map(([status, config]) => {
            const count = validationQueue.filter((v) => v.status === status).length;
            const isActive = filterStatus === status;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(isActive ? 'all' : status)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-border bg-secondary/50 hover:border-border/80 hover:bg-secondary/80'
                }`}
              >
                <p className="text-xs text-muted-foreground mb-1">{config.label}</p>
                <p className={`text-2xl font-bold ${isActive ? 'text-purple-400' : ''}`}>{count}</p>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Validation List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-effect border border-border/40 rounded-lg p-6"
      >
        <div className="space-y-4">
          {filteredQueue.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No documents to validate</p>
            </div>
          ) : (
            filteredQueue.map((item) => {
              const statusConfig = VALIDATION_STATUS_CONFIG[item.status];
              const Icon = statusConfig.icon;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border border-border/40 ${statusConfig.bgColor} hover:border-border/60 transition-all`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`h-5 w-5 ${statusConfig.color}`} />
                        <h3 className="font-semibold text-foreground">{item.documentName}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Reviewer Status */}
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        {Object.entries({ r1: 'Syntax & Format', r2: 'Security', r3: 'Accuracy' }).map(
                          ([level, label]) => {
                            const review = item.reviews[level];
                            const feedback = item.feedback[level];

                            return (
                              <div key={level} className="p-2 rounded bg-background/50 text-xs">
                                <p className="font-medium mb-1">{label}</p>
                                <p className="text-muted-foreground mb-1">
                                  {item.reviewers[level] ? `Assigned: ${item.reviewers[level]}` : 'Not assigned'}
                                </p>
                                {review ? (
                                  <div className="flex items-center gap-1">
                                    {review.approved ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                    <span className={review.approved ? 'text-green-500' : 'text-red-500'}>
                                      {review.approved ? 'Approved' : 'Rejected'}
                                    </span>
                                  </div>
                                ) : (
                                  <Clock className="h-4 w-4 text-yellow-500 inline" />
                                )}
                                {feedback && (
                                  <p className="text-muted-foreground mt-1 italic border-t border-border/40 pt-1">
                                    {feedback.substring(0, 50)}...
                                  </p>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedValidation(item.id)}
                        title="View / Assign reviewers"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {item.status === VALIDATION_STATES.PENDING && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedValidation(item.id);
                            setReviewerEmails(['', '', '']);
                          }}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteValidation(item.id, item.documentName)}
                        title="Delete from validation queue"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Reviewer Assignment Modal */}
      <AnimatePresence>
        {selectedValidation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedValidation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-lg border border-border p-6 max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4">Assign Reviewers</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Select 3 reviewers for document validation. Each reviewer will validate a different aspect.
              </p>

              <div className="space-y-4 mb-6">
                {[
                  { level: 0, label: 'Reviewer 1: Syntax & Format', desc: 'Validates document format and syntax errors' },
                  { level: 1, label: 'Reviewer 2: Security', desc: 'Checks for sensitive information exposure' },
                  { level: 2, label: 'Reviewer 3: Accuracy', desc: 'Validates data accuracy and correctness' },
                ].map(({ level, label, desc }) => (
                  <div key={level} className="space-y-2">
                    <label className="text-sm font-medium flex flex-col gap-1">
                      {label}
                      <span className="text-xs text-muted-foreground font-normal">{desc}</span>
                    </label>
                    <select
                      value={reviewerEmails[level]}
                      onChange={(e) => {
                        const newEmails = [...reviewerEmails];
                        newEmails[level] = e.target.value;
                        setReviewerEmails(newEmails);
                      }}
                      className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm"
                    >
                      <option value="">Select reviewer...</option>
                      {users
                        .filter((email) => !reviewerEmails.includes(email) || reviewerEmails[level] === email)
                        .map((email) => (
                          <option key={email} value={email}>
                            {email}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleAssignReviewers(selectedValidation)}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Assign & Notify Reviewers
                </Button>
                <Button variant="ghost" onClick={() => setSelectedValidation(null)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
