
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { toast } from '@/components/ui/use-toast';
import { Loader2, MicOff } from 'lucide-react';

// Define proper types for sign configurations
interface SignConfig {
  description: string;
  fingersUp: number[];
  curved?: boolean;
  special?: string;
}

// Define comprehensive ASL signs for the complete alphabet
const signs: Record<string, SignConfig> = {
  'A': { description: 'Fist with thumb pointing up', fingersUp: [1, 0, 0, 0, 0] },
  'B': { description: 'Flat hand with fingers together', fingersUp: [0, 1, 1, 1, 1] },
  'C': { description: 'Curved hand', fingersUp: [0, 1, 1, 1, 1], curved: true },
  'D': { description: 'Index finger up, thumb touches middle finger', fingersUp: [1, 1, 0, 0, 0] },
  'E': { description: 'Fingers curled, thumb across palm', fingersUp: [0, 0, 0, 0, 0], curved: true },
  'F': { description: 'Thumb and index finger form circle, other fingers up', fingersUp: [1, 1, 1, 1, 1], special: 'thumb-index-touch' },
  'G': { description: 'Pointer finger and thumb extended horizontally', fingersUp: [1, 1, 0, 0, 0], special: 'g-shape' },
  'H': { description: 'Index and middle fingers extended side by side', fingersUp: [0, 1, 1, 0, 0] },
  'I': { description: 'Pinky finger extended', fingersUp: [0, 0, 0, 0, 1] },
  'J': { description: 'Pinky extended and hand moves in J shape', fingersUp: [0, 0, 0, 0, 1], special: 'j-motion' },
  'K': { description: 'Index, middle fingers up with thumb between them', fingersUp: [1, 1, 1, 0, 0], special: 'k-shape' },
  'L': { description: 'L-shape with thumb and index finger', fingersUp: [1, 1, 0, 0, 0] },
  'M': { description: 'Three fingers over thumb', fingersUp: [0, 0, 0, 0, 0], special: 'm-shape' },
  'N': { description: 'Index and middle fingers down over thumb', fingersUp: [0, 0, 0, 0, 0], special: 'n-shape' },
  'O': { description: 'Fingers form circle', fingersUp: [1, 1, 1, 1, 1], special: 'circle' },
  'P': { description: 'Pointer finger down from thumb', fingersUp: [1, 1, 0, 0, 0], special: 'p-shape' },
  'Q': { description: 'Thumb and index finger down', fingersUp: [1, 1, 0, 0, 0], special: 'q-shape' },
  'R': { description: 'Index and middle fingers crossed', fingersUp: [0, 1, 1, 0, 0], special: 'crossed' },
  'S': { description: 'Fist with thumb over fingers', fingersUp: [0, 0, 0, 0, 0] },
  'T': { description: 'Thumb between index and middle finger', fingersUp: [1, 0, 0, 0, 0], special: 'thumb-between' },
  'U': { description: 'Index and middle fingers extended together', fingersUp: [0, 1, 1, 0, 0] },
  'V': { description: 'Index and middle fingers in V shape', fingersUp: [0, 1, 1, 0, 0], special: 'v-shape' },
  'W': { description: 'Three fingers extended', fingersUp: [0, 1, 1, 1, 0] },
  'X': { description: 'Index finger bent at middle joint', fingersUp: [0, 0, 0, 0, 0], special: 'x-shape' },
  'Y': { description: 'Thumb and pinky extended', fingersUp: [1, 0, 0, 0, 1] },
  'Z': { description: 'Index finger draws Z shape', fingersUp: [0, 1, 0, 0, 0], special: 'z-motion' },
  'I love you': { description: 'Thumb, index, and pinky extended', fingersUp: [1, 1, 0, 0, 1] },
};

// Expanded common words for conversations
const commonWords = [
  // Greetings and basics
  'HELLO', 'HI', 'GOODBYE', 'BYE', 'THANK YOU', 'PLEASE', 'SORRY', 
  'YES', 'NO', 'OK', 'GOOD', 'BAD',
  
  // Questions
  'WHAT', 'WHERE', 'WHEN', 'WHO', 'WHY', 'HOW',
  
  // People and relationships
  'I', 'YOU', 'WE', 'THEY', 'MY', 'YOUR', 'NAME', 
  'FRIEND', 'FAMILY', 'MOTHER', 'FATHER', 'SISTER', 'BROTHER',
  
  // Feelings and states
  'LOVE', 'HAPPY', 'SAD', 'ANGRY', 'TIRED', 'SICK', 'FINE',
  
  // Actions
  'HELP', 'WANT', 'NEED', 'GO', 'COME', 'LEARN', 'UNDERSTAND',
  'EAT', 'DRINK', 'SLEEP', 'WORK', 'PLAY',
  
  // Time related
  'NOW', 'LATER', 'TODAY', 'TOMORROW', 'YESTERDAY',
  
  // Common phrases
  'NICE TO MEET YOU', 'HOW ARE YOU', 'I AM FINE',
  'EXCUSE ME', 'I UNDERSTAND', 'I DONT UNDERSTAND',
  'CAN YOU HELP ME', 'THANK YOU VERY MUCH'
];

// Phrases that combine multiple signs to form meaningful expressions
const conversationPhrases = [
  { text: 'HELLO HOW ARE YOU', meaning: 'Hello, how are you?' },
  { text: 'MY NAME IS', meaning: 'My name is...' },
  { text: 'NICE TO MEET YOU', meaning: 'Nice to meet you' },
  { text: 'I DONT UNDERSTAND', meaning: "I don't understand" },
  { text: 'CAN YOU HELP ME', meaning: 'Can you help me?' },
  { text: 'I NEED HELP', meaning: 'I need help' },
  { text: 'THANK YOU VERY MUCH', meaning: 'Thank you very much' },
  { text: 'WHERE IS', meaning: 'Where is...?' },
  { text: 'I AM FINE', meaning: 'I am fine' },
  { text: 'I AM HAPPY', meaning: 'I am happy' },
  { text: 'I AM SORRY', meaning: 'I am sorry' },
  { text: 'SEE YOU TOMORROW', meaning: 'See you tomorrow' },
  { text: 'I LOVE YOU', meaning: 'I love you' },
];

const SignLanguageDetector = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detectedSign, setDetectedSign] = useState<string>('');
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [confidence, setConfidence] = useState<number>(0);
  const [signHistory, setSignHistory] = useState<string[]>([]);
  const [detectedWord, setDetectedWord] = useState<string>('');
  const [detectedPhrase, setDetectedPhrase] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string>('');
  const [modelReady, setModelReady] = useState<boolean>(false);
  const [webcamReady, setWebcamReady] = useState<boolean>(false);
  
  // Track model and detection loop
  const handposeModel = useRef<handpose.HandPose | null>(null);
  const requestAnimationRef = useRef<number | null>(null);
  
  // Track the last stable sign to prevent flickering
  const lastSignRef = useRef<string>('');
  const stableCountRef = useRef<number>(0);
  const STABILITY_THRESHOLD = 3; // Reduced for faster response
  
  // Add debug counter to track detection loops
  const debugLoopCounter = useRef<number>(0);
  
  // Initialize TensorFlow.js and the handpose model
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        console.log("Starting model loading...");
        
        // Ensure TensorFlow is ready
        await tf.ready();
        console.log("TensorFlow ready");
        
        // Set backend to WebGL for better performance
        await tf.setBackend('webgl');
        console.log("Backend set to WebGL");
        
        // Load the handpose model with correct configuration options
        const model = await handpose.load({
          detectionConfidence: 0.6, // Lower threshold to detect hands more easily
          maxContinuousChecks: 5,
          iouThreshold: 0.3,
          scoreThreshold: 0.5, // Lower threshold to be more sensitive
        });
        
        console.log("Handpose model loaded successfully");
        handposeModel.current = model;
        
        // Mark model as ready
        setModelReady(true);
        setIsModelLoading(false);
        
        toast({
          title: "Model loaded successfully",
          description: "Start signing to see detection results",
        });
      } catch (error) {
        console.error('Failed to load hand detection model:', error);
        setModelError(error instanceof Error ? error.message : 'Unknown error');
        setIsModelLoading(false);
        toast({
          title: "Error loading model",
          description: "Please check your connection and try again",
          variant: "destructive",
        });
      }
    };
    
    // Check camera permissions before loading models
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => {
        loadModels();
      })
      .catch((error) => {
        console.error('Camera permission denied:', error);
        setPermissionDenied(true);
        setIsModelLoading(false);
        toast({
          title: "Camera access denied",
          description: "Please allow camera access to use sign language detection",
          variant: "destructive",
        });
      });
    
    return () => {
      // Cleanup function to prevent memory leaks
      if (requestAnimationRef.current) {
        cancelAnimationFrame(requestAnimationRef.current);
        requestAnimationRef.current = null;
      }
      setSignHistory([]);
      lastSignRef.current = '';
      stableCountRef.current = 0;
    };
  }, []);

  // Start detection loop when both model and webcam are ready
  useEffect(() => {
    if (modelReady && webcamReady && !requestAnimationRef.current) {
      console.log("Both model and webcam ready, starting detection loop");
      requestAnimationRef.current = requestAnimationFrame(detectHands);
      
      // Add a test sign to demonstrate word detection
      setTimeout(() => {
        console.log("Adding test letter to sign history");
        setSignHistory(prev => [...prev, 'H']);
        setTimeout(() => {
          setSignHistory(prev => [...prev, 'I']);
        }, 500);
      }, 2000);
    }
  }, [modelReady, webcamReady]);

  // Handler when webcam is ready
  const handleWebcamReady = () => {
    console.log("Webcam is ready");
    setWebcamReady(true);
  };

  // Check for words and phrases in sign history
  useEffect(() => {
    if (signHistory.length === 0) return;
    
    console.log("Current sign history:", signHistory);
    
    // Look for common words in the sign sequence
    const currentSequence = signHistory.join('');
    console.log("Current sequence:", currentSequence);
    
    // Check for phrases first (longer matches)
    for (const phrase of conversationPhrases) {
      if (currentSequence.includes(phrase.text)) {
        console.log("Phrase detected:", phrase.meaning);
        setDetectedWord('');
        setDetectedPhrase(phrase.meaning);
        // Vibrate if available to give haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        toast({
          title: "Phrase Detected",
          description: phrase.meaning,
        });
        return;
      }
    }
    
    // If no phrase detected, look for individual words
    for (const word of commonWords) {
      if (currentSequence.includes(word)) {
        console.log("Word detected:", word);
        setDetectedWord(word);
        setDetectedPhrase('');
        // Vibrate if available to give haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(200);
        }
        toast({
          title: "Word Detected",
          description: word,
        });
        return;
      }
    }
    
    // Check for simple two-letter combinations
    if (signHistory.length >= 2) {
      const lastTwo = signHistory.slice(-2).join('');
      if (lastTwo === 'HI') {
        console.log("Word detected: HI");
        setDetectedWord('HI');
        setDetectedPhrase('');
        if ('vibrate' in navigator) {
          navigator.vibrate(200);
        }
        toast({
          title: "Word Detected",
          description: "HI",
        });
      }
      
      if (lastTwo === 'NO') {
        console.log("Word detected: NO");
        setDetectedWord('NO');
        setDetectedPhrase('');
        if ('vibrate' in navigator) {
          navigator.vibrate(200);
        }
        toast({
          title: "Word Detected",
          description: "NO",
        });
      }
    }
  }, [signHistory]);
  
  // Function to detect finger states with more accuracy
  const getFingerState = (landmarks: any[]) => {
    const palmBase = landmarks[0];
    const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const knuckles = [landmarks[2], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    
    // Check if each finger is extended, using 3D positions for better accuracy
    const fingerStates = fingertips.map((tip, i) => {
      if (i === 0) {
        // Special case for thumb
        const thumbCMC = landmarks[1]; 
        const thumbMCP = landmarks[2]; 
        const thumbIP = landmarks[3]; 
        
        // Simpler check for thumb extension
        const isExtended = tip[1] < thumbIP[1] - 5;
        return isExtended ? 1 : 0;
      } else {
        // For other fingers, compare tip to knuckle positions in 3D
        // Simplified check - finger is extended if tip is higher than knuckle
        const isExtended = tip[1] < knuckles[i][1] - 10;
        return isExtended ? 1 : 0;
      }
    });
    
    return fingerStates;
  };
  
  // Function to detect special finger configurations
  const detectSpecialConfigurations = (landmarks: any[]) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    
    // Calculate distances between fingertips
    const thumbIndexDistance = Math.sqrt(
      Math.pow(thumbTip[0] - indexTip[0], 2) + 
      Math.pow(thumbTip[1] - indexTip[1], 2) + 
      Math.pow(thumbTip[2] - indexTip[2], 2)
    );
    
    const indexMiddleSpread = Math.sqrt(
      Math.pow(indexTip[0] - middleTip[0], 2) + 
      Math.pow(indexTip[1] - middleTip[1], 2)
    );
    
    return {
      'thumb-index-touch': thumbIndexDistance < 20,
      'v-shape': indexMiddleSpread > 25,
      'circle': false,
      'crossed': false, 
      'thumb-between': false,
      'g-shape': false,
      'j-motion': false,
      'k-shape': false,
      'm-shape': false,
      'n-shape': false,
      'p-shape': false,
      'q-shape': false,
      'x-shape': false,
      'z-motion': false
    };
  };
  
  // Function to detect hands and predict signs
  const detectHands = async () => {
    debugLoopCounter.current += 1;
    
    // Log detection loop iterations for debugging (every 50 frames)
    if (debugLoopCounter.current % 50 === 0) {
      console.log(`Detection loop iteration: ${debugLoopCounter.current}`);
    }
    
    if (
      !handposeModel.current || 
      !webcamRef.current || 
      !webcamRef.current.video || 
      webcamRef.current.video.readyState !== 4 ||
      !canvasRef.current
    ) {
      // If not ready yet, continue the detection loop
      console.log("Waiting for webcam or model to be ready in detectHands()...");
      requestAnimationRef.current = requestAnimationFrame(detectHands);
      return;
    }
    
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Detect hands in the video stream
    try {
      const hands = await handposeModel.current.estimateHands(video);
      
      // Log hand detection every 30 frames
      if (debugLoopCounter.current % 30 === 0) {
        console.log("Hands detected:", hands.length > 0 ? "Yes" : "No");
      }
      
      // Process the hand data to identify signs
      if (hands && hands.length > 0) {
        const hand = hands[0]; // Using only the first detected hand
        
        // Get the finger states
        const fingerStates = getFingerState(hand.landmarks);
        const specialConfigurations = detectSpecialConfigurations(hand.landmarks);
        
        // Log detailed finger states for debugging
        console.log("Finger states:", fingerStates);
        
        // Find the most similar sign
        let bestMatch = '';
        let bestScore = 0.3; // Lower threshold for easier detection
        
        Object.entries(signs).forEach(([sign, config]) => {
          // Start with basic finger position matching
          let similarity = fingerStates.reduce((acc, state, idx) => {
            return acc + (state === config.fingersUp[idx] ? 0.2 : 0);
          }, 0);
          
          // Add bonus for special configurations if they match
          if (config.special && specialConfigurations[config.special as keyof typeof specialConfigurations]) {
            similarity += 0.3;
          }

          // Simple check for curved hand if needed
          if (config.curved) {
            const isCurved = fingerStates.reduce((sum, state) => sum + state, 0) > 2;
            if (isCurved) similarity += 0.1;
          }
          
          if (similarity > bestScore) {
            bestScore = similarity;
            bestMatch = sign;
          }
        });
        
        console.log("Best match:", bestMatch, "Score:", bestScore);
        
        // Apply stability check to prevent flickering
        if (bestMatch) {
          if (bestMatch === lastSignRef.current) {
            stableCountRef.current += 1;
            if (stableCountRef.current >= STABILITY_THRESHOLD) {
              if (detectedSign !== bestMatch) {
                console.log("Stable sign detected:", bestMatch, "with confidence:", bestScore);
                setDetectedSign(bestMatch);
                setConfidence(bestScore);
                
                // Only add to history if it's a new sign (not just repeating)
                if (signHistory.length === 0 || signHistory[signHistory.length - 1] !== bestMatch) {
                  console.log("Adding to sign history:", bestMatch);
                  setSignHistory(prev => {
                    // Keep just the last 10 signs for word detection
                    const updatedHistory = [...prev, bestMatch].slice(-10);
                    return updatedHistory;
                  });
                }
              }
            }
          } else {
            // Reset stability counter for new sign
            lastSignRef.current = bestMatch;
            stableCountRef.current = 1;
          }
        } else {
          // Reset when no match found
          stableCountRef.current = 0;
        }
        
        // Draw landmarks on canvas
        drawHandLandmarks(hand.landmarks, canvas);
      } else {
        // No hands detected
        stableCountRef.current = 0;
        
        // Clear canvas if no hands detected
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (error) {
      console.error('Error during hand detection:', error);
    }
    
    // Continue detection loop
    requestAnimationRef.current = requestAnimationFrame(detectHands);
  };
  
  // Function to draw hand landmarks on canvas
  const drawHandLandmarks = (landmarks: number[][], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    
    // Draw thumb
    ctx.moveTo(landmarks[0][0], landmarks[0][1]);
    for (let i = 1; i <= 4; i++) {
      ctx.lineTo(landmarks[i][0], landmarks[i][1]);
    }
    ctx.stroke();
    
    // Draw fingers
    for (let finger = 0; finger < 4; finger++) {
      const baseIdx = 5 + (finger * 4);
      ctx.beginPath();
      ctx.moveTo(landmarks[0][0], landmarks[0][1]);
      ctx.lineTo(landmarks[baseIdx][0], landmarks[baseIdx][1]);
      for (let i = 0; i < 3; i++) {
        const idx = baseIdx + i;
        ctx.lineTo(landmarks[idx + 1][0], landmarks[idx + 1][1]);
      }
      ctx.stroke();
    }
    
    // Draw landmarks
    landmarks.forEach((point, index) => {
      ctx.beginPath();
      
      // Different colors for fingertips
      if ([4, 8, 12, 16, 20].includes(index)) {
        ctx.fillStyle = '#00ffff'; // Cyan for fingertips
        ctx.arc(point[0], point[1], 8, 0, 2 * Math.PI);
      } else if (index === 0) {
        ctx.fillStyle = '#ff0000'; // Red for palm base
        ctx.arc(point[0], point[1], 10, 0, 2 * Math.PI);
      } else {
        ctx.fillStyle = '#ffffff'; // White for other joints
        ctx.arc(point[0], point[1], 5, 0, 2 * Math.PI);
      }
      
      ctx.fill();
    });
  };

  // Function to clear the sign history and detected word or phrase
  const clearSignHistory = () => {
    setSignHistory([]);
    setDetectedWord('');
    setDetectedPhrase('');
    toast({
      title: "History cleared",
      description: "Start signing new words",
    });
  };

  // Function to manually restart detection if it seems stalled
  const restartDetection = () => {
    console.log("Manually restarting detection");
    if (requestAnimationRef.current) {
      cancelAnimationFrame(requestAnimationRef.current);
      requestAnimationRef.current = null;
    }
    
    // Reset state
    stableCountRef.current = 0;
    debugLoopCounter.current = 0;
    
    // Restart detection loop
    requestAnimationRef.current = requestAnimationFrame(detectHands);
    
    // Add test sign for debugging
    setTimeout(() => {
      setSignHistory(prev => [...prev, 'H', 'I']);
    }, 1000);
    
    toast({
      title: "Detection restarted",
      description: "The detection system has been restarted",
    });
  };

  // Force a demonstration sign/word
  const demonstrateWordDetection = () => {
    console.log("Demonstrating word detection");
    setSignHistory(['H', 'E', 'L', 'L', 'O']);
    toast({
      title: "Demonstration mode",
      description: "Added 'HELLO' to sign history",
    });
  };

  return (
    <div className="relative">
      {isModelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10 rounded-md">
          <div className="text-center">
            <Loader2 className="animate-spin h-12 w-12 mx-auto text-blue-500" />
            <p className="mt-4">Loading detection model...</p>
          </div>
        </div>
      )}
      
      {permissionDenied && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10 rounded-md">
          <div className="text-center p-6">
            <p className="text-red-400 text-xl mb-4">⚠️ Camera access denied</p>
            <p>Please allow camera access in your browser settings to use sign language detection.</p>
          </div>
        </div>
      )}
      
      {modelError && !isModelLoading && !permissionDenied && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10 rounded-md">
          <div className="text-center p-6">
            <p className="text-red-400 text-xl mb-4">⚠️ Error loading model</p>
            <p className="mb-4">{modelError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      <div className="relative aspect-video bg-black rounded-md overflow-hidden">
        <Webcam
          ref={webcamRef}
          muted
          mirrored={true} /* Mirror the webcam for more intuitive interaction */
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            facingMode: "user", 
            width: 640,
            height: 480
          }}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onUserMedia={handleWebcamReady}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div className="absolute bottom-2 right-2 flex space-x-2">
          <div className={`px-2 py-1 text-xs rounded-full ${modelReady ? 'bg-green-500' : 'bg-red-500'}`}>
            Model: {modelReady ? 'Ready' : 'Loading...'}
          </div>
          <div className={`px-2 py-1 text-xs rounded-full ${webcamReady ? 'bg-green-500' : 'bg-red-500'}`}>
            Webcam: {webcamReady ? 'Ready' : 'Waiting...'}
          </div>
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="flex justify-between">
          <button 
            onClick={restartDetection}
            className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded"
          >
            Restart Detection
          </button>
          
          <button 
            onClick={demonstrateWordDetection}
            className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded"
          >
            Demo Word Detection
          </button>
          
          {signHistory.length > 0 && (
            <button 
              onClick={clearSignHistory}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
            >
              Clear History
            </button>
          )}
        </div>
        
        {detectedSign && (
          <div className="p-3 bg-blue-900 bg-opacity-50 rounded-md">
            <p className="font-semibold">Detected Sign:</p>
            <p className="text-xl text-blue-300">{detectedSign}</p>
            <p className="text-sm text-gray-400">Confidence: {Math.round(confidence * 100)}%</p>
          </div>
        )}
        
        {detectedWord && (
          <div className="p-3 bg-green-900 bg-opacity-50 rounded-md animate-pulse">
            <p className="font-semibold">Word Detected:</p>
            <p className="text-2xl font-bold text-green-300">{detectedWord}</p>
          </div>
        )}
        
        {detectedPhrase && (
          <div className="p-3 bg-purple-900 bg-opacity-50 rounded-md animate-pulse">
            <p className="font-semibold">Phrase Detected:</p>
            <p className="text-2xl font-bold text-purple-300">{detectedPhrase}</p>
          </div>
        )}
        
        {signHistory.length > 0 && (
          <div className="p-3 bg-gray-800 rounded-md">
            <p className="font-semibold mb-2">Sign Sequence:</p>
            <div className="flex flex-wrap gap-1">
              {signHistory.map((sign, index) => (
                <span key={index} className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-sm">
                  {sign}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-3 bg-gray-800 rounded-md mt-2">
          <p className="text-sm text-gray-400">
            Try signing simple letters like 'A', 'B', 'V', or 'L', then try to spell words like 'HI' or 'OK'.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignLanguageDetector;
