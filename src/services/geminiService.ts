import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getSpendingInsights(expenses: any[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `
        Analyze the following cooperative organization expenses and provide 3-4 professional, concise insights about spending patterns, potential savings, or financial health.
        
        Expenses:
        ${JSON.stringify(expenses)}
        
        Format your response as a JSON array of strings. Only return the JSON array.
      `,
    });

    const text = response.text || '';
    
    // Clean and parse JSON
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return ["Monitor utility costs which are increasing monthly.", "Consider bulk purchase for capital items to reduce overheads."];
  } catch (error) {
    window.console.error("Gemini Insight Error:", error);
    return ["AI Insights are currently unavailable. Please check back later."];
  }
}
