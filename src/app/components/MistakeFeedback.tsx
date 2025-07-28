import React, { useState } from 'react';

interface MistakeFeedbackProps {
  originalText: string;
  correctedText: string;
  explanation: string;
  detailedExplanation?: string;
  waitingForRepeat?: boolean;
  userRepeated?: boolean;
  onShowDetailedExplanation: (detailed: string) => void;
}

const MistakeFeedback: React.FC<MistakeFeedbackProps> = ({
  originalText,
  correctedText,
  explanation,
  detailedExplanation,
  waitingForRepeat,
  userRepeated,
  onShowDetailedExplanation
}) => {
  const [showDetailed, setShowDetailed] = useState(false);
  const [isLoadingDetailed, setIsLoadingDetailed] = useState(false);

  const getCorrectivePhrase = (original: string, corrected: string): string => {
    // Use "You mean" for simple word substitutions or clarifications
    // Use "You should say" for grammar corrections or more complex changes
    const originalWords = original.trim().split(/\s+/);
    const correctedWords = corrected.trim().split(/\s+/);
    
    // If it's mostly the same length and structure, use "You mean"
    if (Math.abs(originalWords.length - correctedWords.length) <= 1) {
      return "You mean";
    }
    
    // For more complex changes, use "You should say"
    return "You should say";
  };

  const handleExplainMistake = async () => {
    if (!detailedExplanation) {
      setIsLoadingDetailed(true);
      // Generate detailed explanation in Russian via API
      const detailedText = await generateDetailedExplanation(originalText, correctedText, explanation);
      onShowDetailedExplanation(detailedText);
      setIsLoadingDetailed(false);
    }
    setShowDetailed(true);
  };

  const generateDetailedExplanation = async (original: string, corrected: string, basicExplanation: string): Promise<string> => {
    try {
      const detailedPrompt = `Provide a detailed explanation in Russian for this English mistake:
Original: "${original}"
Correct: "${corrected}"
Basic explanation: "${basicExplanation}"

Provide a comprehensive explanation in Russian covering:
1. What the mistake was
2. Why it's incorrect
3. The grammar rule that applies
4. Example of correct usage
5. Tips to remember this rule

Keep it concise but informative.`;

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) return generateFallbackExplanation(original, corrected, basicExplanation);

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ role: 'user', parts: [{ text: detailedPrompt }] }] 
        })
      });

      if (response.ok) {
        const result = await response.json();
        const detailedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (detailedText) return detailedText;
      }
    } catch (error) {
      console.error('Error generating detailed explanation:', error);
    }

    return generateFallbackExplanation(original, corrected, basicExplanation);
  };

  const generateFallbackExplanation = (original: string, corrected: string, basicExplanation: string): string => {
    return `Подробное объяснение ошибки:

Ваш текст: "${original}"
Правильный вариант: "${corrected}"

${basicExplanation}

Это распространенная ошибка среди изучающих английский язык. Запомните правильную форму и попробуйте использовать её в других предложениях для закрепления.`;
  };

  return (
    <div className="mistake-feedback bg-red-50 border-l-4 border-red-400 p-4 my-2 rounded-r-lg">
      <div className="mb-2">
        <p className="text-red-800 font-medium">
          <span className="text-red-600">{getCorrectivePhrase(originalText, correctedText)}:</span> &quot;{correctedText}&quot;
        </p>
        <p className="text-red-700 text-sm mt-1">{explanation}</p>
      </div>
      
      {!showDetailed && (
        <button
          onClick={handleExplainMistake}
          disabled={isLoadingDetailed}
          className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 mb-3 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200 shadow-sm"
        >
          {isLoadingDetailed ? 'Loading...' : 'Explain this mistake'}
        </button>
      )}
      
      {showDetailed && detailedExplanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm">
          <div className="whitespace-pre-line text-gray-800">
            {detailedExplanation}
          </div>
        </div>
      )}
      
      {waitingForRepeat && !userRepeated && (
        <p className="text-orange-700 font-medium text-sm mt-2">
          Please repeat the corrected version: &quot;{correctedText}&quot;
        </p>
      )}
      
      {userRepeated && (
        <p className="text-green-700 font-medium text-sm mt-2">
          ✓ Great! Now let&apos;s continue our conversation.
        </p>
      )}
    </div>
  );
};

export default MistakeFeedback; 