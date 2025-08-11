import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon } from './Icons';
import Image from 'next/image';

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  description: string;
}

interface ChatHeaderProps {
  onClose: () => void;
  selectedVoice: string;
  voiceOptions: VoiceOption[];
  onVoiceChange: (voiceId: string) => void;
  onTestVoice: (voiceId: string) => Promise<boolean>;
  onOpenVoiceSettings: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onClose, selectedVoice, voiceOptions, onVoiceChange, onTestVoice, onOpenVoiceSettings }) => {
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const selectedVoiceOption = voiceOptions.find(voice => voice.id === selectedVoice);

  // Handle voice testing
  const handleTestVoice = async (voiceId: string) => {
    setTestingVoice(voiceId);
    try {
      await onTestVoice(voiceId);
    } catch (error) {
      console.error('Voice test failed:', error);
    } finally {
      setTestingVoice(null);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-300 text-white p-3 rounded-t-xl flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
          <Image
            src="/Ava.png"
            alt="Ava Avatar"
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col">
          <h2 className="text-lg font-bold leading-tight">Ava</h2>
          <p className="text-sm text-blue-100 leading-tight">Your English Coach</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Voice Settings Button */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onOpenVoiceSettings}
            className="flex items-center space-x-1 px-2 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition duration-200 text-sm"
            title="Voice Settings"
          >
            <span>🎤</span>
            <span className="hidden sm:inline">{selectedVoiceOption?.name || 'Voice'}</span>
            <span className="text-xs">⚙️</span>
          </button>
          
          <button
            onClick={() => handleTestVoice(selectedVoice)}
            disabled={testingVoice === selectedVoice}
            className="px-1 py-1 bg-white/20 rounded hover:bg-white/30 transition duration-200 text-sm disabled:opacity-50"
            title="Test current voice"
          >
            {testingVoice === selectedVoice ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>🔊</span>
            )}
          </button>
        </div>
        
        <button onClick={onClose} className="p-1 rounded-full hover:bg-blue-800 transition duration-200" aria-label="Close chat">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader; 