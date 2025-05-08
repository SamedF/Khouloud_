
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { toast } from '@/components/ui/use-toast';

// Define proper types for sign configurations
interface SignConfig {
  description: string;
  fingersUp: number[];
  curved?: boolean;
  special?: string;
}

// Define more comprehensive ASL signs based on finger positions
const signs: Record<string, SignConfig> = {
  'A': { description: 'Fist with thumb pointing up', fingersUp: [1, 0, 0, 0, 0] },
  'B': { description: 'Flat hand with fingers together', fingersUp: [0, 1, 1, 1, 1] },
  'C': { description: 'Curved hand', fingersUp: [0, 1, 1, 1, 1], curved: true },
  'D': { description: 'Index finger up, thumb touches middle finger', fingersUp: [1, 1, 0, 0, 0] },
  'E': { description: 'Fingers curled, thumb across palm', fingersUp: [0, 0, 0, 0, 0], curved: true },
  'F': { description: 'Thumb and index finger form circle, other fingers up', fingersUp: [1, 1, 1, 1, 1], special: 'thumb-index-touch' },
  'H': { description: 'Index and middle fingers extended side by side', fingersUp: [0, 1, 1, 0, 0] },
  'I': { description: 'Pinky finger extended', fingersUp: [0, 0, 0, 0, 1] },
  'L': { description: 'L-shape with thumb and index finger', fingersUp: [1, 1, 0, 0, 0] },
  'O': { description: 'Fingers form circle', fingersUp: [1, 1, 1, 1, 1], special: 'circle' },
  'R': { description: 'Index and middle fingers crossed', fingersUp: [0, 1, 1, 0, 0], special: 'crossed' },
  'S': { description: 'Fist with thumb over fingers', fingersUp: [0, 0, 0, 0, 0] },
  'T': { description: 'Thumb between index and middle finger', fingersUp: [1, 0, 0, 0, 0], special: 'thumb-between' },
  'U': { description: 'Index and middle fingers extended together', fingersUp: [0, 1, 1, 0, 0] },
  'V': { description: 'Index and middle fingers in V shape', fingersUp: [0, 1, 1, 0, 0], special: 'v-shape' },
  'W': { description: 'Three fingers extended', fingersUp: [0, 1, 1, 1, 0] },
  'Y': { description: 'Thumb and pinky extended', fingersUp: [1, 0, 0, 0, 1] },
  'I love you': { description: 'Thumb, index, and pinky extended', fingersUp: [1, 1, 0, 0, 1] },
};

// Common words formed with signs
const commonWords = [
  'HELLO', 'THANK YOU', 'PLEASE', 'SORRY',
  'YES', 'NO', 'LOVE', 'FRIEND', 'HELP',
  'GOOD', 'BAD', 'HOW', 'WHAT', 'WHERE'
];

const SignLanguageDetector = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detectedSign, setDetectedSign] = useState<string>('');
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [confidence, setConfidence] = useState<number>(0);
  const [signHistory, setSignHistory] = useState<string[]>([]);
  const [detectedWord, setDetectedWord] = useState<string>('');
  
  // Track the last stable sign to prevent flickering
  const lastSignRef = useRef<string>('');
  const stableCountRef = useRef<number>(0);
  const STABILITY_THRESHOLD = 5; // Number of consistent frames to consider a sign stable
  
  // Initialize TensorFlow.js and the handpose model
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        
        // Ensure TensorFlow is ready
        await tf.ready();
        
        // Load the handpose model with correct configuration options
        const model = await handpose.load({
          detectionConfidence: 0.8
          // The handpose model doesn't support maxNumHands
        });
        
        // Once model is loaded, start the detection loop
        setIsModelLoading(false);
        detectHands(model);
        
        toast({
          title: "Model loaded successfully",
          description: "Start signing to see detection results",
        });
      } catch (error) {
        console.error('Failed to load hand detection model:', error);
        toast({
          title: "Error loading model",
          description: "Please check your connection and try again",
          variant: "destructive",
        });
      }
    };
    
    loadModels();
    
    return () => {
      // Cleanup function to prevent memory leaks
      setSignHistory([]);
      lastSignRef.current = '';
      stableCountRef.current = 0;
    };
  }, []);

  // Check for words in sign history
  useEffect(() => {
    if (signHistory.length === 0) return;
    
    // Look for common words in the sign sequence
    const currentSequence = signHistory.join('');
    for (const word of commonWords) {
      if (currentSequence.endsWith(word)) {
        setDetectedWord(word);
        // Vibrate if available to give haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(200);
        }
        return;
      }
    }
  }, [signHistory]);
  
  // Function to detect finger states with more accuracy
  const getFingerState = (landmarks: any[]) => {
    const palmBase = landmarks[0];
    const wrist = landmarks[0];
    const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const knuckles = [landmarks[2], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    const mcp = [landmarks[1], landmarks[5], landmarks[9], landmarks[13], landmarks[17]]; // metacarpophalangeal joints
    
    // Calculate palm normal for better 3D orientation awareness
    const palmVector1 = [
      landmarks[5][0] - landmarks[17][0],
      landmarks[5][1] - landmarks[17][1],
      landmarks[5][2] - landmarks[17][2]
    ];
    const palmVector2 = [
      landmarks[9][0] - landmarks[13][0],
      landmarks[9][1] - landmarks[13][1],
      landmarks[9][2] - landmarks[13][2]
    ];
    const palmNormal = [
      palmVector1[1] * palmVector2[2] - palmVector1[2] * palmVector2[1],
      palmVector1[2] * palmVector2[0] - palmVector1[0] * palmVector2[2],
      palmVector1[0] * palmVector2[1] - palmVector1[1] * palmVector2[0]
    ];
    
    // Check if each finger is extended, using 3D positions for better accuracy
    const fingerStates = fingertips.map((tip, i) => {
      if (i === 0) {
        // Special case for thumb
        const thumbCMC = landmarks[1]; // carpometacarpal joint
        const thumbMCP = landmarks[2]; // metacarpophalangeal joint
        const thumbIP = landmarks[3]; // interphalangeal joint
        
        // Calculate the angle between segments
        const vec1 = [
          thumbMCP[0] - thumbCMC[0],
          thumbMCP[1] - thumbCMC[1],
          thumbMCP[2] - thumbCMC[2]
        ];
        const vec2 = [
          thumbIP[0] - thumbMCP[0],
          thumbIP[1] - thumbMCP[1],
          thumbIP[2] - thumbMCP[2]
        ];
        const vec3 = [
          tip[0] - thumbIP[0],
          tip[1] - thumbIP[1],
          tip[2] - thumbIP[2]
        ];
        
        const isExtended = vec3[1] < -10; // Thumb is extended if pointing up
        return isExtended ? 1 : 0;
      } else {
        // For other fingers, compare tip to knuckle positions in 3D
        const pip = landmarks[i * 4 + 1]; // proximal interphalangeal joint
        const dip = landmarks[i * 4 + 2]; // distal interphalangeal joint
        
        // Check if the finger is straight by comparing y coordinates
        const isExtended = tip[1] < knuckles[i][1] - 15; // Finger is extended if fingertip is above knuckle
        
        // Check for finger curling
        const pipToKnuckleY = pip[1] - knuckles[i][1];
        const tipToDipY = tip[1] - dip[1];
        
        // Curved fingers have the tip lower than expected for a straight finger
        const isCurled = pipToKnuckleY < 0 && tipToDipY > 0;
        
        return isExtended && !isCurled ? 1 : 0;
      }
    });
    
    return fingerStates;
  };
  
  // Function to detect special finger configurations
  const detectSpecialConfigurations = (landmarks: any[]) => {
    // Detect thumb-index touch for F
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distance = Math.sqrt(
      Math.pow(thumbTip[0] - indexTip[0], 2) + 
      Math.pow(thumbTip[1] - indexTip[1], 2) + 
      Math.pow(thumbTip[2] - indexTip[2], 2)
    );
    
    const thumbIndexTouch = distance < 15;
    const indexMiddleSpread = Math.sqrt(
      Math.pow(landmarks[8][0] - landmarks[12][0], 2) + 
      Math.pow(landmarks[8][1] - landmarks[12][1], 2)
    ) > 30;
    
    return {
      'thumb-index-touch': thumbIndexTouch,
      'v-shape': indexMiddleSpread,
      'circle': false, // Would need more complex calculation
      'crossed': false, // Challenging to detect without specialized logic
      'thumb-between': false, // Complex to detect reliably
    };
  };
  
  // Function to detect hands and predict signs
  const detectHands = async (model: handpose.HandPose) => {
    if (
      webcamRef.current && 
      webcamRef.current.video && 
      webcamRef.current.video.readyState === 4 &&
      canvasRef.current
    ) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Detect hands in the video stream
      try {
        const hands = await model.estimateHands(video);
        
        // Process the hand data to identify signs
        if (hands && hands.length > 0) {
          const hand = hands[0]; // Using only the first detected hand
          
          // Get the finger states
          const fingerStates = getFingerState(hand.landmarks);
          const specialConfigurations = detectSpecialConfigurations(hand.landmarks);
          
          // Find the most similar sign
          let bestMatch = '';
          let bestScore = 0.5; // Increased threshold for better accuracy
          
          Object.entries(signs).forEach(([sign, config]) => {
            // Start with basic finger position matching
            let similarity = fingerStates.reduce((acc, state, idx) => {
              return acc + (state === config.fingersUp[idx] ? 0.15 : 0);
            }, 0);
            
            // Add bonus for special configurations if they match
            if (config.special && specialConfigurations[config.special as keyof typeof specialConfigurations]) {
              similarity += 0.25;
            }

            // Check for curved hand configuration if needed
            if (config.curved) {
              // This is a simplified check - would need more complex logic for full accuracy
              // For now, we'll use the finger states as an approximation
              const isCurved = fingerStates.reduce((sum, state) => sum + state, 0) > 2;
              if (isCurved) similarity += 0.1;
            }
            
            if (similarity > bestScore) {
              bestScore = similarity;
              bestMatch = sign;
            }
          });
          
          // Apply stability check to prevent flickering
          if (bestMatch) {
            if (bestMatch === lastSignRef.current) {
              stableCountRef.current += 1;
              if (stableCountRef.current >= STABILITY_THRESHOLD) {
                if (detectedSign !== bestMatch) {
                  setDetectedSign(bestMatch);
                  setConfidence(bestScore);
                  
                  // Only add to history if it's a new sign (not just repeating)
                  if (signHistory.length === 0 || signHistory[signHistory.length - 1] !== bestMatch) {
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
            // No match found - might be transitioning between signs
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
      requestAnimationFrame(() => detectHands(model));
    }
  };
  
  // Function to draw hand landmarks on canvas
  const drawHandLandmarks = (landmarks: number[][], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    
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
        ctx.arc(point[0], point[1], 6, 0, 2 * Math.PI);
      } else if (index === 0) {
        ctx.fillStyle = '#ff0000'; // Red for palm base
        ctx.arc(point[0], point[1], 8, 0, 2 * Math.PI);
      } else {
        ctx.fillStyle = '#ffffff'; // White for other joints
        ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
      }
      
      ctx.fill();
    });
  };

  // Function to clear the sign history and detected word
  const clearSignHistory = () => {
    setSignHistory([]);
    setDetectedWord('');
    toast({
      title: "History cleared",
      description: "Start signing new words",
    });
  };

  return (
    <div className="relative">
      {isModelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10 rounded-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4">Loading detection model...</p>
          </div>
        </div>
      )}
      
      <div className="relative aspect-video bg-black rounded-md overflow-hidden">
        <Webcam
          ref={webcamRef}
          muted
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
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
      </div>
      
      <div className="mt-4 space-y-2">
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
        
        {signHistory.length > 0 && (
          <div className="p-3 bg-gray-800 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <p className="font-semibold">Sign Sequence:</p>
              <button 
                onClick={clearSignHistory}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {signHistory.map((sign, index) => (
                <span key={index} className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-sm">
                  {sign}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignLanguageDetector;
