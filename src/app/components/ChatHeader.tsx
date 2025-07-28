import React from 'react';
import { CloseIcon } from './Icons';

interface ChatHeaderProps {
  onClose: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ onClose }) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-300 text-white p-3 rounded-t-xl flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
          <img
            src="/Ava.png"
            alt="Ava Avatar"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col">
          <h2 className="text-lg font-bold leading-tight">Ava</h2>
          <p className="text-sm text-blue-100 leading-tight">Your English Coach</p>
        </div>
      </div>
      <button onClick={onClose} className="p-1 rounded-full hover:bg-blue-800 transition duration-200" aria-label="Close chat">
        <CloseIcon />
      </button>
    </div>
  );
};

export default ChatHeader; 