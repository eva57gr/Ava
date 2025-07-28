import React from 'react';

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  isSending: boolean;
  isListening: boolean;
  onPrimaryAction: () => void;
  primaryActionIcon: JSX.Element;
  primaryActionTitle: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onInputChange,
  onKeyPress,
  placeholder,
  isSending,
  isListening,
  onPrimaryAction,
  primaryActionIcon,
  primaryActionTitle,
}) => {
  return (
    <div className="p-3 bg-white border-t border-gray-200 flex items-center space-x-2 rounded-b-xl shadow-inner">
      <input
        type="text"
        value={input}
        onChange={onInputChange}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        className="flex-1 p-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 transition duration-200 ease-in-out"
        disabled={isSending || isListening}
      />
      <button
        onClick={onPrimaryAction}
        className={`p-2 rounded-full shadow-lg transition duration-300 ease-in-out transform ${
          isListening
            ? 'bg-red-500 text-white'
            : input.trim() !== ''
              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:scale-105'
        } ${isSending ? 'opacity-60 cursor-not-allowed' : ''}`}
        disabled={isSending}
        title={primaryActionTitle}
      >
        {primaryActionIcon}
      </button>
    </div>
  );
};

export default ChatInput; 