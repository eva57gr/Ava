import React from 'react';
import MessageBubble from './MessageBubble';

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

type Feature = 'freeTalk' | 'vocabulary' | 'mistakes' | 'grammar';

interface MessageListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSpeak: (text: string) => void;
  renderMarkdown: (text: string) => { __html: string };
  currentFeature: Feature;
  inputPlaceholder: string;
  onShowDetailedExplanation?: (messageIndex: number, detailed: string) => void;
}

const EmptyState = ({ currentFeature, placeholder }: { currentFeature: Feature, placeholder: string }) => {
  const getPrompt = (feature: Feature) => {
    switch (feature) {
      case 'vocabulary': return "Let's expand your vocabulary!";
      case 'mistakes': return "Ready to improve your writing?";
      case 'grammar': return "Master English grammar!";
      default: return "Start practicing your English!";
    }
  };

  return (
    <div className="text-center text-gray-500 mt-10">
      <p className="text-md">{getPrompt(currentFeature)}</p>
      <p className="text-sm">{placeholder}</p>
    </div>
  );
};

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  messagesEndRef, 
  onSpeak, 
  renderMarkdown, 
  currentFeature, 
  inputPlaceholder,
  onShowDetailedExplanation 
}) => {
  return (
    <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
      {messages.length === 0 ? (
        <EmptyState currentFeature={currentFeature} placeholder={inputPlaceholder} />
      ) : (
        messages.map((msg, index) => (
          <MessageBubble 
            key={index} 
            msg={msg} 
            onSpeak={onSpeak} 
            renderMarkdown={renderMarkdown}
            onShowDetailedExplanation={onShowDetailedExplanation}
            messageIndex={index}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 