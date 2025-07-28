import React from 'react';
import { SpeakerIcon } from './Icons';
import MistakeFeedback from './MistakeFeedback';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  isTyping?: boolean;
  mistakeFeedback?: {
    originalText: string;
    correctedText: string;
    explanation: string;
    detailedExplanation?: string;
    waitingForRepeat?: boolean;
    userRepeated?: boolean;
  };
}

interface MessageBubbleProps {
  msg: Message;
  onSpeak: (text: string) => void;
  renderMarkdown: (text: string) => { __html: string };
  onShowDetailedExplanation?: (messageIndex: number, detailed: string) => void;
  messageIndex?: number;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  msg, 
  onSpeak, 
  renderMarkdown, 
  onShowDetailedExplanation,
  messageIndex 
}) => {
  const isUser = msg.sender === 'user';

  const handleShowDetailedExplanation = (detailed: string) => {
    if (onShowDetailedExplanation && messageIndex !== undefined) {
      onShowDetailedExplanation(messageIndex, detailed);
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg shadow-md ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none flex flex-col gap-2'
        }`}
      >
        {msg.isTyping ? (
          <div className="flex items-center space-x-1">
            <span className="animate-bounce" style={{ animationDelay: '0s' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p className="break-words whitespace-pre-wrap flex-1" dangerouslySetInnerHTML={isUser ? undefined : renderMarkdown(msg.text)}>
                {isUser ? msg.text : null}
              </p>
              {!isUser && (
                <button
                  onClick={() => onSpeak(msg.text)}
                  className="text-gray-600 hover:text-gray-800 focus:outline-none transition duration-200 ease-in-out p-1 rounded-full hover:bg-gray-300 self-start flex-shrink-0"
                  title="Listen"
                >
                  <SpeakerIcon />
                </button>
              )}
            </div>
            
            {msg.mistakeFeedback && (
              <MistakeFeedback
                originalText={msg.mistakeFeedback.originalText}
                correctedText={msg.mistakeFeedback.correctedText}
                explanation={msg.mistakeFeedback.explanation}
                detailedExplanation={msg.mistakeFeedback.detailedExplanation}
                waitingForRepeat={msg.mistakeFeedback.waitingForRepeat}
                userRepeated={msg.mistakeFeedback.userRepeated}
                onShowDetailedExplanation={handleShowDetailedExplanation}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MessageBubble; 