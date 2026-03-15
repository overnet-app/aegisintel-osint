import { ArrowRight, Lightbulb, HelpCircle, TrendingUp, RotateCcw } from 'lucide-react';

interface FollowUpQuestion {
  question: string;
  category: 'deeper' | 'related' | 'alternative' | 'clarification';
  priority: number;
}

interface FollowUpQuestionsProps {
  questions: FollowUpQuestion[];
  onQuestionClick?: (question: string) => void;
}

export default function FollowUpQuestions({ questions, onQuestionClick }: FollowUpQuestionsProps) {
  if (questions.length === 0) return null;

  const categoryIcons = {
    deeper: TrendingUp,
    related: Lightbulb,
    alternative: RotateCcw,
    clarification: HelpCircle,
  };

  const categoryLabels = {
    deeper: 'Deeper Dive',
    related: 'Related',
    alternative: 'Alternative',
    clarification: 'Clarification',
  };

  // Sort by priority (highest first)
  const sortedQuestions = [...questions].sort((a, b) => b.priority - a.priority);

  return (
    <div className="follow-up-questions glass">
      <h3 className="follow-up-questions-title">
        <Lightbulb size={20} />
        Related Questions
      </h3>
      <div className="follow-up-questions-list">
        {sortedQuestions.map((question, idx) => {
          const Icon = categoryIcons[question.category];
          return (
            <button
              key={idx}
              className="follow-up-question-card"
              onClick={() => onQuestionClick?.(question.question)}
            >
              <div className="follow-up-question-header">
                <Icon size={16} />
                <span className="follow-up-question-category">
                  {categoryLabels[question.category]}
                </span>
              </div>
              <p className="follow-up-question-text">{question.question}</p>
              <ArrowRight size={16} className="follow-up-question-arrow" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
