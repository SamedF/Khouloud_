
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/hand-pose-detection';
import '@mediapipe/hands';
import { toast } from '@/components/ui/use-toast';

// Define basic ASL signs based on finger positions
const signs = {
  'A': { description: 'Fist with thumb pointing up', fingersUp: [1, 0, 0, 0, 0] },
  'B': { description: 'Flat hand with fingers together', fingersUp: [0, 1, 1, 1, 1] },
  'C': { description: 'Curved hand', fingersUp: [0, 1, 1, 1, 1], curved: true },
  'Y': { description: 'Thumb and pinky extended', fingersUp: [1, 0, 0, 0, 1] },
  'I love you': { description: 'Thumb, index, and pinky extended', fingersUp: [1, 1, 0, 0, 1] },
};

const SignLanguageDetector = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detectedSign, setDetectedSign] = useState<string>('');
  const [isModelLoading, setIsModelLoading] = useState<boolean>(true);
  const [confidence, setConfidence] = useState<number>(0);
  
  // Initialize TensorFlow.js and the hand detection model
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        
        // Ensure TensorFlow is ready
        await tf.ready();
        
        // Load the MediaPipe hands model
        const model = await handpose.createDetector(
          handpose.SupportedModels.MediaPipeHands, 
          {
            runtime: 'mediapipe',
            modelType: 'full',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
            maxHands: 1, // Only detect one hand for simplicity
          }
        );
        
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
    
    // Cleanup function
    return () => {
      // Any cleanup code for the model or webcam
    };
  }, []);
  
  // Function to detect if fingers are extended
  const getFingerState = (landmarks: handpose.Keypoint[]) => {
    // MediaPipe hand landmarks:
    // 0: wrist
    // 1-4: thumb
    // 5-8: index finger
    // 9-12: middle finger
    // 13-16: ring finger
    // 17-20: pinky finger
    
    // Simplified finger state detection
    const wrist = landmarks[0];
    const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const mcp = [landmarks[1], landmarks[5], landmarks[9], landmarks[13], landmarks[17]]; // Knuckles
    
    // Check if each fingertip is extended (higher than the wrist)
    const fingerStates = fingertips.map((tip, i) => {
      // For thumb, check if it's to the side of the hand
      if (i === 0) {
        // Calculate horizontal distance between thumb tip and wrist
        const distance = Math.sqrt(
          Math.pow(tip.x - wrist.x, 2) + 
          Math.pow(tip.y - wrist.y, 2)
        );
        return distance > 0.1 ? 1 : 0;
      } else {
        // For other fingers, check if they're extended
        return tip.y < mcp[i].y ? 1 : 0;
      }
    });
    
    return fingerStates;
  };
  
  // Function to detect hands and predict signs
  const detectHands = async (model: handpose.HandDetector) => {
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
          const fingerStates = getFingerState(hand.keypoints);
          console.log("Finger states:", fingerStates);
          
          // Find the most similar sign
          let bestMatch = '';
          let bestScore = -1;
          
          Object.entries(signs).forEach(([sign, config]) => {
            const similarity = fingerStates.reduce((acc, state, idx) => {
              return acc + (state === config.fingersUp[idx] ? 1 : 0);
            }, 0) / 5; // Normalize to 0-1 range
            
            if (similarity > bestScore) {
              bestScore = similarity;
              bestMatch = sign;
            }
          });
          
          if (bestScore > 0.6) { // Confidence threshold
            setDetectedSign(bestMatch);
            setConfidence(bestScore);
          } else {
            setDetectedSign('');
            setConfidence(0);
          }
          
          // Draw landmarks on canvas
          drawHandLandmarks(hands, canvas);
        } else {
          setDetectedSign('');
          setConfidence(0);
          
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
  const drawHandLandmarks = (hands: handpose.Hand[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw each hand
    hands.forEach((hand) => {
      // Draw keypoints
      if (hand.keypoints) {
        // Draw connections first (so they appear behind the dots)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        
        // Draw thumb connections
        ctx.moveTo(hand.keypoints[0].x, hand.keypoints[0].y);
        for (let i = 1; i <= 4; i++) {
          ctx.lineTo(hand.keypoints[i].x, hand.keypoints[i].y);
        }
        ctx.stroke();
        
        // Draw finger connections
        for (let finger = 0; finger < 4; finger++) {
          const baseIdx = 5 + (finger * 4);
          ctx.beginPath();
          ctx.moveTo(hand.keypoints[0].x, hand.keypoints[0].y);
          ctx.lineTo(hand.keypoints[baseIdx].x, hand.keypoints[baseIdx].y);
          for (let i = 0; i < 4; i++) {
            const idx = baseIdx + i;
            ctx.lineTo(hand.keypoints[idx].x, hand.keypoints[idx].y);
          }
          ctx.stroke();
        }
        
        // Draw keypoints
        hand.keypoints.forEach((keypoint, index) => {
          ctx.beginPath();
          
          // Different colors for fingertips
          if ([4, 8, 12, 16, 20].includes(index)) {
            ctx.fillStyle = '#00ffff'; // Cyan for fingertips
            ctx.arc(keypoint.x, keypoint.y, 6, 0, 2 * Math.PI);
          } else if (index === 0) {
            ctx.fillStyle = '#ff0000'; // Red for wrist
            ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
          } else {
            ctx.fillStyle = '#ffffff'; // White for other joints
            ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
          }
          
          ctx.fill();
        });
      }
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
      
      {detectedSign && (
        <div className="mt-4 p-3 bg-blue-900 bg-opacity-50 rounded-md">
          <p className="font-semibold">Detected Sign:</p>
          <p className="text-xl text-blue-300">{detectedSign}</p>
          <p className="text-sm text-gray-400">Confidence: {Math.round(confidence * 100)}%</p>
        </div>
      )}
    </div>
  );
};

export default SignLanguageDetector;
