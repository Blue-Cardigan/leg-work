import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";

const MODEL_NAME = "gemini-1.5-flash"; // Or your preferred model
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing environment variable: GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
   model: MODEL_NAME,
   // Add system instructions if desired
   // systemInstruction: "You are a helpful assistant specializing in UK legislation.",
 });

// Define safety settings (adjust as needed)
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Helper function to create a ReadableStream from the Gemini response
function createStream(iterator: AsyncGenerator<any>) {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        // Ensure we're sending strings
        const text = value?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        controller.enqueue(new TextEncoder().encode(text));
      }
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { history, message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (!Array.isArray(history)) {
       return NextResponse.json({ error: 'History must be an array' }, { status: 400 });
    }

    // Basic validation/mapping of history (ensure roles are correct)
    const chatHistory: Content[] = history.map((item: { role: string; parts: { text: string }[] }) => ({
        role: item.role === 'user' ? 'user' : 'model', // Map roles strictly
        parts: item.parts
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000, // Adjust as needed
        // Consider adding temperature, topK, topP if needed
      },
      safetySettings,
    });

    console.log("Sending message to Gemini:", message);
    const result = await chat.sendMessageStream(message);

    // Create a streamable response
    const stream = createStream(result.stream);
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error('Error processing chat request:', error);
    // Avoid leaking internal details in production errors
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Failed to process chat request: ${errorMessage}` }, { status: 500 });
  }
} 