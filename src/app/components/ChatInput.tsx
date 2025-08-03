import React, { useRef } from 'react';

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  isSending: boolean;
  isListening: boolean;
  onPrimaryAction: () => void;
  primaryActionIcon: React.ReactElement;
  primaryActionTitle: string;
  onFileUpload?: (file: File) => void;
  acceptedFileTypes?: string;
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
  onFileUpload,
  acceptedFileTypes,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
      // Reset the input so the same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  // Simple upload icon SVG component
  const UploadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
    </svg>
  );

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
      
      {/* Hidden file input */}
      {onFileUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFileTypes}
          onChange={handleFileChange}
          className="hidden"
        />
      )}
      
      {/* File upload button */}
      {onFileUpload && (
        <button
          onClick={handleFileButtonClick}
          className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 hover:scale-105 transition duration-300 ease-in-out transform"
          disabled={isSending || isListening}
          title="Upload File"
        >
          <UploadIcon />
        </button>
      )}
      
      {/* Primary action button (voice/send) */}
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