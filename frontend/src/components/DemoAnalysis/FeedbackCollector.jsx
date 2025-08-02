import React, { useState } from 'react';

const FeedbackCollector = ({ analysisId, onSubmit, onSkip }) => {
  const [feedback, setFeedback] = useState({
    accuracy_rating: 4,
    feedback_text: '',
    specific_issues: []
  });

  const [selectedIssues, setSelectedIssues] = useState({
    boundary_inaccurate: false,
    area_incorrect: false,
    missed_areas: false,
    extra_areas: false,
    material_wrong: false
  });

  const issueTypes = [
    { id: 'boundary_inaccurate', label: '경계선이 부정확함' },
    { id: 'area_incorrect', label: '면적이 틀림' },
    { id: 'missed_areas', label: '누락된 영역이 있음' },
    { id: 'extra_areas', label: '잘못 감지된 영역이 있음' },
    { id: 'material_wrong', label: '재료 식별이 틀림' }
  ];

  const handleSubmit = () => {
    const specificIssues = Object.entries(selectedIssues)
      .filter(([_, selected]) => selected)
      .map(([issueType, _]) => ({
        issue_type: issueType,
        description: ''
      }));

    onSubmit({
      ...feedback,
      specific_issues: specificIssues
    });
  };

  return (
    <div className="feedback-collector max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">AI 분석 피드백</h3>
        
        {/* Accuracy rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            전체적인 정확도는 어떠셨나요?
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => setFeedback({ ...feedback, accuracy_rating: rating })}
                className={`p-2 rounded-lg transition-colors ${
                  feedback.accuracy_rating >= rating
                    ? 'text-yellow-500'
                    : 'text-gray-300'
                }`}
              >
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
            <span className="ml-2 text-sm text-gray-600">
              {feedback.accuracy_rating}/5
            </span>
          </div>
        </div>

        {/* Specific issues */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            어떤 문제가 있었나요? (해당되는 것 모두 선택)
          </label>
          <div className="space-y-2">
            {issueTypes.map((issue) => (
              <label key={issue.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedIssues[issue.id]}
                  onChange={(e) => setSelectedIssues({
                    ...selectedIssues,
                    [issue.id]: e.target.checked
                  })}
                  className="mr-2 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">{issue.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Additional comments */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            추가 의견 (선택사항)
          </label>
          <textarea
            value={feedback.feedback_text}
            onChange={(e) => setFeedback({ ...feedback, feedback_text: e.target.value })}
            rows="4"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            placeholder="AI 분석의 개선점이나 구체적인 문제점을 알려주세요..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={onSkip}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            건너뛰기
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            피드백 제출
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-500">
        피드백은 AI 분석 성능 향상에 사용됩니다. 감사합니다!
      </p>
    </div>
  );
};

export default FeedbackCollector;