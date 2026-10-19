import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, MessageSquare, Eye, ArrowLeft, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useValidation } from '@/contexts/ValidationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export function ReviewsPanel() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { getAssignedReviews, submitReview, getReviewerStats, validationQueue, deleteValidation } = useValidation();
  const [selectedReview, setSelectedReview] = useState(null);
  const [isApproving, setIsApproving] = useState(null);
  const [feedback, setFeedback] = useState('');

  if (!user) return null;

  // Get reviews assigned to this specific user - directly from validationQueue
  const assignedReviews = validationQueue.filter(
    (item) =>
      item.reviewers.r1 === user.email ||
      item.reviewers.r2 === user.email ||
      item.reviewers.r3 === user.email
  );
  const stats = getReviewerStats(user.email);

  // Find which level this user is assigned to for each review
  const getReviewLevel = (reviewItem) => {
    if (reviewItem.reviewers.r1 === user.email) return 'r1';
    if (reviewItem.reviewers.r2 === user.email) return 'r2';
    if (reviewItem.reviewers.r3 === user.email) return 'r3';
    return null;
  };

  const reviewLevelConfig = {
    r1: { label: 'Syntax & Format Reviewer', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    r2: { label: 'Security Reviewer', color: 'text-red-500', bg: 'bg-red-500/10' },
    r3: { label: 'Accuracy Reviewer', color: 'text-green-500', bg: 'bg-green-500/10' },
  };

  const handleSubmitReview = (validationId, approved) => {
    if (!approved && !feedback.trim()) {
      toast.error('Please provide a reason for rejection before submitting.');
      return;
    }

    const reviewLevel = getReviewLevel(assignedReviews.find((r) => r.id === validationId));
    
    submitReview(validationId, user.email, reviewLevel, approved, feedback);
    
    toast.success(
      `Review submitted: ${approved ? 'Approved' : 'Rejected'}`,
      { duration: 3000 }
    );
    
    setSelectedReview(null);
    setFeedback('');
    setIsApproving(null);
  };

  const handleDeleteReview = (validationId) => {
    if (window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      deleteValidation(validationId);
      toast.success('Review deleted successfully');
    }
  };

  if (assignedReviews.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-effect border border-border/40 rounded-lg p-8 text-center"
      >
        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Documents to Review</h3>
        <p className="text-sm text-muted-foreground">
          You don't have any documents assigned for review yet. Check back later!
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-4"
      >
        <div className="glass-effect border border-border/40 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Assigned</p>
          <p className="text-3xl font-bold">{stats.assigned}</p>
        </div>
        <div className="glass-effect border border-border/40 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-500">{stats.completed}</p>
        </div>
        <div className="glass-effect border border-border/40 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-3xl font-bold text-yellow-500">{stats.pending}</p>
        </div>
      </motion.div>

      {/* Reviews List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {selectedReview === null ? (
          // List View
          <div className="space-y-4">
            {assignedReviews.map((item) => {
              const reviewLevel = getReviewLevel(item);
              const config = reviewLevelConfig[reviewLevel];
              const review = item.reviews[reviewLevel];

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-effect border border-border/40 rounded-lg p-4 hover:border-border/60 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{item.documentName}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Submitted on {new Date(item.submittedAt).toLocaleDateString()}
                      </p>

                      {review ? (
                        <div className="flex items-center gap-2">
                          {review.approved ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className={review.approved ? 'text-green-500' : 'text-red-500'}>
                            {review.approved ? 'Approved' : 'Rejected'} on{' '}
                            {new Date(review.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-yellow-500 text-sm flex items-center gap-1">
                          ⏳ Pending your review
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {!review && (
                        <Button
                          size="sm"
                          onClick={() => setSelectedReview(item.id)}
                          className="whitespace-nowrap"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Review Now
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteReview(item.id)}
                          className="whitespace-nowrap"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          // Review Mode
          <AnimatePresence>
            <motion.div
              key="review-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-effect border border-border/40 rounded-lg p-6 space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedReview(null);
                    setFeedback('');
                    setIsApproving(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-bold">Review Document</h2>
              </div>

              {(() => {
                const item = assignedReviews.find((r) => r.id === selectedReview);
                const reviewLevel = getReviewLevel(item);
                const config = reviewLevelConfig[reviewLevel];

                return (
                  <div className="space-y-6">
                    <div className="border-b border-border/40 pb-4">
                      <h3 className="font-semibold mb-2">{item.documentName}</h3>
                      <p className={`text-sm p-2 rounded ${config.bg} ${config.color} inline-block`}>
                        {config.label}
                      </p>
                    </div>

                    {/* Document Preview */}
                    {item.documentFileDataUrl ? (
                      <div className="rounded-lg overflow-hidden border border-border/40">
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 border-b border-border/40">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.documentName}</span>
                        </div>
                        {item.documentFileType === 'application/pdf' ? (
                          <iframe
                            src={item.documentFileDataUrl}
                            className="w-full"
                            style={{ height: '480px' }}
                            title={item.documentName}
                          />
                        ) : (
                          <div className="bg-background/50 p-4 max-h-96 overflow-y-auto">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {item.documentContent}
                            </p>
                            <a
                              href={item.documentFileDataUrl}
                              download={item.documentName}
                              className="mt-3 inline-flex items-center gap-2 text-sm text-purple-500 hover:text-purple-400 underline"
                            >
                              <FileText className="h-4 w-4" />
                              Download original file
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-background/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <h4 className="font-semibold mb-2 text-sm">Document Content</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {item.documentContent}
                        </p>
                      </div>
                    )}

                    {/* Review Criteria */}
                    <div className="bg-background/50 rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold mb-3">Review Checklist</h4>
                      {reviewLevel === 'r1' && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Check for syntax errors and format consistency</label>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Verify all required fields are present</label>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Ensure proper document structure</label>
                          </div>
                        </div>
                      )}
                      {reviewLevel === 'r2' && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Check for exposed sensitive information (passwords, keys, etc)</label>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Verify no PII (Personal Identifiable Information) is exposed</label>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Check compliance with data protection policies</label>
                          </div>
                        </div>
                      )}
                      {reviewLevel === 'r3' && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Verify data accuracy and correctness</label>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Confirm all information aligns with actual architecture</label>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <label>Check if domain-specific details are accurate</label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Feedback */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Your Feedback
                        <span className="ml-1 text-xs text-red-400 font-normal">(required for rejection)</span>
                      </label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Provide detailed feedback or reasons for your decision..."
                        className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleSubmitReview(selectedReview, true)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleSubmitReview(selectedReview, false)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}
