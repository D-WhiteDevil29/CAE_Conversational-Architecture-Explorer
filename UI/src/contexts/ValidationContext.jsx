import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { generateId } from '@/utils/helpers';

const ValidationContext = createContext(null);

const VALIDATION_STATES = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_REVIEW: 'in_review',
  REJECTED_R1: 'rejected_r1',
  REJECTED_R2: 'rejected_r2',
  REJECTED_R3: 'rejected_r3',
  APPROVED: 'approved',
  READY_FOR_INGEST: 'ready_for_ingest',
};

export function ValidationProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [validationQueue, setValidationQueue] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const getStorageKey = useCallback(() => {
    return 'cae_document_validations';
  }, []);

  const getReviewsKey = useCallback((userId) => {
    return `cae_reviews_${userId}`;
  }, []);

  // Load validation queue on mount
  useEffect(() => {
    const storageKey = getStorageKey();
    const storedQueue = localStorage.getItem(storageKey);
    
    if (storedQueue) {
      try {
        const parsed = JSON.parse(storedQueue);
        setValidationQueue(parsed);
      } catch (err) {
        console.error('Error loading validation queue:', err);
        setValidationQueue([]);
      }
    }

    // Load my reviews if user exists
    if (user) {
      const reviewsKey = getReviewsKey(user.id);
      const storedReviews = localStorage.getItem(reviewsKey);
      
      if (storedReviews) {
        try {
          const parsed = JSON.parse(storedReviews);
          setMyReviews(parsed);
        } catch (err) {
          console.error('Error loading my reviews:', err);
          setMyReviews([]);
        }
      }
    }

    setIsLoaded(true);
  }, [getStorageKey, getReviewsKey, user]);

  // Save validation queue
  useEffect(() => {
    if (isLoaded) {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(validationQueue));
    }
  }, [validationQueue, isLoaded, getStorageKey]);

  // Save my reviews
  useEffect(() => {
    if (isLoaded && user) {
      const reviewsKey = getReviewsKey(user.id);
      localStorage.setItem(reviewsKey, JSON.stringify(myReviews));
    }
  }, [myReviews, user, isLoaded, getReviewsKey]);

  const submitDocumentForValidation = useCallback((document) => {
    const now = new Date().toISOString();
    const validation = {
      id: generateId(),
      documentId: document.id,
      documentName: document.name,
      documentContent: document.content,
      documentFileDataUrl: document.fileDataUrl || null,
      documentFileType: document.fileType || document.type || null,
      documentSource: document.source,
      status: VALIDATION_STATES.PENDING,
      reviewers: {
        r1: null, // syntax & format
        r2: null, // security
        r3: null, // accuracy & correctness
      },
      reviews: {
        r1: null,
        r2: null,
        r3: null,
      },
      feedback: {
        r1: null,
        r2: null,
        r3: null,
      },
      submittedBy: user?.email,
      submittedAt: now,
      uploadedAt: now,
      updatedAt: now,
    };

    setValidationQueue((prev) => [validation, ...prev]);
    return validation;
  }, [user]);

  const assignReviewers = useCallback((validationId, reviewerEmails) => {
    setValidationQueue((prev) =>
      prev.map((item) => {
        if (item.id === validationId) {
          const documentName = item.documentName;
          const roleNames = ['Format/Syntax', 'Security', 'Accuracy'];
          
          // Send notifications to assigned reviewers
          reviewerEmails.forEach((email, index) => {
            if (email) {
              // Notify admin
              toast.success(`Review assigned to ${email} (${roleNames[index]})`);
              
              // Send notification to reviewer in localStorage
              const notificationKey = `cae_notifications_${email}`;
              const existingNotifications = JSON.parse(localStorage.getItem(notificationKey) || '[]');
              existingNotifications.push({
                id: generateId(),
                type: 'review_assigned',
                documentName: documentName,
                reviewLevel: index === 0 ? 'r1' : index === 1 ? 'r2' : 'r3',
                reviewRole: roleNames[index],
                validationId: validationId,
                createdAt: new Date().toISOString(),
                read: false,
              });
              localStorage.setItem(notificationKey, JSON.stringify(existingNotifications));
            }
          });
          
          return {
            ...item,
            reviewers: {
              r1: reviewerEmails[0] || null,
              r2: reviewerEmails[1] || null,
              r3: reviewerEmails[2] || null,
            },
            status: VALIDATION_STATES.ASSIGNED,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      })
    );
  }, [toast]);

  const getAssignedReviews = useCallback((userEmail) => {
    return validationQueue.filter(
      (item) =>
        item.reviewers.r1 === userEmail ||
        item.reviewers.r2 === userEmail ||
        item.reviewers.r3 === userEmail
    );
  }, [validationQueue]);

  const submitReview = useCallback(
    (validationId, reviewerEmail, reviewerLevel, isApproved, feedbackText) => {
      setValidationQueue((prev) =>
        prev.map((item) => {
          if (item.id === validationId) {
            const updated = { ...item };
            const levelKey = reviewerLevel; // 'r1', 'r2', 'r3'

            updated.reviews[levelKey] = {
              approved: isApproved,
              submittedBy: reviewerEmail,
              submittedAt: new Date().toISOString(),
            };

            if (feedbackText) {
              updated.feedback[levelKey] = feedbackText;
            }

            // Update status
            if (isApproved) {
              const allReviewsSubmitted =
                updated.reviews.r1 && updated.reviews.r2 && updated.reviews.r3;
              const allApproved =
                updated.reviews.r1?.approved &&
                updated.reviews.r2?.approved &&
                updated.reviews.r3?.approved;

              if (allReviewsSubmitted && allApproved) {
                updated.status = VALIDATION_STATES.READY_FOR_INGEST;
                toast.success(`✓ All reviewers approved! Document ready for ingestion.`);
              } else if (allReviewsSubmitted) {
                updated.status = VALIDATION_STATES.APPROVED;
                toast.success(`Review submitted. Awaiting other reviewers...`);
              } else {
                updated.status = VALIDATION_STATES.IN_REVIEW;
                toast.success(`Your review has been submitted.`);
              }
            } else {
              // Rejected
              if (levelKey === 'r1') {
                updated.status = VALIDATION_STATES.REJECTED_R1;
              } else if (levelKey === 'r2') {
                updated.status = VALIDATION_STATES.REJECTED_R2;
              } else if (levelKey === 'r3') {
                updated.status = VALIDATION_STATES.REJECTED_R3;
              }
              toast.warning(`Document rejected. Resubmission required.`);
            }

            updated.updatedAt = new Date().toISOString();
            return updated;
          }
          return item;
        })
      );

      // Also add to reviewer's personal reviews
      if (user?.email === reviewerEmail) {
        setMyReviews((prev) => [
          ...prev,
          {
            id: generateId(),
            validationId,
            documentName: validationQueue.find((v) => v.id === validationId)
              ?.documentName,
            reviewLevel: reviewerLevel,
            approved: isApproved,
            feedback: feedbackText,
            submittedAt: new Date().toISOString(),
          },
        ]);
      }
    },
    [user, validationQueue, toast]
  );

  const getValidationProgress = useCallback((validationId) => {
    const validation = validationQueue.find((item) => item.id === validationId);
    if (!validation) return null;

    return {
      id: validationId,
      documentName: validation.documentName,
      status: validation.status,
      reviewsCompleted: Object.values(validation.reviews).filter((r) => r !== null).length,
      totalReviewers: 3,
      r1: validation.reviews.r1,
      r2: validation.reviews.r2,
      r3: validation.reviews.r3,
      r1Feedback: validation.feedback.r1,
      r2Feedback: validation.feedback.r2,
      r3Feedback: validation.feedback.r3,
      submittedAt: validation.submittedAt,
      updatedAt: validation.updatedAt,
    };
  }, [validationQueue]);

  const getReviewerStats = useCallback(
    (userEmail) => {
      const userReviews = getAssignedReviews(userEmail);
      const completed = userReviews.filter(
        (item) =>
          item.reviews.r1?.submittedBy === userEmail ||
          item.reviews.r2?.submittedBy === userEmail ||
          item.reviews.r3?.submittedBy === userEmail
      ).length;

      return {
        assigned: userReviews.length,
        completed,
        pending: userReviews.length - completed,
      };
    },
    [getAssignedReviews]
  );

  const deleteValidation = useCallback((validationId) => {
    setValidationQueue((prev) => prev.filter((item) => item.id !== validationId));
  }, []);

  return (
    <ValidationContext.Provider
      value={{
        validationQueue,
        myReviews,
        VALIDATION_STATES,
        submitDocumentForValidation,
        assignReviewers,
        getAssignedReviews,
        submitReview,
        getValidationProgress,
        getReviewerStats,
        deleteValidation,
      }}
    >
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation() {
  const context = useContext(ValidationContext);
  if (!context) {
    throw new Error('useValidation must be used within ValidationProvider');
  }
  return context;
}
