'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatHeader from './components/ChatHeader';
import FeatureButtons from './components/FeatureButtons';
import ChatInput from './components/ChatInput';
import AuthPage from './components/auth/AuthPage';
import UserProfile from './components/auth/UserProfile';
import VoiceSettingsModal from './components/VoiceSettingsModal';
import { LargeCloseIcon, ChatIcon, MicrophoneIcon, SendIcon, DocumentUploadIcon } from './components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { createSupabaseClient } from '@/lib/supabase';

// Fix: Properly handle environment variable with validation
const Public_URL = process.env.NEXT_PUBLIC_API_URL || '';
const GOOGLE_TTS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY || '';

if (!Public_URL && typeof window === 'undefined') {
  console.warn('NEXT_PUBLIC_API_URL environment variable is not set');
}


// Speech Recognition type definitions
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResult[];
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  grammars?: SpeechGrammarList;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  addEventListener?: (type: string, listener: () => void) => void;
}

interface SpeechGrammarList {
  addFromString(string: string, weight: number): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    SpeechGrammarList?: new () => SpeechGrammarList;
    webkitSpeechGrammarList?: new () => SpeechGrammarList;
  }
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
  isTyping?: boolean;
  hasMistake?: boolean;
  originalText?: string;
  correctedText?: string;
  explanation?: string;
  explanationRussian?: string; // Add Russian explanation field
  isRetryPrompt?: boolean;
  mistakeId?: string;
  isGamePrompt?: boolean; // Add field for grammar games
  gameId?: string; // Add field for game tracking
  hasAttachment?: boolean;
  attachmentName?: string;
  attachmentType?: string;
}

type Feature = 'freeTalk' | 'vocabulary' | 'mistakes' | 'grammar';

const AIChatWidget = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentFeature, setCurrentFeature] = useState<Feature>('freeTalk');
  const [isListening, setIsListening] = useState(false);
  const [isAutoSpeaking, setIsAutoSpeaking] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [waitingForRetry, setWaitingForRetry] = useState<string | null>(null); // Store mistake ID waiting for retry
  const [showMistakeExplanation, setShowMistakeExplanation] = useState<string | null>(null);
  // Add new state for grammar session management
  const [grammarSessionStart, setGrammarSessionStart] = useState<Date | null>(null);
  const [currentGrammarLesson, setCurrentGrammarLesson] = useState<string | null>(null);
  const [practiceCount, setPracticeCount] = useState(0);
  const [waitingForGameAnswer, setWaitingForGameAnswer] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('en-US-Journey-F'); // Default voice
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    selectedVoice: 'en-US-Journey-F',
    speed: 0.9,
    pitch: 0.0,
    language: 'en-US',
    audioProfile: 'default'
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Fix: Use single supabase instance
  const supabase = createSupabaseClient();
  const { user } = useAuth();

  // Define available Google Cloud TTS voices
  const voiceOptions = [
    // US English voices
    { id: 'en-US-Journey-F', name: 'en-US-Journey-F', gender: 'FEMALE', description: 'Warm, conversational' },
    { id: 'en-US-Studio-O', name: 'en-US-Studio-O', gender: 'FEMALE', description: 'Clear, professional' },
    { id: 'en-US-Neural2-F', name: 'en-US-Neural2-F', gender: 'FEMALE', description: 'Natural, expressive' },
    { id: 'en-US-Neural2-A', name: 'en-US-Neural2-A', gender: 'FEMALE', description: 'Friendly, casual' },
    { id: 'en-US-Neural2-C', name: 'en-US-Neural2-C', gender: 'FEMALE', description: 'Energetic, youthful' },
    { id: 'en-US-Journey-D', name: 'en-US-Journey-D', gender: 'MALE', description: 'Deep, authoritative' },
    { id: 'en-US-Neural2-D', name: 'en-US-Neural2-D', gender: 'MALE', description: 'Calm, steady' },
    { id: 'en-US-Standard-B', name: 'en-US-Standard-B', gender: 'MALE', description: 'Classic, clear' },
    { id: 'en-US-Standard-C', name: 'en-US-Standard-C', gender: 'FEMALE', description: 'Standard female' },
    { id: 'en-US-Standard-D', name: 'en-US-Standard-D', gender: 'MALE', description: 'Standard male' },
    { id: 'en-US-Standard-E', name: 'en-US-Standard-E', gender: 'FEMALE', description: 'Clear female' },
    { id: 'en-US-Wavenet-A', name: 'en-US-Wavenet-A', gender: 'MALE', description: 'Wavenet male' },
    { id: 'en-US-Wavenet-B', name: 'en-US-Wavenet-B', gender: 'MALE', description: 'Wavenet alternative' },
    { id: 'en-US-Wavenet-C', name: 'en-US-Wavenet-C', gender: 'FEMALE', description: 'Wavenet female' },
    { id: 'en-US-Wavenet-D', name: 'en-US-Wavenet-D', gender: 'MALE', description: 'Wavenet deep' },
    { id: 'en-US-Wavenet-E', name: 'en-US-Wavenet-E', gender: 'FEMALE', description: 'Wavenet expressive' },
    { id: 'en-US-Wavenet-F', name: 'en-US-Wavenet-F', gender: 'FEMALE', description: 'Wavenet friendly' },
    { id: 'en-US-Wavenet-G', name: 'en-US-Wavenet-G', gender: 'FEMALE', description: 'Wavenet gentle' },
    { id: 'en-US-Wavenet-H', name: 'en-US-Wavenet-H', gender: 'FEMALE', description: 'Wavenet warm' },
    { id: 'en-US-Wavenet-I', name: 'en-US-Wavenet-I', gender: 'MALE', description: 'Wavenet mature' },
    { id: 'en-US-Wavenet-J', name: 'en-US-Wavenet-J', gender: 'MALE', description: 'Wavenet professional' },
    
    // UK English voices
    { id: 'en-GB-Neural2-A', name: 'en-GB-Neural2-A', gender: 'FEMALE', description: 'British female' },
    { id: 'en-GB-Neural2-B', name: 'en-GB-Neural2-B', gender: 'MALE', description: 'British male' },
    { id: 'en-GB-Neural2-C', name: 'en-GB-Neural2-C', gender: 'FEMALE', description: 'British expressive' },
    { id: 'en-GB-Neural2-D', name: 'en-GB-Neural2-D', gender: 'MALE', description: 'British deep' },
    { id: 'en-GB-Standard-A', name: 'en-GB-Standard-A', gender: 'FEMALE', description: 'British standard female' },
    { id: 'en-GB-Standard-B', name: 'en-GB-Standard-B', gender: 'MALE', description: 'British standard male' },
    { id: 'en-GB-Standard-C', name: 'en-GB-Standard-C', gender: 'FEMALE', description: 'British clear' },
    { id: 'en-GB-Standard-D', name: 'en-GB-Standard-D', gender: 'MALE', description: 'British authoritative' },
    { id: 'en-GB-Wavenet-A', name: 'en-GB-Wavenet-A', gender: 'FEMALE', description: 'British wavenet female' },
    { id: 'en-GB-Wavenet-B', name: 'en-GB-Wavenet-B', gender: 'MALE', description: 'British wavenet male' },
    { id: 'en-GB-Wavenet-C', name: 'en-GB-Wavenet-C', gender: 'FEMALE', description: 'British wavenet expressive' },
    { id: 'en-GB-Wavenet-D', name: 'en-GB-Wavenet-D', gender: 'MALE', description: 'British wavenet deep' },
    
    // Australian English voices
    { id: 'en-AU-Neural2-A', name: 'en-AU-Neural2-A', gender: 'FEMALE', description: 'Australian female' },
    { id: 'en-AU-Neural2-B', name: 'en-AU-Neural2-B', gender: 'MALE', description: 'Australian male' },
    { id: 'en-AU-Neural2-C', name: 'en-AU-Neural2-C', gender: 'FEMALE', description: 'Australian friendly' },
    { id: 'en-AU-Neural2-D', name: 'en-AU-Neural2-D', gender: 'MALE', description: 'Australian casual' },
    { id: 'en-AU-Standard-A', name: 'en-AU-Standard-A', gender: 'FEMALE', description: 'Australian standard female' },
    { id: 'en-AU-Standard-B', name: 'en-AU-Standard-B', gender: 'MALE', description: 'Australian standard male' },
    { id: 'en-AU-Standard-C', name: 'en-AU-Standard-C', gender: 'FEMALE', description: 'Australian clear' },
    { id: 'en-AU-Standard-D', name: 'en-AU-Standard-D', gender: 'MALE', description: 'Australian strong' },
    { id: 'en-AU-Wavenet-A', name: 'en-AU-Wavenet-A', gender: 'FEMALE', description: 'Australian wavenet female' },
    { id: 'en-AU-Wavenet-B', name: 'en-AU-Wavenet-B', gender: 'MALE', description: 'Australian wavenet male' },
    { id: 'en-AU-Wavenet-C', name: 'en-AU-Wavenet-C', gender: 'FEMALE', description: 'Australian wavenet friendly' },
    { id: 'en-AU-Wavenet-D', name: 'en-AU-Wavenet-D', gender: 'MALE', description: 'Australian wavenet deep' },
    
    // Canadian English voices
    { id: 'en-CA-Neural2-A', name: 'en-CA-Neural2-A', gender: 'FEMALE', description: 'Canadian female' },
    { id: 'en-CA-Neural2-B', name: 'en-CA-Neural2-B', gender: 'MALE', description: 'Canadian male' },
    { id: 'en-CA-Neural2-C', name: 'en-CA-Neural2-C', gender: 'FEMALE', description: 'Canadian warm' },
    { id: 'en-CA-Neural2-D', name: 'en-CA-Neural2-D', gender: 'MALE', description: 'Canadian professional' },
    { id: 'en-CA-Standard-A', name: 'en-CA-Standard-A', gender: 'FEMALE', description: 'Canadian standard female' },
    { id: 'en-CA-Standard-B', name: 'en-CA-Standard-B', gender: 'MALE', description: 'Canadian standard male' },
    { id: 'en-CA-Standard-C', name: 'en-CA-Standard-C', gender: 'FEMALE', description: 'Canadian clear' },
    { id: 'en-CA-Standard-D', name: 'en-CA-Standard-D', gender: 'MALE', description: 'Canadian authoritative' },
    { id: 'en-CA-Wavenet-A', name: 'en-CA-Wavenet-A', gender: 'FEMALE', description: 'Canadian wavenet female' },
    { id: 'en-CA-Wavenet-B', name: 'en-CA-Wavenet-B', gender: 'MALE', description: 'Canadian wavenet male' },
    { id: 'en-CA-Wavenet-C', name: 'en-CA-Wavenet-C', gender: 'FEMALE', description: 'Canadian wavenet friendly' },
    { id: 'en-CA-Wavenet-D', name: 'en-CA-Wavenet-D', gender: 'MALE', description: 'Canadian wavenet deep' }
  ];

  // Load voice settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('ava-voice-settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setVoiceSettings(parsedSettings);
        setSelectedVoice(parsedSettings.selectedVoice);
      } catch (error) {
        console.error('Error parsing voice settings:', error);
      }
    }
  }, []);

  // Save voice settings to localStorage when changed
  useEffect(() => {
    localStorage.setItem('ava-voice-settings', JSON.stringify(voiceSettings));
    setSelectedVoice(voiceSettings.selectedVoice);
  }, [voiceSettings]);

  // Load chat history from Supabase
  const loadChatHistory = async (feature: Feature) => {
    if (!user?.id) return;

    setIsLoadingHistory(true);
    try {
      const { data: chatHistory, error } = await supabase
        .from('ChatHistory')
        .select('*')
        .eq('user_id', user.id)
        .eq('feature', feature)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }

      if (chatHistory && chatHistory.length > 0) {
        // Convert database records to Message format with mistake detection parsing
        const historyMessages: Message[] = [];

        for (let i = 0; i < chatHistory.length; i++) {
          const record = chatHistory[i];

          if (record.sender === 'user') {
            // User messages are straightforward
            historyMessages.push({
              sender: 'user',
              text: record.content
            });
          } else {
            // AI messages need to be parsed for mistake detection (now for all features)
            if (record.content.includes('MISTAKE_DETECTED:') || record.content.includes('NO_MISTAKE:')) {
              // Find the corresponding user message for context
              let userInput = '';
              if (i > 0 && chatHistory[i - 1].sender === 'user') {
                userInput = chatHistory[i - 1].content;
              }

              // Parse the AI response to restore mistake detection functionality
              const parsedMessage = parseAIResponse(record.content, userInput);
              historyMessages.push(parsedMessage);
            } else {
              // Regular AI message without mistake detection
              historyMessages.push({
                sender: 'ai',
                text: record.content
              });
            }
          }
        }

        setMessages(historyMessages);
      } else {
        // Show greeting message if no history
        setMessages([{
          sender: 'ai',
          text: "Hi! I'm Ava, your English coach. Let's practice together!"
        }]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Show greeting message on error
      setMessages([{
        sender: 'ai',
        text: "Hi! I'm Ava, your English coach. Let's practice together!"
      }]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Initialize with chat history when chat opens or feature changes
  useEffect(() => {
    if (isOpen && user?.id) {
      loadChatHistory(currentFeature);
      setHasInitialized(true);
    }
  }, [isOpen, currentFeature, user?.id]);

  // Get feature description
  const getFeatureDescription = (feature: Feature): string => {
    switch (feature) {
      case 'freeTalk':
        return "Want to talk about travel, hobbies, or your job?";
      case 'vocabulary':
        return "Let's expand your vocabulary! Ask about words or I'll teach you new ones.";
      case 'grammar':
        return "I'll help you with grammar rules and correct your sentences.";
      case 'mistakes':
        return "Share some text and I'll help you find and fix any mistakes.";
      default:
        return "";
    }
  };

  useEffect(() => {
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();

      // Enhanced STT configuration for better accuracy
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 3; // Get multiple alternatives for better accuracy

      // Add grammar hints based on current feature for better context understanding
      const getGrammarHints = (feature: Feature) => {
        switch (feature) {
          case 'vocabulary':
            return ['word', 'definition', 'meaning', 'example', 'synonym', 'antonym'];
          case 'grammar':
            return ['noun', 'verb', 'adjective', 'adverb', 'tense', 'sentence', 'question'];
          case 'mistakes':
            return ['correct', 'wrong', 'mistake', 'error', 'fix', 'review'];
          default:
            return ['hello', 'how', 'what', 'when', 'where', 'why', 'please', 'thank you'];
        }
      };

      // Set grammar hints if supported
      if (recognitionRef.current.grammars !== undefined) {
        const SpeechGrammarListConstructor = window.SpeechGrammarList || window.webkitSpeechGrammarList;
        if (SpeechGrammarListConstructor) {
          const grammarList = new SpeechGrammarListConstructor();
          const hints = getGrammarHints(currentFeature);
          const grammar = `#JSGF V1.0; grammar hints; public <hint> = ${hints.join(' | ')};`;
          grammarList.addFromString(grammar, 1);
          recognitionRef.current.grammars = grammarList;
        }
      }

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        console.log('Speech recognition started');
        // Reset speech detection variables
        hasDetectedSpeech = false;
        lastSpeechTime = Date.now();
        completeTranscript = ''; // Reset transcript for new recording
      };

      let recognitionTimeout: NodeJS.Timeout;
      let lastSpeechTime = Date.now();
      let hasDetectedSpeech = false;
      let completeTranscript = ''; // Store the complete transcript for auto-sending

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let currentFinalTranscript = '';
        let highestConfidence = 0;
        let bestTranscript = '';

        // Update last speech time when we get any result
        lastSpeechTime = Date.now();
        hasDetectedSpeech = true;

        for (let i = 0; i < event.results.length; ++i) {
          const result = event.results[i];

          if (result.isFinal) {
            // Check confidence levels and choose the best alternative
            for (let j = 0; j < result.length; j++) {
              const alternative = result[j];
              if (alternative.confidence > highestConfidence) {
                highestConfidence = alternative.confidence;
                bestTranscript = alternative.transcript;
              }
            }

            // Only use results with sufficient confidence (threshold: 0.6)
            if (highestConfidence >= 0.6) {
              currentFinalTranscript += bestTranscript;
            } else {
              console.warn(`Low confidence result (${highestConfidence}): ${bestTranscript}`);
              // Still use it but log the low confidence
              currentFinalTranscript += bestTranscript;
            }
          } else {
            // For interim results, also consider confidence
            const alternative = result[0];
            if (alternative.confidence === undefined || alternative.confidence > 0.3) {
              interimTranscript += alternative.transcript;
            }
          }
        }

        // Update the complete transcript with final results
        if (currentFinalTranscript) {
          completeTranscript += currentFinalTranscript;
        }

        // Clear any existing timeout
        if (recognitionTimeout) {
          clearTimeout(recognitionTimeout);
        }

        // Set timeout to auto-stop recognition after longer period of silence
        // Only start the timeout if we've detected speech and have been quiet for a while
        recognitionTimeout = setTimeout(() => {
          const timeSinceLastSpeech = Date.now() - lastSpeechTime;
          if (recognitionRef.current && isListening && hasDetectedSpeech && timeSinceLastSpeech >= 2000) {
            console.log('Stopping recognition due to extended silence after speech');
            recognitionRef.current.stop();
          }
        }, 2500); // Increased timeout to 2.5 seconds for better user experience

        // Show only interim results in input (final results are stored separately for auto-sending)
        const displayTranscript = interimTranscript;
        if (displayTranscript.trim()) {
          setInput(displayTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);

        // Enhanced error handling with user feedback
        switch (event.error) {
          case 'network':
            setMessages(prev => [...prev, {
              sender: 'ai',
              text: 'Network error during speech recognition. Please check your connection and try again.'
            }]);
            break;
          case 'not-allowed':
            setMessages(prev => [...prev, {
              sender: 'ai',
              text: 'Microphone access denied. Please enable microphone permissions and try again.'
            }]);
            break;
          case 'no-speech':
            console.log('No speech detected, trying again...');
            // Auto-retry once for no-speech errors
            setTimeout(() => {
              if (!isListening) {
                startListening();
              }
            }, 500);
            break;
          case 'audio-capture':
            setMessages(prev => [...prev, {
              sender: 'ai',
              text: 'Audio capture error. Please check your microphone and try again.'
            }]);
            break;
          default:
            console.error('Unhandled speech recognition error:', event.error);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        console.log('Speech recognition ended');

        // Clear any existing timeout
        if (recognitionTimeout) {
          clearTimeout(recognitionTimeout);
        }

        // Clear input immediately (don't show transcribed text)
        setInput('');

        // Auto-send the complete transcript without showing it in input
        setTimeout(() => {
          const finalText = completeTranscript.trim();
          if (finalText && finalText.length > 0 && hasDetectedSpeech) {
            console.log('Auto-sending voice message directly:', finalText);
            sendMessage(finalText, true); // true enables auto-speak for AI response
          } else {
            console.log('No speech detected or transcript empty, not auto-sending');
          }

          // Reset variables for next recording
          hasDetectedSpeech = false;
          completeTranscript = '';
        }, 200); // Reduced delay for immediate sending
      };

      // Enhanced noise suppression if supported
      if (recognitionRef.current.addEventListener) {
        recognitionRef.current.addEventListener('audiostart', () => {
          console.log('Audio capturing started');
        });

        recognitionRef.current.addEventListener('audioend', () => {
          console.log('Audio capturing ended');
        });
      }
    } else if (typeof window !== 'undefined') {
      console.warn('Speech Recognition API not supported in this browser.');
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge for voice features.'
      }]);
    }

    const recognition = recognitionRef.current;
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [SpeechRecognition, currentFeature]); // Added currentFeature as dependency

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isAutoSpeaking && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'ai' && !lastMessage.isTyping) {
        speakText(lastMessage.text);
        setIsAutoSpeaking(false);
      }
    }
  }, [messages, isAutoSpeaking]);

  const getPromptPrefix = useCallback((feature: Feature) => {
    const baseProtocol = `
MISTAKE DETECTION PROTOCOL:
1. First, analyze the user's input for any grammar, vocabulary, or usage mistakes
2. Respond in one of two ways based on your analysis:

IF MISTAKES ARE FOUND:
- Start your response with "MISTAKE_DETECTED:"
- Provide the corrected version
- Give a brief, encouraging explanation of the mistake in English
- Then provide a detailed explanation in Russian after "RUSSIAN_EXPLANATION:"
- Ask "Can you try saying it again?" to encourage retry
- Format: "MISTAKE_DETECTED: You meant: '[corrected text]'. [Brief English explanation]. Can you try saying it again? RUSSIAN_EXPLANATION: [Detailed explanation in Russian]"

IF NO MISTAKES:
- Start your response with "NO_MISTAKE:"
- Give positive feedback acknowledging what they said
- Continue with your specialized response based on the feature
- Format: "NO_MISTAKE: [Positive feedback]! [Feature-specific response]"

Always provide Russian explanations for mistakes to help Russian-speaking learners understand better.`;

    switch (feature) {
      case 'vocabulary':
        return `You are Ava, an English vocabulary tutor with mistake detection capabilities. Your role is to help users learn new words and improve their vocabulary usage.

${baseProtocol}

VOCABULARY-SPECIFIC GUIDELINES:
- If NO_MISTAKE: After positive feedback, explain the word they used, provide synonyms, antonyms, or teach related vocabulary
- If they ask for a new word, provide it with definition, examples, and related words
- Focus on practical usage and context
- Encourage them to use new words in sentences

EXAMPLES:
User: "What does 'happy' means?"
Response: "MISTAKE_DETECTED: You meant: 'What does happy mean?' or 'What is the meaning of happy?'. When asking about word meanings, we use 'mean' not 'means' with 'does'. Can you try saying it again? RUSSIAN_EXPLANATION: При вопросах о значении слов с 'does' мы используем базовую форму глагола 'mean', а не 'means'. Правильно: 'What does happy mean?' или 'What is the meaning of happy?'"

User: "What does happy mean?"
Response: "NO_MISTAKE: Perfect question! 'Happy' means feeling joy, pleasure, or contentment. For example: 'I feel happy when I spend time with friends.' Some synonyms are: joyful, cheerful, glad, delighted. Can you make a sentence using 'happy'?"

Be encouraging and focus on expanding vocabulary while correcting mistakes gently.`;

      case 'mistakes':
        return `You are Ava, an English error correction tutor with mistake detection capabilities. Your role is to help users identify and correct their English mistakes.

${baseProtocol}

MISTAKE CORRECTION GUIDELINES:
- Always check their input for errors, even if they're asking you to check other text
- If NO_MISTAKE: Acknowledge their correct English, then address their request
- When correcting mistakes, explain the grammar rule, spelling principle, or usage pattern
- Be thorough but encouraging
- Focus on the most important mistakes first

EXAMPLES:
User: "Can you check this text for me please?"
Response: "NO_MISTAKE: Perfect request! I'd be happy to check your text for mistakes. Please share the text you'd like me to review, and I'll help you identify any errors and explain how to fix them."

User: "I need you check my homework"
Response: "MISTAKE_DETECTED: You meant: 'I need you to check my homework'. We need the preposition 'to' after 'need you'. Can you try saying it again? RUSSIAN_EXPLANATION: После 'need you' всегда нужна частица 'to' перед следующим глаголом. Правильно: 'I need you to check' (мне нужно, чтобы ты проверил). Это правило для всех конструкций типа 'need someone to do something'."

Be thorough in your corrections and always explain the underlying rules.`;

      case 'grammar':
        return `You are Ava, an English grammar tutor with mistake detection capabilities. Your role is to help users understand and correctly use English grammar through structured lessons and interactive games.

${baseProtocol}

LESSON DETECTION PROTOCOL:
1. First, analyze the user's input to detect what grammar topic they're working on:
   - Present Simple (I work, she works, do you work?)
   - Past Simple (I worked, did you work?)
   - Present Continuous (I am working, are you working?)
   - Past Continuous (I was working, were you working?)
   - Present Perfect (I have worked, have you worked?)
   - Past Perfect (I had worked, had you worked?)
   - Future tenses (will work, going to work)
   - Modal verbs (can, should, must, might)
   - Conditionals (if clauses)
   - Passive voice
   - Questions and negatives
   - Articles (a, an, the)

2. When you detect a grammar topic, start your first response with: "LESSON_DETECTED: [topic]"

GRAMMAR SESSION STRUCTURE:
1. **Initial Greeting** (when lesson detected):
   "LESSON_DETECTED: Present Simple. Great! You're currently working on the Present Simple lesson. Let's practice it together!"

2. **Practice Phase** (first 8-10 interactions):
   - Apply normal mistake detection protocol
   - Focus on the detected grammar topic
   - Provide examples related to the lesson
   - Encourage sentence creation using the target grammar

3. **Game Phase** (after practice):
   - When it's time for a game, respond with: "GRAMMAR_GAME:"
   - Present 3 sentences, one with a mistake
   - Ask user to identify the incorrect sentence
   - Format: "GRAMMAR_GAME: Let's play a quick game! I'll say 3 sentences. One of them has a grammar mistake. Can you find it?
     1. [correct sentence]
     2. [incorrect sentence]  
     3. [correct sentence]
     
     Which sentence has the mistake?"

GRAMMAR-SPECIFIC GUIDELINES:
- Always try to detect the grammar lesson from user input
- If NO_MISTAKE during practice: Acknowledge correct grammar, provide more examples of the same topic
- During games: If user finds the mistake, explain why it's wrong and provide the correction
- Focus on one grammar topic per session for better learning
- Provide plenty of examples and encourage active practice

EXAMPLES:

User: "I go to work every day"
Response: "LESSON_DETECTED: Present Simple. Great! You're currently working on the Present Simple lesson. Let's practice it together! NO_MISTAKE: Perfect sentence! 'I go to work every day' uses Present Simple correctly for daily routines. Let's practice more. Can you tell me about another daily activity using Present Simple?"

User: "She don't like coffee"
Response: "MISTAKE_DETECTED: You meant: 'She doesn't like coffee'. With third person singular (he/she/it), we use 'doesn't' not 'don't'. Can you try saying it again? RUSSIAN_EXPLANATION: В третьем лице единственного числа (he/she/it) в Present Simple мы используем 'doesn't' для отрицания, а не 'don't'. 'Don't' используется с I/you/we/they."

After several practice rounds:
Response: "GRAMMAR_GAME: Let's play a quick game! I'll say 3 sentences. One of them has a grammar mistake. Can you find it?
1. He works in a bank.
2. She don't like pizza.
3. They play football on weekends.

Which sentence has the mistake?"

Always maintain the lesson focus and progress from practice to games naturally.`;

      case 'freeTalk':
      default:
        return `You are Ava, a friendly English conversation tutor with mistake detection capabilities. Your role is to engage in natural conversation while helping users improve their English.

${baseProtocol}

EXAMPLES:
User: "I go to park yesterday"
Response: "MISTAKE_DETECTED: You meant: 'I went to the park yesterday'. We use past tense 'went' for finished actions in the past. Can you try saying it again? RUSSIAN_EXPLANATION: Вы использовали настоящее время 'go' вместо прошедшего времени 'went'. В английском языке для описания завершенных действий в прошлом мы используем прошедшее время. 'Go' превращается в 'went' в прошедшем времени. Также нужен артикль 'the' перед 'park', потому что мы говорим о конкретном парке."

User: "I went to the park yesterday"  
Response: "NO_MISTAKE: That sounds great! Do you often go to the park? What do you like to do there?"

Be encouraging, natural, and focus on communication while gently correcting mistakes. Always provide Russian explanations for mistakes.`;
    }
  }, []);

  const getInputPlaceholder = useCallback((feature: Feature) => {
    switch (feature) {
      case 'vocabulary':
        return "Type a word or ask for a new one...";
      case 'mistakes':
        return "Paste text to review for mistakes...";
      case 'grammar':
        return "Ask a grammar question or provide a sentence...";
      case 'freeTalk':
      default:
        return "Type your English here...";
    }
  }, []);

  const parseAIResponse = (responseText: string, userInput: string) => {
    const mistakeId = Date.now().toString();
    const gameId = Date.now().toString();

    console.log('Parsing AI response:', responseText); // Debug log

    // Handle lesson detection
    if (responseText.startsWith('LESSON_DETECTED:')) {
      const lessonMatch = responseText.match(/LESSON_DETECTED:\s*([^.]+)\./);
      if (lessonMatch) {
        const detectedLesson = lessonMatch[1].trim();
        setCurrentGrammarLesson(detectedLesson);
        setGrammarSessionStart(new Date());
        setPracticeCount(0);
        console.log('Detected grammar lesson:', detectedLesson);
      }

      // Continue parsing the rest of the response
      const remainingContent = responseText.replace(/LESSON_DETECTED:[^!]+!/, '').trim();

      if (remainingContent.startsWith('NO_MISTAKE:')) {
        const content = remainingContent.replace('NO_MISTAKE:', '').trim();
        return {
          sender: 'ai' as const,
          text: `Great! You're currently working on the ${currentGrammarLesson || 'grammar'} lesson. Let's practice it together! ${content}`,
          hasMistake: false
        };
      }
    }

    // Handle grammar games
    if (responseText.startsWith('GRAMMAR_GAME:')) {
      const gameContent = responseText.replace('GRAMMAR_GAME:', '').trim();
      setWaitingForGameAnswer(gameId);

      return {
        sender: 'ai' as const,
        text: gameContent,
        hasMistake: false,
        isGamePrompt: true,
        gameId: gameId
      };
    }

    if (responseText.startsWith('MISTAKE_DETECTED:')) {
      const content = responseText.replace('MISTAKE_DETECTED:', '').trim();

      // Split by RUSSIAN_EXPLANATION to get English and Russian parts
      const parts = content.split('RUSSIAN_EXPLANATION:');
      const englishPart = parts[0].trim();
      const russianPart = parts[1] ? parts[1].trim() : '';

      // console.log('English part:', englishPart); // Debug log
      // console.log('Russian part:', russianPart); // Debug log

      // Try to extract corrected text (look for text between quotes or single quotes)
      const correctedMatch = englishPart.match(/['"]([^'"]+)['"]/);
      const correctedText = correctedMatch ? correctedMatch[1] : '';

      // Extract the brief explanation with more flexible matching
      let explanation = '';

      // Try different patterns to extract explanation
      const patterns = [
        /\. (.+?)\. Can you try saying it again\?/,
        /\. (.+?)\. RUSSIAN_EXPLANATION:/,
        /['"]([^'"]+)['"]\.?\s*(.+?)\.\s*Can you try saying it again\?/,
        /['"]([^'"]+)['"]\.?\s*(.+?)\.\s*RUSSIAN_EXPLANATION:/
      ];

      for (const pattern of patterns) {
        const match = englishPart.match(pattern);
        if (match) {
          explanation = match[1] || match[2] || '';
          break;
        }
      }

      // If no explanation found with patterns, extract text between corrected quote and "Can you try"
      if (!explanation && correctedText) {
        const afterCorrection = englishPart.split(`"${correctedText}"`)[1] || englishPart.split(`'${correctedText}'`)[1];
        if (afterCorrection) {
          const explanationMatch = afterCorrection.match(/\.?\s*(.+?)\.\s*Can you try saying it again/);
          explanation = explanationMatch ? explanationMatch[1].trim() : '';
        }
      }

      console.log('Extracted explanation:', explanation); // Debug log
      console.log('Extracted corrected text:', correctedText); // Debug log

      return {
        sender: 'ai' as const,
        text: englishPart,
        hasMistake: true,
        originalText: userInput,
        correctedText: correctedText,
        explanation: explanation,
        explanationRussian: russianPart,
        isRetryPrompt: true,
        mistakeId: mistakeId
      };
    } else if (responseText.startsWith('NO_MISTAKE:')) {
      const content = responseText.replace('NO_MISTAKE:', '').trim();

      // Remove any Russian explanation part for NO_MISTAKE responses
      const englishOnlyContent = content.split('RUSSIAN_EXPLANATION:')[0].trim();

      return {
        sender: 'ai' as const,
        text: englishOnlyContent,
        hasMistake: false
      };
    } else {
      // Fallback for responses that don't follow the format
      return {
        sender: 'ai' as const,
        text: responseText,
        hasMistake: false
      };
    }
  };

  const sendMessage = async (overrideInput: string = input, autoSpeak = false, isRetryAttempt = false) => {
    if (overrideInput.trim() === '') return;

    const userMessage: Message = { sender: 'user', text: overrideInput };
    setMessages(prev => [...prev, userMessage]);

    if (!autoSpeak) {
      setInput('');
    }
    setIsSending(true);
    if (autoSpeak) {
      setIsAutoSpeaking(true);
    }

    // Clear retry state if this is a retry attempt
    if (isRetryAttempt) {
      setWaitingForRetry(null);
    }

    try {
      // Insert user message to database first
      await supabase.from('ChatHistory').insert([
        {
          user_id: user?.id,
          content: overrideInput,
          feature: currentFeature,
          sender: "user",
          created_at: new Date().toISOString()
        }
      ]);

      // Show AI typing indicator
      setMessages(prev => [...prev, { sender: 'ai', text: 'Ava is typing...', isTyping: true }]);

      // Get comprehensive chat history from database
      const { data: chatHistory, error: historyError } = await supabase
        .from('ChatHistory')
        .select('*')
        .eq('user_id', user?.id)
        .eq('feature', currentFeature)
        .order('created_at', { ascending: true });

      if (historyError) {
        console.error('Error fetching chat history:', historyError);
      }

      // Create comprehensive prompt using chat history
      let promptWithHistory = '';
      let conversationContext = [];

      if (chatHistory && chatHistory.length > 0) {
        // Build conversation context for API
        conversationContext = chatHistory.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

        // Create a summary of the conversation for system instruction
        const recentHistory = chatHistory.slice(-10); // Last 10 messages for context
        const historyText = recentHistory
          .map(msg => `${msg.sender === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`)
          .join('\n');

        // Enhanced system instruction with conversation context
        const baseInstruction = getPromptPrefix(currentFeature);

        // Add grammar session context if in grammar mode
        let grammarSessionContext = '';
        if (currentFeature === 'grammar') {
          const sessionDuration = grammarSessionStart ?
            Math.floor((Date.now() - grammarSessionStart.getTime()) / 1000 / 60) : 0;

          grammarSessionContext = `
GRAMMAR SESSION STATUS:
- Current lesson: ${currentGrammarLesson || 'Not detected yet'}
- Practice interactions: ${practiceCount}
- Session duration: ${sessionDuration} minutes
- Waiting for game answer: ${waitingForGameAnswer ? 'Yes' : 'No'}

SESSION MANAGEMENT:
${practiceCount >= 8 && sessionDuration >= 8 ?
              '- TIME FOR GAME: Switch to grammar game mode with 3 sentences' :
              '- PRACTICE MODE: Continue practicing the current grammar topic'
            }
${waitingForGameAnswer ? '- GAME ACTIVE: User should identify the incorrect sentence' : ''}`;
        }

        promptWithHistory = `${baseInstruction}

CONVERSATION CONTEXT:
This is an ongoing conversation. Here's the recent chat history:

${historyText}

${grammarSessionContext}

CONTINUATION GUIDELINES:
- Reference previous topics and discussions naturally
- Build upon concepts already covered in this conversation
- Maintain consistency with your previous responses and teaching approach
- Acknowledge the student's learning progress and patterns
- Continue the natural flow of the conversation
- If the student asks about something discussed before, reference that context

${isRetryAttempt ? 'NOTE: This is a retry attempt after a mistake correction. Be encouraging about their improvement.' : ''}

Current student input: "${overrideInput}"

Respond as Ava, continuing this educational conversation naturally while incorporating the context above.`;

      } else {
        // First message - use basic prompt
        promptWithHistory = getPromptPrefix(currentFeature);
        conversationContext = [{ role: 'user', parts: [{ text: overrideInput }] }];
      }

      // Fix: Add validation for API URL before making request
      if (!Public_URL) {
        throw new Error('API URL is not configured. Please check your environment variables.');
      }

      const apiUrl = `${Public_URL}/chat`;
      console.log("API URL:", apiUrl);
      console.log("User input:", overrideInput);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({
          question: overrideInput + promptWithHistory,
          chat_history: chatHistory,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || 'Unknown error';

        // Handle specific error cases
        if (response.status === 503 && errorMessage.includes('overloaded')) {
          throw new Error('MODEL_OVERLOADED: The AI service is currently busy. Please try again in a few moments.');
        } else if (response.status === 429) {
          throw new Error('RATE_LIMIT: Too many requests. Please wait a moment before trying again.');
        } else if (response.status >= 500) {
          throw new Error('SERVER_ERROR: The AI service is experiencing technical difficulties. Please try again later.');
        } else {
          throw new Error(`API Error: ${response.status} - ${errorMessage}`);
        }
      }

      const result = await response.json();
      const aiResponseText = result.answer;

      if (!aiResponseText) {
        throw new Error('Could not get a valid response from the AI.');
      }

      // Parse AI response for mistake detection
      const aiMessage: Message = parseAIResponse(aiResponseText, overrideInput);

      // Set waiting for retry if mistake detected
      if (aiMessage.hasMistake && aiMessage.mistakeId) {
        setWaitingForRetry(aiMessage.mistakeId);
      }

      // Handle grammar session management
      if (currentFeature === 'grammar') {
        if (!aiMessage.isGamePrompt && !waitingForGameAnswer) {
          setPracticeCount(prev => prev + 1);
        }

        if (waitingForGameAnswer && !aiMessage.isGamePrompt) {
          setWaitingForGameAnswer(null);
        }
      }

      // Save AI response to database
      await supabase.from('ChatHistory').insert([
        {
          user_id: user?.id,
          content: aiResponseText,
          feature: currentFeature,
          sender: "ai",
          created_at: new Date().toISOString()
        }
      ]);

      // Display AI response
      setMessages(prev => [
        ...prev.filter(m => !m.isTyping),
        aiMessage
      ]);

    } catch (error: unknown) {
      console.error("Error during sendMessage:", error);

      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('API URL is not configured')) {
          errorMessage = '🔧 API URL не настроен. Проверьте переменные окружения.';
        } else if (error.message.includes('MODEL_OVERLOADED:')) {
          errorMessage = '🤖 AI сервис сейчас перегружен. Пожалуйста, попробуйте через несколько секунд.';
        } else if (error.message.includes('RATE_LIMIT:')) {
          errorMessage = '⏱️ Слишком много запросов. Подождите немного перед следующей попыткой.';
        } else if (error.message.includes('SERVER_ERROR:')) {
          errorMessage = '🔧 AI сервис испытывает технические трудности. Попробуйте позже.';
        } else {
          errorMessage = `Ошибка: ${error.message}`;
        }
      }

      setMessages(prev => [
        ...prev.filter(m => !m.isTyping),
        {
          sender: 'ai',
          text: errorMessage,
          hasMistake: false
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryAttempt = () => {
    // Clear the input and enable voice or text input for retry
    setInput('');
    setWaitingForRetry(null);
  };

  const handleMistakeExplanation = (mistakeId: string, message: Message) => {
    // Show detailed explanation popup
    setShowMistakeExplanation(mistakeId);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSending && input.trim() !== '') {
      const isRetry = waitingForRetry !== null;
      sendMessage(input, false, isRetry);
    }
  };

  const handleFeatureClick = (feature: Feature) => {
    setCurrentFeature(feature);
    // Load chat history for the selected feature
    loadChatHistory(feature);
    setInput('');
    if (isListening) recognitionRef.current?.stop();

    // Reset grammar session state when switching features
    if (feature !== 'grammar') {
      setGrammarSessionStart(null);
      setCurrentGrammarLesson(null);
      setPracticeCount(0);
      setWaitingForGameAnswer(null);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setInput('');
      console.log('Initiating speech recognition...');

      // Check microphone permissions before starting
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            try {
              recognitionRef.current?.start();
            } catch (error) {
              console.error('Error starting speech recognition:', error);
              setMessages(prev => [...prev, {
                sender: 'ai',
                text: 'Could not start speech recognition. Please try again.'
              }]);
            }
          })
          .catch((error) => {
            console.error('Microphone access denied:', error);
            setMessages(prev => [...prev, {
              sender: 'ai',
              text: 'Microphone access is required for voice input. Please enable microphone permissions in your browser settings.'
            }]);
          });
      } else {
        // Fallback for browsers without getUserMedia
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error starting speech recognition:', error);
          setMessages(prev => [...prev, {
            sender: 'ai',
            text: 'Could not start speech recognition. Please try again.'
          }]);
        }
      }
    } else if (isListening) {
      console.log('Speech recognition already active');
    }
  };



  const speakText = async (text: string) => {
    try {
      // Use Google Cloud Text-to-Speech API
      const GOOGLE_TTS_API_KEY = 'AIzaSyC_aLb8euhjbG-MWQhfZq9reI8Y9so3LV4';
      
      // Get selected voice configuration
      const selectedVoiceConfig = voiceOptions.find(voice => voice.id === voiceSettings.selectedVoice);
      const voiceName = selectedVoiceConfig?.id || 'en-US-Journey-F';
      const voiceGender = selectedVoiceConfig?.gender || 'FEMALE';
      const languageCode = voiceSettings.language || 'en-US';
      
      // Prepare the request payload for Google Cloud TTS
      const requestBody = {
        input: {
          text: text
        },
        voice: {
          languageCode: languageCode,
          name: voiceName,
          ssmlGender: voiceGender
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: voiceSettings.speed,
          pitch: voiceSettings.pitch,
          volumeGainDb: 0.0,
          effectsProfileId: voiceSettings.audioProfile !== 'default' ? [voiceSettings.audioProfile] : undefined
        }
      };

      console.log('Using Google Cloud TTS for:', text, 'with voice:', voiceName);

      // Make request to Google Cloud TTS API
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Google TTS API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.audioContent) {
        throw new Error('No audio content received from Google TTS API');
      }

      // Convert base64 audio to blob and play it
      const audioData = atob(data.audioContent);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i);
      }

      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      
      audio.onloadeddata = () => console.log('Google TTS audio loaded');
      audio.onended = () => {
        console.log('Google TTS playback ended');
        URL.revokeObjectURL(audioUrl); // Clean up
      };
      audio.onerror = (error) => console.error('Google TTS playback error:', error);

      await audio.play();

    } catch (error) {
      console.error("Error in Google Cloud TTS:", error);
      
      // Fallback to browser speech synthesis if Google TTS fails
      console.log("Falling back to browser speech synthesis");
      try {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.85;
          utterance.pitch = 1.1;
          utterance.volume = 0.8;
          window.speechSynthesis.speak(utterance);
        }
      } catch (fallbackError) {
        console.error("Fallback TTS also failed:", fallbackError);
      }
    }
  };

  // Function to test a specific voice with sample text and custom settings
  const testVoice = async (voiceId: string, customSpeed?: number, customPitch?: number): Promise<boolean> => {
    try {
      const testText = "Hello! I'm Ava, your English coach. This is how I sound with this voice.";
      
      // Get voice configuration
      const voiceConfig = voiceOptions.find(voice => voice.id === voiceId);
      const voiceName = voiceConfig?.id || voiceId;
      const voiceGender = voiceConfig?.gender || 'FEMALE';
      
      // Prepare the request payload for Google Cloud TTS
      const requestBody = {
        input: {
          text: testText
        },
        voice: {
          languageCode: 'en-US',
          name: voiceName,
          ssmlGender: voiceGender
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: customSpeed !== undefined ? customSpeed : voiceSettings.speed,
          pitch: customPitch !== undefined ? customPitch : voiceSettings.pitch,
          volumeGainDb: 0.0,
          effectsProfileId: voiceSettings.audioProfile !== 'default' ? [voiceSettings.audioProfile] : undefined
        }
      };

      console.log('Testing voice:', voiceName);

      // Make request to Google Cloud TTS API
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Google TTS API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.audioContent) {
        throw new Error('No audio content received from Google TTS API');
      }

      // Convert base64 audio to blob and play it
      const audioData = atob(data.audioContent);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i);
      }

      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      
      audio.onloadeddata = () => console.log('Voice test audio loaded for:', voiceName);
      audio.onended = () => {
        console.log('Voice test playback ended for:', voiceName);
        URL.revokeObjectURL(audioUrl); // Clean up
      };
      audio.onerror = (error) => console.error('Voice test playback error:', error);

      await audio.play();
      return true;

    } catch (error) {
      console.error("Error testing voice:", error);
      return false;
    }
  };

  // Handle voice settings changes
  const handleVoiceSettingsChange = (newSettings: typeof voiceSettings) => {
    setVoiceSettings(newSettings);
  };

  const renderMarkdown = (text: string) => {
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br />');
    return { __html: html };
  };

  const getPrimaryButtonAction = () => {
    if (isListening) return () => recognitionRef.current?.stop();
    if (input.trim() !== '') return () => {
      const isRetry = waitingForRetry !== null;
      sendMessage(input, false, isRetry);
    };
    return startListening;
  };

  const getPrimaryButtonIcon = () => {
    if (isListening) return <MicrophoneIcon isListening />;
    if (input.trim() !== '') return <SendIcon />;
    return <MicrophoneIcon />;
  };

  const features: { id: Feature, name: string }[] = [
    { id: 'freeTalk', name: 'Free Talk' },
    { id: 'vocabulary', name: 'Vocabulary' },
    { id: 'grammar', name: 'Grammar' },
    { id: 'mistakes', name: 'Review' }

  ];

  if (!isOpen) return null;

  // Upload file to Supabase storage
  const uploadFileToStorage = async (file: File): Promise<string> => {
    // Check if user is authenticated before proceeding
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file);
    if (error) {
      throw error;
    }

    const formData = new FormData();
    formData.append('file', file);
    // formData.append('user_id', user.id)

    const apiUrl = `${Public_URL}/upload-file`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    });
    console.log(response)

    return data.path;
  };

  // Handle file upload to storage
  // Handle file upload to storage
  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);

    // Add user message showing file upload info
    const userMessage: Message = {
      sender: 'user',
      text: `Uploaded file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      hasAttachment: false
    };

    await supabase.from('ChatHistory').insert([
      {
        user_id: user?.id,
        content: `Uploaded file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        feature: currentFeature,
        sender: "user",
        created_at: new Date().toISOString()
      }
    ]);

    setMessages(prev => [...prev, userMessage]);

    try {
      // Check authentication first
      if (!user?.id) {
        throw new Error('Authentication required');
      }

      // Upload file to Supabase storage
      const filePath = await uploadFileToStorage(file);

      // Get the public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Add success message to chat
      const successMessage: Message = {
        sender: 'ai',
        text: `✅ File "${file.name}" has been successfully uploaded to your documents! You can access it anytime from your storage.`,
        hasAttachment: false
      };

      await supabase.from('ChatHistory').insert([
        {
          user_id: user?.id,
          content: `✅ File "${file.name}" has been successfully uploaded to your documents! You can access it anytime from your storage.`,
          feature: currentFeature,
          sender: "ai",
          created_at: new Date().toISOString()
        }
      ]);

      setMessages(prev => [...prev, successMessage]);

      // Save file reference to database for later retrieval
      const { error: dbError } = await supabase.from('Document').insert([
        {
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          public_url: publicUrlData.publicUrl,
          created_at: new Date().toISOString()
        }
      ]);

      if (dbError) {
        console.error('Database error:', dbError);
        // Don't throw error here, just log it since file was uploaded successfully
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      let errorMessage = 'Sorry, I encountered an error while uploading your file. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Authentication required') || error.message.includes('User not authenticated')) {
          errorMessage = 'Please sign in to upload files.';
        } else if (error.message.includes('row-level security')) {
          errorMessage = 'Upload permission denied. Please make sure you are properly authenticated.';
        } else if (error.message.includes('file too large')) {
          errorMessage = 'File is too large. Please try a smaller file.';
        } else if (error.message.includes('invalid file type')) {
          errorMessage = 'File type not supported. Please try a different file format.';
        }
      }

      setMessages(prev => [...prev, {
        sender: 'ai',
        text: errorMessage
      }]);
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-12 w-full max-w-md h-[70vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden z-50">
      <ChatHeader 
        onClose={onClose} 
        selectedVoice={selectedVoice}
        voiceOptions={voiceOptions}
        onVoiceChange={setSelectedVoice}
        onTestVoice={testVoice}
        onOpenVoiceSettings={() => setShowVoiceSettings(true)}
      />
      <FeatureButtons features={features} currentFeature={currentFeature} onFeatureClick={handleFeatureClick} />

      {/* Grammar lesson indicator */}
      {currentFeature === 'grammar' && currentGrammarLesson && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="text-xs text-blue-700 flex items-center justify-between">
            <span>📖 Урок: <strong>{currentGrammarLesson}</strong></span>
            <span>🎯 Практика: {practiceCount}/8</span>
          </div>
        </div>
      )}

      {/* Show uploading indicator */}
      {uploadingFile && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100">
          <div className="text-xs text-yellow-700 flex items-center">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-yellow-600 mr-2"></div>
            Processing file...
          </div>
        </div>
      )}

      {/* Show loading state when loading history */}
      {isLoadingHistory ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Loading chat history...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2 rounded-lg ${message.sender === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.isTyping
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                {message.isTyping ? (
                  <div className="flex items-center space-x-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm">{message.text}</span>
                  </div>
                ) : (
                  <div>
                    {/* Show attachment indicator */}
                    {message.hasAttachment && (
                      <div className="mb-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center">
                        <DocumentUploadIcon />
                        <span className="ml-1">{message.attachmentName}</span>
                      </div>
                    )}

                    <div dangerouslySetInnerHTML={renderMarkdown(message.text)} />

                    {/* Show mistake correction buttons for all features */}
                    {message.hasMistake && message.mistakeId && (
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={() => handleMistakeExplanation(message.mistakeId!, message)}
                          className="block w-full text-xs bg-red-100 text-red-700 px-3 py-1 rounded border border-red-200 hover:bg-red-200 transition-colors"
                        >
                          📚 Объяснить эту ошибку
                        </button>
                        {waitingForRetry === message.mistakeId && (
                          <div className="text-xs text-gray-600 italic">
                            💡 Попробуйте сказать это правильно голосом или текстом
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show grammar game indicator */}
                    {message.isGamePrompt && message.gameId && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">
                          🎮 Грамматическая игра - найдите предложение с ошибкой!
                        </div>
                        {waitingForGameAnswer === message.gameId && (
                          <div className="text-xs text-blue-600 italic">
                            🎯 Введите номер предложения с ошибкой (1, 2 или 3)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <ChatInput
        input={input}
        onInputChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={
          uploadingFile ? "Processing file..." :
            waitingForRetry ? "Попробуйте сказать это снова..." :
              waitingForGameAnswer ? "Введите номер предложения с ошибкой (1, 2 или 3)..." :
                getInputPlaceholder(currentFeature)
        }
        isSending={isSending || uploadingFile}
        isListening={isListening}
        onPrimaryAction={getPrimaryButtonAction()}
        primaryActionIcon={getPrimaryButtonIcon()}
        primaryActionTitle={isListening ? 'Остановить Слушание' : (input.trim() !== '' ? 'Отправить Сообщение' : 'Начать Говорить')}
        onFileUpload={handleFileUpload}
        acceptedFileTypes=".txt,.pdf,.doc,.docx,.md,image/*"
      />

      {/* Mistake Explanation Modal */}
      {showMistakeExplanation && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-red-600 mb-3">📚 Объяснение ошибки</h3>
            {(() => {
              const message = messages.find(m => m.mistakeId === showMistakeExplanation);
              return message ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Оригинал:</p>
                    <p className="text-sm text-red-600 italic bg-red-50 p-2 rounded">&ldquo;{message.originalText}&rdquo;</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Исправлено:</p>
                    <p className="text-sm text-green-600 font-medium bg-green-50 p-2 rounded">&ldquo;{message.correctedText}&rdquo;</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Объяснение:</p>
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded leading-relaxed">
                      {message.explanationRussian ? (
                        message.explanationRussian
                      ) : message.explanation ? (
                        <div>
                          <p className="mb-2 text-orange-600 text-xs">⚠️ Русский перевод недоступен, показано на английском:</p>
                          <p>{message.explanation}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-red-500">❌ Объяснение недоступно</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Попробуйте спросить Аву: &ldquo;Объясни мне эту ошибку по-русски&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
            <button
              onClick={() => setShowMistakeExplanation(null)}
              className="mt-4 w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
            >
              Понятно!
            </button>
          </div>
        </div>
      )}

      {/* Voice Settings Modal */}
      <VoiceSettingsModal
        isOpen={showVoiceSettings}
        onClose={() => setShowVoiceSettings(false)}
        voiceOptions={voiceOptions}
        currentSettings={voiceSettings}
        onSettingsChange={handleVoiceSettingsChange}
        onTestVoice={testVoice}
      />
    </div>
  );
};

export default function Page() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication page if user is not signed in
  if (!user) {
    return <AuthPage />;
  }

  // Show main page content if user is signed in
  return (
    <div className="relative w-full h-screen overflow-hidden">
      <iframe
        src="https://www.thinkific.com/"
        title="Thinkific Content"
        className="w-full h-full border-none"
        allowFullScreen
      ></iframe>

      {/* User Profile - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <UserProfile />
      </div>

      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-14 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition duration-300 ease-in-out transform hover:scale-110 z-50"
        title="Toggle AI English Coach"
      >
        {isChatOpen ? <LargeCloseIcon /> : <ChatIcon />}
      </button>

      {/* Chat Widget */}
      <AIChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
};
