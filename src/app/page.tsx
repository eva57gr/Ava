'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatHeader from './components/ChatHeader';
import FeatureButtons from './components/FeatureButtons';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import AuthModal from './components/auth/AuthModal';
import AuthPage from './components/auth/AuthPage';
import UserProfile from './components/auth/UserProfile';
import { LargeCloseIcon, ChatIcon, MicrophoneIcon, SendIcon } from './components/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { createSupabaseClient } from '@/lib/supabase';
import { Content } from 'next/font/google';




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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const supabase = createSupabaseClient();
  const { user } = useAuth();

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
              if (i > 0 && chatHistory[i-1].sender === 'user') {
                userInput = chatHistory[i-1].content;
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
        return `You are Ava, an English grammar tutor with mistake detection capabilities. Your role is to help users understand and correctly use English grammar.

${baseProtocol}

GRAMMAR-SPECIFIC GUIDELINES:
- If NO_MISTAKE: Acknowledge their correct grammar, then answer their grammar question or explain the grammar in their sentence
- Focus on grammar rules, tenses, sentence structure, and proper usage
- When explaining grammar, provide clear rules and multiple examples
- Help them understand the 'why' behind grammar rules

EXAMPLES:
User: "When should I used past tense?"
Response: "MISTAKE_DETECTED: You meant: 'When should I use past tense?' After modal verbs like 'should', we use the base form of the verb, not past tense. Can you try saying it again? RUSSIAN_EXPLANATION: После модальных глаголов типа 'should', 'can', 'will' мы всегда используем базовую форму глагола, а не прошедшее время. Правильно: 'should use', а не 'should used'."

User: "When should I use past tense?"
Response: "NO_MISTAKE: Great grammar question! You use past tense to describe actions that happened and finished in the past. For example: 'I walked to school yesterday' or 'She studied English last night'. There are different types: simple past (walked), past continuous (was walking), and past perfect (had walked). Which type would you like to learn about?"

Always explain grammar rules clearly with examples and encourage practice.`;

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
    
    console.log('Parsing AI response:', responseText); // Debug log
    
    if (responseText.startsWith('MISTAKE_DETECTED:')) {
      const content = responseText.replace('MISTAKE_DETECTED:', '').trim();
      
      // Split by RUSSIAN_EXPLANATION to get English and Russian parts
      const parts = content.split('RUSSIAN_EXPLANATION:');
      const englishPart = parts[0].trim();
      const russianPart = parts[1] ? parts[1].trim() : '';
      
      console.log('English part:', englishPart); // Debug log
      console.log('Russian part:', russianPart); // Debug log
      
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
      return {
        sender: 'ai' as const,
        text: content,
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
        .order('created_at', { ascending: true}); // Get all history in chronological order

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
        promptWithHistory = `${baseInstruction}

CONVERSATION CONTEXT:
This is an ongoing conversation. Here's the recent chat history:

${historyText}

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
      
      // Make API call to Gemini with enhanced context
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key is not configured.');

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
      
      console.log('promptWithHistory---------------------------', promptWithHistory);
      console.log('conversationContext---------------------------', conversationContext);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: conversationContext.length > 1 ? conversationContext : [{ role: 'user', parts: [{ text: overrideInput }] }],
          systemInstruction: { parts: [{ text: promptWithHistory }] }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const result = await response.json();
      const aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!aiResponseText) {
        throw new Error('Could not get a valid response from the AI.');
      }

      // Parse AI response for mistake detection (now for all features)
      let aiMessage: Message;
      aiMessage = parseAIResponse(aiResponseText, overrideInput);

      // Set waiting for retry if mistake detected (for all features now)
      if (aiMessage.hasMistake && aiMessage.mistakeId) {
        setWaitingForRetry(aiMessage.mistakeId);
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
      const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      setMessages(prev => [
        ...prev.filter(m => !m.isTyping), 
        { sender: 'ai', text: errorMessage }
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
  
  const speakText = (text: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    } catch (error) {
      console.error("Error in speakText:", error);
    }
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

  return (
    <div className="fixed bottom-4 right-12 w-full max-w-md h-[70vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden z-50">
      <ChatHeader onClose={onClose} />
      <FeatureButtons features={features} currentFeature={currentFeature} onFeatureClick={handleFeatureClick} />
      
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
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.sender === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : message.isTyping 
                    ? 'bg-gray-100 text-gray-600' 
                    : 'bg-gray-100 text-gray-800'
              }`}>
                {message.isTyping ? (
                  <div className="flex items-center space-x-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm">{message.text}</span>
                  </div>
                ) : (
                  <div>
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
        placeholder={waitingForRetry ? "Попробуйте сказать это снова..." : getInputPlaceholder(currentFeature)}
        isSending={isSending}
        isListening={isListening}
        onPrimaryAction={getPrimaryButtonAction()}
        primaryActionIcon={getPrimaryButtonIcon()}
        primaryActionTitle={isListening ? 'Остановить Слушание' : (input.trim() !== '' ? 'Отправить Сообщение' : 'Начать Говорить')}
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
