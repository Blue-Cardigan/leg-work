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
   systemInstruction: `You are a helpful assistant specializing in UK legislation drafting.
The user may provide context from the document like this:
Context (lines X-Y):
<context text>

Question: <user question>

When suggesting a specific change *to the provided context*, please format your suggestion like this, containing *only* the modified text based on the context provided:

\`\`\`suggestion
<the exact modified text based *only* on the provided context>
\`\`\`

Only use this format for direct modifications of the provided context. For general discussion, explanations, or suggestions not tied to specific context, use normal text. Do not add any explanations before or after the suggestion block itself.`,
 });

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