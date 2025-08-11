import React, { useState } from 'react';

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  description: string;
}

interface VoiceSettings {
  selectedVoice: string;
  speed: number;
  pitch: number;
  language: string;
  audioProfile: string;
}

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceOptions: VoiceOption[];
  currentSettings: VoiceSettings;
  onSettingsChange: (settings: VoiceSettings) => void;
  onTestVoice: (voiceId: string, speed: number, pitch: number) => Promise<boolean>;
}

const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  voiceOptions,
  currentSettings,
  onSettingsChange,
  onTestVoice
}) => {
  const [localSettings, setLocalSettings] = useState<VoiceSettings>(currentSettings);
  const [testingVoice, setTestingVoice] = useState<string | null>(null);

  // Language options
  const languageOptions = [
    { code: 'en-US', name: 'English (United States)' },
    { code: 'en-GB', name: 'English (United Kingdom)' },
    { code: 'en-AU', name: 'English (Australia)' },
    { code: 'en-CA', name: 'English (Canada)' }
  ];

  // Audio device profiles
  const audioProfiles = [
    { id: 'default', name: 'Default' },
    { id: 'wearable-class-device', name: 'Small home speaker' },
    { id: 'handset-class-device', name: 'Phone speaker' },
    { id: 'headphone-class-device', name: 'Headphones' },
    { id: 'small-bluetooth-speaker-class-device', name: 'Small Bluetooth speaker' },
    { id: 'medium-bluetooth-speaker-class-device', name: 'Medium Bluetooth speaker' },
    { id: 'large-home-entertainment-class-device', name: 'Large home speaker' }
  ];

  const handleSettingChange = (key: keyof VoiceSettings, value: string | number) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
  };

  const handleTestVoice = async (voiceId: string) => {
    setTestingVoice(voiceId);
    try {
      await onTestVoice(voiceId, localSettings.speed, localSettings.pitch);
    } catch (error) {
      console.error('Voice test failed:', error);
    } finally {
      setTestingVoice(null);
    }
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(currentSettings);
    onClose();
  };

  // Filter voices based on selected language
  const filteredVoices = voiceOptions.filter(voice => 
    voice.id.startsWith(localSettings.language)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Voice Settings</h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition duration-200"
            title="Close"
            aria-label="Close voice settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Language / Locale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language / locale
            </label>
            <select
              value={localSettings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Select language and locale"
              aria-label="Select language and locale"
            >
              {languageOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice
            </label>
            <select
              value={localSettings.selectedVoice}
              onChange={(e) => handleSettingChange('selectedVoice', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Select voice"
              aria-label="Select voice"
            >
              {filteredVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} ({voice.description})
                </option>
              ))}
            </select>
            
            {/* Test Voice Button */}
            <button
              onClick={() => handleTestVoice(localSettings.selectedVoice)}
              disabled={testingVoice === localSettings.selectedVoice}
              className="mt-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 text-blue-700 disabled:text-gray-500 rounded-md transition duration-150 flex items-center space-x-2"
            >
              {testingVoice === localSettings.selectedVoice ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <span>🔊</span>
                  <span>Test Voice</span>
                </>
              )}
            </button>
          </div>

          {/* Speed Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Speed: {localSettings.speed.toFixed(2)}
            </label>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">0.25</span>
              <input
                type="range"
                min="0.25"
                max="4.0"
                step="0.01"
                value={localSettings.speed}
                onChange={(e) => handleSettingChange('speed', parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                title="Adjust speech speed"
                aria-label="Speech speed slider"
              />
              <span className="text-sm text-gray-500">4.00</span>
            </div>
          </div>

          {/* Pitch Control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pitch: {localSettings.pitch.toFixed(2)}
            </label>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">-20.0</span>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.1"
                value={localSettings.pitch}
                onChange={(e) => handleSettingChange('pitch', parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                title="Adjust voice pitch"
                aria-label="Voice pitch slider"
              />
              <span className="text-sm text-gray-500">20.0</span>
            </div>
          </div>

          {/* Audio Device Profile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio device profile
            </label>
            <select
              value={localSettings.audioProfile}
              onChange={(e) => handleSettingChange('audioProfile', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Select audio device profile"
              aria-label="Select audio device profile"
            >
              {audioProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Custom slider styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default VoiceSettingsModal;
