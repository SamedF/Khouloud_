
import React, { useState } from 'react';
import SignLanguageDetector from '@/components/SignLanguageDetector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  const [isDetecting, setIsDetecting] = useState(false);

  // Full alphabet of supported signs
  const supportedSigns = [
    { sign: 'A', description: 'Fist with thumb pointing up' },
    { sign: 'B', description: 'Flat hand with fingers together' },
    { sign: 'C', description: 'Curved hand' },
    { sign: 'D', description: 'Index finger up, thumb touches middle finger' },
    { sign: 'E', description: 'Fingers curled, thumb across palm' },
    { sign: 'F', description: 'Thumb and index finger form circle, other fingers up' },
    { sign: 'G', description: 'Pointer finger and thumb extended horizontally' },
    { sign: 'H', description: 'Index and middle fingers extended side by side' },
    { sign: 'I', description: 'Pinky finger extended' },
    { sign: 'J', description: 'Pinky extended and hand moves in J shape' },
    { sign: 'K', description: 'Index, middle fingers up with thumb between them' },
    { sign: 'L', description: 'L-shape with thumb and index finger' },
    { sign: 'M', description: 'Three fingers over thumb' },
    { sign: 'N', description: 'Index and middle fingers down over thumb' },
    { sign: 'O', description: 'Fingers form circle' },
    { sign: 'P', description: 'Pointer finger down from thumb' },
    { sign: 'Q', description: 'Thumb and index finger down' },
    { sign: 'R', description: 'Index and middle fingers crossed' },
    { sign: 'S', description: 'Fist with thumb over fingers' },
    { sign: 'T', description: 'Thumb between index and middle finger' },
    { sign: 'U', description: 'Index and middle fingers extended together' },
    { sign: 'V', description: 'Index and middle fingers in V shape' },
    { sign: 'W', description: 'Three fingers extended' },
    { sign: 'X', description: 'Index finger bent at middle joint' },
    { sign: 'Y', description: 'Thumb and pinky extended' },
    { sign: 'Z', description: 'Index finger draws Z shape' },
    { sign: 'I love you', description: 'Thumb, index, and pinky extended' },
  ];

  // Expanded list of supported words
  const supportedWords = [
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
    'NOW', 'LATER', 'TODAY', 'TOMORROW', 'YESTERDAY'
  ];

  // Common phrases for conversations
  const supportedPhrases = [
    'HELLO HOW ARE YOU',
    'MY NAME IS',
    'NICE TO MEET YOU',
    'I DONT UNDERSTAND',
    'CAN YOU HELP ME',
    'I NEED HELP',
    'THANK YOU VERY MUCH',
    'WHERE IS',
    'I AM FINE',
    'I AM HAPPY',
    'I AM SORRY',
    'SEE YOU TOMORROW',
    'I LOVE YOU',
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-8 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2 text-blue-400">Sign Language Detector</h1>
        <p className="text-gray-400">Real-time sign language detection using your webcam</p>
      </header>

      <Card className="w-full max-w-3xl bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-blue-400">Hand Sign Detection</CardTitle>
          <CardDescription className="text-gray-400">
            Position your hand in front of the camera to detect signs and form words or phrases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDetecting ? (
            <SignLanguageDetector />
          ) : (
            <div className="h-[350px] flex items-center justify-center bg-gray-900 rounded-md">
              <p className="text-gray-500">Click Start Detection to activate the webcam</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            onClick={() => setIsDetecting(!isDetecting)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isDetecting ? "Stop Detection" : "Start Detection"}
          </Button>
        </CardFooter>
      </Card>

      <div className="mt-8 max-w-3xl w-full">
        <Tabs defaultValue="signs">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="signs">Alphabet Signs</TabsTrigger>
            <TabsTrigger value="words">Words</TabsTrigger>
            <TabsTrigger value="phrases">Phrases</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signs" className="mt-0">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">Supported Signs (Full Alphabet)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {supportedSigns.map((item) => (
                <Card key={item.sign} className="bg-gray-800 border-gray-700">
                  <CardHeader className="py-3">
                    <CardTitle className="text-lg">{item.sign}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-gray-300 text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="words" className="mt-0">
            <h2 className="text-xl font-semibold mb-4 text-green-400">Supported Words</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {supportedWords.map((word) => (
                <Card key={word} className="bg-gray-800 border-gray-700">
                  <CardHeader className="py-2">
                    <CardTitle className="text-md text-center">{word}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="phrases" className="mt-0">
            <h2 className="text-xl font-semibold mb-4 text-purple-400">Conversation Phrases</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {supportedPhrases.map((phrase) => (
                <Card key={phrase} className="bg-gray-800 border-gray-700">
                  <CardHeader className="py-2">
                    <CardTitle className="text-md">{phrase}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500 max-w-3xl">
        <p>Position your hand clearly in view of the camera for best results</p>
        <p className="mt-1">Hold each sign steady for better recognition</p>
        <p className="mt-1">String multiple signs together to form words and phrases</p>
        <p className="mt-2 text-blue-400">Try practicing common phrases to build conversational skills!</p>
      </div>
    </div>
  );
};

export default Index;
