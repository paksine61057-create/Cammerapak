
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getBackgroundIdeas = async (presentationTopic: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `I am giving a presentation on "${presentationTopic}". Suggest 3 visual descriptions for a professional background that would match this topic. Return as JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return ["A modern minimalist office", "A soft abstract gradient", "A clean tech-themed workspace"];
  }
};
