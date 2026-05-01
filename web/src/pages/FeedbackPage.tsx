import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle, Star, CheckCircle2, Send } from 'lucide-react';
import { Button } from '../components/common/Button';
import { cn } from '../utils/cn';
import { apiClient } from '../services/apiClient';

type FeedbackType = 'bug' | 'feature' | 'general';

const feedbackTypes: { id: FeedbackType; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'bug', label: 'Bug Report', icon: Bug, description: 'Something is broken or not working' },
  { id: 'feature', label: 'Feature Request', icon: Lightbulb, description: 'Suggest a new idea or improvement' },
  { id: 'general', label: 'General Feedback', icon: MessageCircle, description: 'Share your thoughts or experience' },
];

export const FeedbackPage: React.FC = () => {
  const [type, setType] = useState<FeedbackType>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setIsSubmitting(true);
    try {
      await apiClient.post('/api/feedback', {
        type,
        subject: subject.trim(),
        message: message.trim(),
        rating: rating > 0 ? rating : null,
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setType('general');
    setSubject('');
    setMessage('');
    setRating(0);
    setHoveredStar(0);
    setSubmitted(false);
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <MessageSquarePlus size={22} />
          </div>
          <h1 className="text-2xl font-bold text-text-main">Feedback</h1>
        </div>
        <p className="text-sm text-text-muted ml-[52px]">Help us improve Easy Study by sharing your thoughts</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-5"
            >
              <CheckCircle2 size={40} />
            </motion.div>
            <h2 className="text-xl font-bold text-text-main mb-2">Thank you for your feedback!</h2>
            <p className="text-sm text-text-muted max-w-sm mb-6">
              We appreciate you taking the time to share your thoughts. We'll review it carefully.
            </p>
            <Button variant="outline" onClick={handleReset}>Submit another</Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="max-w-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Feedback type */}
              <div>
                <label className="block text-sm font-semibold text-text-main mb-3">Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {feedbackTypes.map(({ id, label, icon: Icon, description }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setType(id)}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all duration-200',
                        type === id
                          ? 'border-[var(--primary)] bg-[var(--primary)]/8 shadow-sm'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/4',
                      )}
                    >
                      <Icon size={18} className={cn(
                        'shrink-0 transition-colors',
                        type === id ? 'text-[var(--primary)]' : 'text-zinc-400',
                      )} />
                      <span className={cn(
                        'text-sm font-semibold',
                        type === id ? 'text-[var(--primary)]' : 'text-text-main',
                      )}>{label}</span>
                      <span className="text-xs text-text-muted leading-snug">{description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-text-main mb-1.5">
                  Subject <span className="text-red-400">*</span>
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  required
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-text-main mb-1.5">
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe in detail..."
                  required
                  rows={5}
                  className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                />
              </div>

              {/* Star rating */}
              <div>
                <label className="block text-sm font-semibold text-text-main mb-2">
                  Overall experience <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        size={26}
                        className={cn(
                          'transition-colors',
                          star <= (hoveredStar || rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-zinc-300',
                        )}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 self-center text-xs text-text-muted">
                      {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!subject.trim() || !message.trim() || isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                      />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
