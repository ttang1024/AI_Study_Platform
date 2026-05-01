import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { QuizQuestion } from '../../types';
import { documentService } from '../../services/documentService';
import { useStudy } from '../../context/StudyContext';
import { CheckCircle2, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';

export const QuizModal: React.FC = () => {
  const { currentDocument, updateProgress } = useStudy();
  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      generateQuiz();
    };
    window.addEventListener('open-quiz-modal', handleOpen);
    return () => window.removeEventListener('open-quiz-modal', handleOpen);
  }, [currentDocument]);

  const generateQuiz = async () => {
    if (!currentDocument) return;
    setIsLoading(true);
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setIsSubmitted(false);
    setSelectedAnswer(null);

    try {
      const data = await documentService.generateQuiz(
        currentDocument.courseId || '',
        currentDocument.id
      );
      setQuestions(data);
    } catch (error) {
      console.error('Quiz generation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    setIsSubmitted(true);
    if (isQuizOptionCorrect(selectedAnswer, questions[currentIndex].answer)) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
    } else {
      // Show final score or close
      if (currentDocument) {
        updateProgress(currentDocument.id, {
          completionPercentage: 100, // Mark as completed for now
          quizScores: [{
            quizId: Math.random().toString(36).substr(2, 9),
            score,
            total: questions.length,
            date: new Date().toISOString()
          }]
        });
      }
      setIsOpen(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Knowledge Check"
      className="max-w-2xl"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-zinc-600">Generating questions based on your selection...</p>
        </div>
      ) : questions.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-sm font-medium text-primary">
              Score: {score}
            </span>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-zinc-900">
              {currentQuestion.question}
            </h4>

            <div className="space-y-2">
              {currentQuestion.type === 'multiple-choice' ? (
                currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    disabled={isSubmitted}
                    onClick={() => setSelectedAnswer(option)}
                    className={`w-full flex items-center justify-between rounded-xl border p-4 text-left transition-all ${selectedAnswer === option
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                      } ${isSubmitted && isQuizOptionCorrect(option, currentQuestion.answer)
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : ''
                      } ${isSubmitted && selectedAnswer === option && !isQuizOptionCorrect(option, currentQuestion.answer)
                        ? 'border-red-500 bg-red-50 text-red-900'
                        : ''
                      }`}
                  >
                    <span>{option}</span>
                    {isSubmitted && isQuizOptionCorrect(option, currentQuestion.answer) && (
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    )}
                    {isSubmitted && selectedAnswer === option && !isQuizOptionCorrect(option, currentQuestion.answer) && (
                      <XCircle size={20} className="text-red-500" />
                    )}
                  </button>
                ))
              ) : (
                <textarea
                  disabled={isSubmitted}
                  value={selectedAnswer || ''}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full rounded-xl border border-zinc-200 p-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  rows={3}
                />
              )}
            </div>
          </div>

          {isSubmitted && (
            <div className="rounded-xl bg-zinc-50 p-4">
              <p className="text-sm font-medium text-zinc-900">Explanation:</p>
              <p className="mt-1 text-sm text-zinc-600">{currentQuestion.explanation}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            {!isSubmitted ? (
              <Button onClick={handleSubmit} disabled={!selectedAnswer}>
                Submit Answer
              </Button>
            ) : (
              <Button onClick={handleNext}>
                {currentIndex === questions.length - 1 ? 'Finish' : 'Next Question'}
                <ChevronRight size={18} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-zinc-500">Failed to generate questions. Please try again.</p>
        </div>
      )}
    </Modal>
  );
};
