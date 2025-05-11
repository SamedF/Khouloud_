
import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { toast } from "@/hooks/use-toast";

// This component demonstrates a simplified approach to hand feature extraction
// that would be more suitable for potential FPGA implementation
const SimplifiedHandFeatures = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
  });

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
        
        // Visualize the extracted features
        visualizeFeatures(ctx, handRegion, features);
        return true;
      }
      
      // No hand detected, clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    return false;
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
    
    // Calculate geometric features - these would be the outputs from an FPGA implementation
    return {
      centroid: handRegion.centroid,
      width: right - left,
      height: bottom - top,
      aspectRatio: (right - left) / (bottom - top),
      boundingBox: { left, right, top, bottom }
    };
  };
  
  // Visualize the extracted features
  const visualizeFeatures = (ctx: CanvasRenderingContext2D, handRegion: { pixels: number[], size: number, centroid: { x: number, y: number } }, features: any) => {
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
  };

  // Reset detection parameters to defaults
  const resetParameters = () => {
    setThresholds({
      skinLowerHSV: [0, 0.15, 0.4],
      skinUpperHSV: [0.1, 0.7, 1.0],
      blobMinSize: 1500,
    });
  };

  // Adjust for different lighting conditions
  const adjustForLighting = (preset: 'bright' | 'normal' | 'dim') => {
    switch (preset) {
      case 'bright':
        setThresholds({
          skinLowerHSV: [0, 0.1, 0.5],
          skinUpperHSV: [0.1, 0.5, 1.0],
          blobMinSize: 1500,
        });
        break;
      case 'dim':
        setThresholds({
          skinLowerHSV: [0, 0.2, 0.3],
          skinUpperHSV: [0.15, 0.8, 0.9],
          blobMinSize: 1200,
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
          <p className="text-gray-300 mb-2">Key Features for FPGA Implementation:</p>
          <ul className="list-disc pl-5 text-gray-400">
            <li>Simple color-based segmentation (easily translatable to hardware)</li>
            <li>Spatial filtering with fixed-size kernels (implementable as pipeline)</li>
            <li>Connected component analysis (can be optimized for hardware)</li>
            <li>Geometric feature extraction (parallel computation in FPGA)</li>
          </ul>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-md">
          <p className="text-gray-300 mb-2">FPGA Implementation Notes:</p>
          <ul className="list-disc pl-5 text-gray-400">
            <li>Image processing algorithms can be pipelined for parallel execution</li>
            <li>Fixed-point arithmetic would replace floating-point operations</li>
            <li>Algorithm relies on simple thresholds rather than neural networks</li>
            <li>Output features could feed into a simple classifier (HLS or RTL)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedHandFeatures;

