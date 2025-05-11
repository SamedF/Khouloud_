import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { toast } from "@/hooks/use-toast";

// Types for hand gestures and features
interface HandFeatures {
  centroid: { x: number, y: number };
  width: number;
  height: number;
  aspectRatio: number;
  boundingBox: { left: number, right: number, top: number, bottom: number };
  fingerCount?: number;
}

interface HandGesture {
  name: string;
  confidence: number;
}

// This component demonstrates a simplified approach to hand feature extraction
// that would be more suitable for potential FPGA implementation
const SimplifiedHandFeatures = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<HandGesture | null>(null);
  const [detectedLetters, setDetectedLetters] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string>('');
  const [detectionStats, setDetectionStats] = useState({
    framesProcessed: 0,
    handsDetected: 0,
    avgProcessingTime: 0
  });
  
  // Hand detection parameters that could be implemented in hardware
  // These are adjustable thresholds for different lighting conditions
  const [thresholds, setThresholds] = useState({
    skinLowerHSV: [0, 0.15, 0.4],  // Lower HSV bounds for skin detection
    skinUpperHSV: [0.1, 0.7, 1.0], // Upper HSV bounds for skin detection
    blobMinSize: 1500,             // Minimum blob size to be considered a hand
    gestureThreshold: 0.7,         // Confidence threshold for gesture recognition
  });

  // Gesture history for stabilization
  const gestureHistory = useRef<string[]>([]);
  const maxHistoryLength = 10;
  const stabilityCutoff = 0.6; // 60% agreement required for stable detection
  
  // Letter cooldown to prevent spamming
  const [letterCooldown, setLetterCooldown] = useState(false);
  const cooldownTime = 2000; // 2 seconds cooldown
  const lastLetterTime = useRef<number>(0);

  useEffect(() => {
    // Check webcam permission when component mounts
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          console.log("Camera permission granted");
        })
        .catch((err) => {
          console.error("Camera permission denied:", err);
          toast({
            title: "Camera access required",
            description: "Please allow camera access to use the hand detection feature",
            variant: "destructive",
          });
        });
    }
    
    return () => {
      // Clean up when component unmounts
      setIsProcessing(false);
    };
  }, []);

  // Effect for displaying detected letters as words
  useEffect(() => {
    if (detectedLetters.length > 0) {
      // Join the detected letters to form a word
      const word = detectedLetters.join('');
      setCurrentWord(word);
    }
  }, [detectedLetters]);

  useEffect(() => {
    let processingInterval: NodeJS.Timeout | null = null;
    let frameCount = 0;
    let totalProcessingTime = 0;
    let handDetectionCount = 0;
    
    if (isProcessing) {
      // Start the processing loop when enabled
      processingInterval = setInterval(() => {
        const startTime = performance.now();
        const handDetected = processFrame();
        const endTime = performance.now();
        
        // Update statistics
        frameCount++;
        totalProcessingTime += (endTime - startTime);
        if (handDetected) handDetectionCount++;
        
        // Update stats every 10 frames
        if (frameCount % 10 === 0) {
          setDetectionStats({
            framesProcessed: frameCount,
            handsDetected: handDetectionCount,
            avgProcessingTime: totalProcessingTime / frameCount
          });
        }
      }, 50); // 20 fps for better performance
      
      return () => {
        if (processingInterval) clearInterval(processingInterval);
      };
    }
  }, [isProcessing, thresholds]);

  // Function to convert RGB to HSV - implementable in hardware
  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, v = max;
    
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    
    if (max === min) {
      h = 0; // achromatic
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0;
      }
      h /= 6;
    }
    
    return [h, s, v];
  };

  // Add a new letter to the word with cooldown
  const addLetterToWord = (letter: string) => {
    const currentTime = Date.now();
    
    // Check if we're in cooldown period
    if (currentTime - lastLetterTime.current < cooldownTime) {
      console.log("Letter cooldown active, ignoring:", letter);
      return;
    }
    
    // Update last letter time and add the letter
    lastLetterTime.current = currentTime;
    setLetterCooldown(true);
    
    // Add the letter to detected letters
    setDetectedLetters(prev => [...prev, letter]);
    
    // Audio feedback for letter detection
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAAABMSVNUHAAAAGluZm9JTkFNRQAAAEJlZXAAA0lDT1BZcmlnaHQgqSAyMDAzIEFkb2JlIFN5c3RlbXMgSW5jLgBkYXRhNAYAAAD//v38+/r594mW/e+RZUPzLsq39Lj/F7X40anzA/z69ff2+PgHCvrlJr9GmZze+w3i5eDF/9no/k1a9QaiPVNgLXmp8fDZ3en39Pvm+gT/+/z6+/r7/fz9/f79EP3r59n5beGJ0su5Za9Vnm2TmYdreHiDh2xXU3WWrbzV78HFJ9rk7Pn67QgQBvkHrWiY4/57aXY4R0VRSFBcZ32OiH6Je3Kigm5ci4Sleq/O3N300uh9/jpxRYJsfo+d7xQCZ5gFAg4UBAn++v5ZAQz58hgJhL++fBgYTYCkSzhA6hcH/3J+9BwZK+ww7/cbFmcXj0E3TXXBrcZr49dxlWyBgnTQ78NyX3hnkqLz8m5aYshYlLQHSFhGqO+39hYl+Lc8aywq0OIIBIC0/SE/tP8ICO1/nmglJkdARFcla13yd0IyFvvr/hnuQRq867ZuLPw+6wb6IP1oW4VlA/NrOxv0rzIl+V0WDiT+iQeVGPJh1GNhi3GzYlUCqg9bTAhVktrVmalLlpCNdIlzf25vkrTWzQfn9RX+/Q0SFh8kJicmIBsZFxUUERAMCwsKCwoJCQcGBgcJCwsLDAsLCw0QERERERETExMTExMTExMTExMTEhISExITExMSEhMTExMSEhISEhISEhERERERERERERERIREREREREREBEQEBEQEBAQDw4PDg8ODg8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw4ODg4ODg4ODQ0NDQ0NDAwMDAwMDAwMCwsLCgsLCgsLCwsLCgsLCgsLCgoKCgoKCgkKCQoJCQkJCQkJCQkJCQoJCQoJCgoKCQoKCQoKCgoKCgoKCgoKCgsKCgoKCgoKCgsLCwsLCwsLCwsLCwsMDAwMDAwMDAwNDQ0NDQ4NDg4ODg4PDw8PDw8PEBAQEBAQEBIREhESERIREhISEhITExMTExQTFBMUFBQUFBQUFBQUFBQUFBQVFRUVFRYWFhYWFhYWFhYWFhYWFhYWFhYYGBYWFhYXFhcXFxcXFxcYFxgYGBgYGBkZGRoZGRkaGhobGxscGxscHR0dHR0eHR4eHh8eHx4fIB8fHx8gICEhICEhISEhIiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMiIiIiIiEiISAhICAfIB8fIB8fHx4fHh4dHR0dHB0cHBwcGxscGxsaGxobGxsaGhkZGRkZGRkZGRkaGhoZGRkZGRkZGRkaGRoZGRkZGRkZGRkaGRoZGRkaGhoZGhkZGhobGhsbGhsaGxobGhsaGhoaGxobGhsaGxobGxobGhsaGxscHBscGxscHBscGxsbGxwbHBscGxwdHB0cHRwdHR0dHR0dHR0dHR0dHR0dHR4dHR0dHh4eHh4eHh4eHh4eHR0dHh0eHR0eHR4dHh0eHR4dHh0eHR4dHR0dHR0dHR0dHR0dHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcGxsbGxsbGxsbGxsbGxsbGxsbGxsaGhsaGhsaGhoaGhoaGhoaGhoZGhoaGRoZGRkZGRkZGRoZGRkZGRoZGhoZGRkZGRkZGRkZGRkZGRoZGhkaGhobGhsaGxobGxsbGxsbGxwcGxwcHBwcHR0dHR0dHR0eHh4eHh4eHh8fHx8AoEz0TX+lWhMUXSc+1AltoAqnTQ==");
    audio.play();
    
    // Visual feedback by showing cooldown indicator
    setTimeout(() => {
      setLetterCooldown(false);
    }, cooldownTime);
    
    toast({
      title: "Letter detected",
      description: `Added '${letter}' to current word`,
    });
  };

  // Extract hand features using simplified algorithms that could be adapted for FPGA
  const processFrame = (): boolean => {
    if (
      webcamRef.current?.video &&
      webcamRef.current.video.readyState === 4 &&
      canvasRef.current
    ) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) return false;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Flip the image horizontally for more intuitive interaction
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Create a binary mask for skin detection
      const skinMask = new Uint8Array(canvas.width * canvas.height);
      
      // Simple skin detection algorithm - could be implemented in hardware
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to HSV for better skin detection
        const [h, s, v] = rgbToHsv(r, g, b);
        
        // Apply thresholds for skin detection
        const isSkin = 
          h >= thresholds.skinLowerHSV[0] && h <= thresholds.skinUpperHSV[0] &&
          s >= thresholds.skinLowerHSV[1] && s <= thresholds.skinUpperHSV[1] &&
          v >= thresholds.skinLowerHSV[2] && v <= thresholds.skinUpperHSV[2];
        
        // Set mask value (1 for skin, 0 for non-skin)
        const pixelIndex = Math.floor(i / 4);
        skinMask[pixelIndex] = isSkin ? 1 : 0;
      }
      
      // Apply morphological operations for noise removal
      // In an FPGA, this would be implemented as spatial filters
      const denoisedMask = applySpatialFilter(skinMask, canvas.width, canvas.height);
      
      // Find largest connected component (the hand)
      const handRegion = findLargestBlob(denoisedMask, canvas.width, canvas.height);
      
      // Calculate simple geometric features of the hand
      // These features could be used for sign classification
      if (handRegion.size > thresholds.blobMinSize) {
        const features = calculateHandFeatures(handRegion, canvas.width, canvas.height);
        
        // Identify gesture based on geometric features
        const gesture = identifyGesture(features);
        
        // Update gesture history for stabilization
        if (gesture) {
          updateGestureHistory(gesture.name);
          setCurrentGesture(gesture);
          
          // Check for stable gesture and add letter if stable
          const stableGesture = getStableGesture();
          if (stableGesture && !letterCooldown) {
            // Only add valid letters (not gestures like "?")
            if (stableGesture !== "?" && stableGesture !== "I LOVE YOU") {
              addLetterToWord(stableGesture);
            }
          }
        }
        
        // Visualize the extracted features
        visualizeFeatures(ctx, handRegion, features, gesture);
        return true;
      } else {
        // Reset current gesture when no hand is detected
        setCurrentGesture(null);
      }
      
      // No hand detected, clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    return false;
  };
  
  // Update gesture history and maintain limited size
  const updateGestureHistory = (gestureName: string) => {
    if (gestureHistory.current.length >= maxHistoryLength) {
      gestureHistory.current.shift();
    }
    gestureHistory.current.push(gestureName);
  };
  
  // Get the most stable gesture from history
  const getStableGesture = (): string | null => {
    if (gestureHistory.current.length < 5) return null;
    
    // Count occurrences of each gesture
    const counts: {[key: string]: number} = {};
    gestureHistory.current.forEach(g => {
      counts[g] = (counts[g] || 0) + 1;
    });
    
    // Find the most common gesture
    let maxCount = 0;
    let stableGesture: string | null = null;
    
    Object.entries(counts).forEach(([gesture, count]) => {
      if (count > maxCount) {
        maxCount = count;
        stableGesture = gesture;
      }
    });
    
    // Check if it meets stability threshold
    const stability = maxCount / gestureHistory.current.length;
    return stability >= stabilityCutoff ? stableGesture : null;
  };
  
  // Simple spatial filter for denoising (equivalent to erosion/dilation)
  // This could be directly implemented in FPGA logic
  const applySpatialFilter = (mask: Uint8Array, width: number, height: number) => {
    // Create output mask
    const output = new Uint8Array(width * height);
    
    // Apply a simple 3x3 majority filter
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += mask[(y + dy) * width + (x + dx)];
          }
        }
        // If 5 or more neighbors are skin, this pixel is skin
        output[y * width + x] = sum >= 5 ? 1 : 0;
      }
    }
    
    return output;
  };
  
  // Connected component analysis - could be implemented with hardware flood fill
  const findLargestBlob = (mask: Uint8Array, width: number, height: number) => {
    const visited = new Uint8Array(width * height);
    let largestBlob = { pixels: [] as number[], size: 0, centroid: { x: 0, y: 0 } };
    
    // Simple connected component analysis
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 1 && visited[idx] === 0) {
          // Found a new blob, flood fill
          const blob = { pixels: [] as number[], size: 0, centroid: { x: 0, y: 0 } };
          let sumX = 0, sumY = 0;
          
          // Using a queue for flood fill
          const queue: [number, number][] = [[x, y]];
          visited[idx] = 1;
          
          while (queue.length > 0) {
            const [cx, cy] = queue.shift()!;
            const cIdx = cy * width + cx;
            
            blob.pixels.push(cIdx);
            blob.size++;
            sumX += cx;
            sumY += cy;
            
            // Check 4-connected neighbors
            const neighbors = [
              [cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]
            ];
            
            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (mask[nIdx] === 1 && visited[nIdx] === 0) {
                  queue.push([nx, ny]);
                  visited[nIdx] = 1;
                }
              }
            }
          }
          
          // Calculate centroid
          blob.centroid = {
            x: sumX / blob.size,
            y: sumY / blob.size
          };
          
          // Keep track of largest blob
          if (blob.size > largestBlob.size) {
            largestBlob = blob;
          }
        }
      }
    }
    
    return largestBlob;
  };
  
  // Calculate simple geometric features of hand
  const calculateHandFeatures = (handRegion: { pixels: number[], size: number, centroid: { x: number, y: number } }, width: number, height: number) => {
    // Find extremal points (leftmost, rightmost, topmost, bottommost)
    let left = width, right = 0, top = height, bottom = 0;
    
    for (const pixelIdx of handRegion.pixels) {
      const x = pixelIdx % width;
      const y = Math.floor(pixelIdx / width);
      
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    
    // Calculate the hull using a simplified convex hull algorithm
    const hull = calculateSimplifiedHull(handRegion, width);
    
    // Estimate number of extended fingers based on hull geometry
    const fingerCount = estimateFingerCount(handRegion, hull, width);
    
    // Calculate geometric features - these would be the outputs from an FPGA implementation
    return {
      centroid: handRegion.centroid,
      width: right - left,
      height: bottom - top,
      aspectRatio: (right - left) / (bottom - top),
      boundingBox: { left, right, top, bottom },
      fingerCount
    };
  };

  // Simple convex hull estimation for finger detection
  const calculateSimplifiedHull = (
    handRegion: { pixels: number[], size: number, centroid: { x: number, y: number } }, 
    width: number
  ) => {
    // This is a simplified approximation that would be hardware-friendly
    // Instead of computing a full convex hull, we'll just find points that are 
    // far from the centroid in different directions
    
    const { centroid } = handRegion;
    const points: Array<{x: number, y: number, distance: number}> = [];
    
    // Sample from the hand region pixels
    for (const pixelIdx of handRegion.pixels) {
      // Only sample every 10th pixel for efficiency
      if (pixelIdx % 10 !== 0) continue;
      
      const x = pixelIdx % width;
      const y = Math.floor(pixelIdx / width);
      
      // Calculate distance from centroid
      const dx = x - centroid.x;
      const dy = y - centroid.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      points.push({ x, y, distance });
    }
    
    // Sort by distance
    points.sort((a, b) => b.distance - a.distance);
    
    // Take the top 20 points as our simplified hull
    return points.slice(0, 20);
  };
  
  // Estimate finger count based on hand geometry
  const estimateFingerCount = (
    handRegion: { pixels: number[], size: number, centroid: { x: number, y: number } }, 
    hull: Array<{x: number, y: number, distance: number}>,
    width: number
  ) => {
    // A simplified algorithm to estimate extended fingers
    // Actual FPGAs would use more sophisticated but still hardware-friendly methods
    
    // If the hull points are clustered in distinct groups far from the centroid,
    // those are likely fingers
    
    // Get the top 30% points by distance
    const farPoints = hull.slice(0, Math.ceil(hull.length * 0.3));
    
    // Group these points by angle from centroid 
    // This is simplified finger detection that's feasible in hardware
    const angleGroups: {[key: string]: number} = {};
    const { centroid } = handRegion;
    
    for (const point of farPoints) {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      
      // Calculate angle in degrees (0-360)
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      
      // Quantize to 30 degree bins
      const bin = Math.floor(angle / 30);
      
      // Count points in each angle bin
      angleGroups[bin] = (angleGroups[bin] || 0) + 1;
    }
    
    // Count angle groups with more than 1 point
    // These are likely extended fingers
    const possibleFingers = Object.values(angleGroups)
      .filter(count => count > 1)
      .length;
    
    // Adjust based on hand area and aspect ratio to estimate final count
    return Math.min(Math.max(1, possibleFingers), 5);
  };
  
  // Map from finger count to ASL letter estimation
  const identifyGesture = (features: HandFeatures): HandGesture | null => {
    const { fingerCount, aspectRatio, width, height } = features;
    
    if (!fingerCount) return null;
    
    // Very basic gesture mapping based on finger count and aspect ratio
    // This could be implemented as a simple lookup table in hardware
    if (fingerCount === 1) {
      // Could be A, E, M, N, S, T
      if (aspectRatio < 0.8) {
        return { name: 'A', confidence: 0.7 };
      } else {
        return { name: 'D', confidence: 0.6 };
      }
    } else if (fingerCount === 2) {
      // Could be H, K, L, P, R, U, V, X
      if (aspectRatio > 1.2) {
        return { name: 'L', confidence: 0.8 };
      } else if (aspectRatio < 0.9) {
        return { name: 'K', confidence: 0.7 };
      } else {
        return { name: 'V', confidence: 0.75 };
      }
    } else if (fingerCount === 3) {
      // Could be F, W
      return { name: 'W', confidence: 0.8 };
    } else if (fingerCount === 4) {
      // Could be B
      return { name: 'B', confidence: 0.85 };
    } else if (fingerCount === 5) {
      // Could be I, Y
      if (width > height * 1.2) {
        return { name: 'Y', confidence: 0.9 };
      } else {
        return { name: 'I LOVE YOU', confidence: 0.8 };
      }
    }
    
    return { name: '?', confidence: 0.5 };
  };
  
  // Visualize the extracted features
  const visualizeFeatures = (
    ctx: CanvasRenderingContext2D, 
    handRegion: { pixels: number[], size: number, centroid: { x: number, y: number } }, 
    features: HandFeatures, 
    gesture: HandGesture | null
  ) => {
    const { width, height } = ctx.canvas;
    
    // Reset canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw original image with reduced opacity
    ctx.drawImage(webcamRef.current!.video!, 0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);
    
    // Highlight hand region
    for (const pixelIdx of handRegion.pixels) {
      const x = pixelIdx % width;
      const y = Math.floor(pixelIdx / width);
      
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.fillRect(x, y, 1, 1);
    }
    
    // Draw bounding box
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      features.boundingBox.left,
      features.boundingBox.top,
      features.width,
      features.height
    );
    
    // Draw centroid
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(features.centroid.x, features.centroid.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Display feature values
    ctx.fillStyle = 'white';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Width: ${Math.round(features.width)}px`, 10, 30);
    ctx.fillText(`Height: ${Math.round(features.height)}px`, 10, 50);
    ctx.fillText(`Aspect ratio: ${features.aspectRatio.toFixed(2)}`, 10, 70);
    ctx.fillText(`Area: ${handRegion.size}px`, 10, 90);
    
    // Display finger count estimation
    if (features.fingerCount !== undefined) {
      ctx.fillText(`Est. fingers: ${features.fingerCount}`, 10, 110);
    }
    
    // Display detected gesture
    if (gesture) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = 'yellow';
      ctx.fillText(`${gesture.name} (${Math.round(gesture.confidence * 100)}%)`, 10, 140);
    }
  };

  // Reset detection parameters to defaults
  const resetParameters = () => {
    setThresholds({
      skinLowerHSV: [0, 0.15, 0.4],
      skinUpperHSV: [0.1, 0.7, 1.0],
      blobMinSize: 1500,
      gestureThreshold: 0.7,
    });
    setDetectedLetters([]);
    setCurrentWord('');
    gestureHistory.current = [];
  };

  // Adjust for different lighting conditions
  const adjustForLighting = (preset: 'bright' | 'normal' | 'dim') => {
    switch (preset) {
      case 'bright':
        setThresholds({
          skinLowerHSV: [0, 0.1, 0.5],
          skinUpperHSV: [0.1, 0.5, 1.0],
          blobMinSize: 1500,
          gestureThreshold: 0.7,
        });
        break;
      case 'dim':
        setThresholds({
          skinLowerHSV: [0, 0.2, 0.3],
          skinUpperHSV: [0.15, 0.8, 0.9],
          blobMinSize: 1200,
          gestureThreshold: 0.6,
        });
        break;
      default:
        resetParameters();
    }
  };

  return (
    <div className="relative">
      <div className="relative aspect-video bg-black rounded-md overflow-hidden">
        <Webcam
          ref={webcamRef}
          muted
          mirrored={true} // Mirror the webcam for more intuitive interaction
          audio={false}
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
        
        {/* Word display overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-50">
          <div className="flex justify-between items-center">
            <div>
              {currentGesture && (
                <span className="text-xl font-bold text-yellow-400 mr-4">
                  {currentGesture.name}
                </span>
              )}
              {letterCooldown && (
                <span className="text-sm text-blue-400">
                  (cooldown active)
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-gray-300">
                Detected: 
              </span>
              <span className="text-xl font-bold text-white ml-2">
                {currentWord || '...'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-lg font-semibold text-green-400">
            FPGA-Friendly Hand Detection
          </p>
          <div className="space-x-2">
            <button 
              onClick={() => setIsProcessing(!isProcessing)}
              className={`px-4 py-2 rounded ${isProcessing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
            >
              {isProcessing ? 'Pause Processing' : 'Start Processing'}
            </button>
            <button
              onClick={() => {
                setDetectedLetters([]);
                setCurrentWord('');
                gestureHistory.current = [];
              }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
            >
              Clear Word
            </button>
            <button
              onClick={resetParameters}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Reset Params
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="bg-gray-700 p-4 rounded-md">
            <p className="text-gray-200 mb-2">Detection Statistics:</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 p-2 rounded">
                <p className="text-gray-400 text-sm">Frames Processed</p>
                <p className="text-white font-bold">{detectionStats.framesProcessed}</p>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <p className="text-gray-400 text-sm">Hands Detected</p>
                <p className="text-white font-bold">{detectionStats.handsDetected}</p>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <p className="text-gray-400 text-sm">Avg. Processing Time</p>
                <p className="text-white font-bold">{detectionStats.avgProcessingTime.toFixed(2)}ms</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-gray-800 p-4 rounded-md">
          <p className="text-gray-300 mb-2">Lighting Conditions:</p>
          <div className="flex space-x-2">
            <button
              onClick={() => adjustForLighting('bright')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
            >
              Bright Room
            </button>
            <button
              onClick={() => adjustForLighting('normal')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            >
              Normal Lighting
            </button>
            <button
              onClick={() => adjustForLighting('dim')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
            >
              Dim Room
            </button>
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-md">
          <p className="text-gray-300 mb-2">Detected Signs:</p>
          <div className="flex flex-wrap gap-2">
            {detectedLetters.map((letter, index) => (
              <div key={index} className="bg-blue-700 px-3 py-1 rounded text-white font-bold">
                {letter}
              </div>
            ))}
            {detectedLetters.length === 0 && (
              <p className="text-gray-400">No signs detected yet</p>
            )}
          </div>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-md">
          <p className="text-gray-300 mb-2">Key Features for FPGA Implementation:</p>
          <ul className="list-disc pl-5 text-gray-400">
            <li>Simple color-based segmentation (easily translatable to hardware)</li>
            <li>Spatial filtering with fixed-size kernels (implementable as pipeline)</li>
            <li>Connected component analysis (can be optimized for hardware)</li>
            <li>Geometric feature extraction (parallel computation in FPGA)</li>
            <li>Simplified finger counting algorithm (implementable with angle binning)</li>
            <li>Basic gesture recognition via lookup table (low complexity)</li>
            <li>Letter cooldown mechanism (2-second delay between letter detections)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedHandFeatures;
