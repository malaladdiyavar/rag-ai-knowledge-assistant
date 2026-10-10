
import { GoogleGenAI } from "@google/genai";
import { retrieveDocuments } from "@/lib/documents";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `
You are a document-grounded knowledge assistant.
Answer using only the supplied document excerpts.
Do not invent facts or sources.
If the documents do not contain the answer, clearly say so.
Mention the source filenames in your answer.
Keep answers clear and concise.
`;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_actual_api_key_here") {
      return NextResponse.json(
        {
          error:
            "Gemini API key is missing. Add your real key to .env.local and restart the server.",
        },
        { status: 500 }
      );
    }

    let body: { question?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body. Please submit a question." },
        { status: 400 }
      );
    }

    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Your question must be 1000 characters or fewer." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Retrieve relevant passages from the local knowledge documents.
    const matches = await retrieveDocuments(question);

    if (!matches.length || matches[0].score < 0.35) {
      return NextResponse.json({
        answer:
          "I couldn't find sufficiently relevant information in the available documents.",
        sources: [],
      });
    }

    const context = matches
      .map(
        (match, index) =>
          `Excerpt ${index + 1}\nSource: ${match.source}\n${match.text}`
      )
      .join("\n\n");

    const result = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2,
      },
      contents: `Use the following retrieved excerpts to answer the question.

${context}

Question: ${question}

Cite the source filename in your answer.`,
    });

    const answer = result.text?.trim();

    if (!answer) {
      throw new Error("Gemini returned an empty response.");
    }

    const sources = [
      ...new Set(matches.map((match) => match.source)),
    ];

    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error("Chat API error:", error);

    const details =
      error instanceof Error
        ? error.message
        : "An unexpected server error occurred.";

    // Keep detailed errors in the server log, not in public responses.
    return NextResponse.json(
      {
        error:
          "The chat request failed. Check the server terminal for the exact cause.",
        details:
          process.env.NODE_ENV === "development"
            ? details
            : undefined,
      },
      { status: 500 }
    );
  }
}
