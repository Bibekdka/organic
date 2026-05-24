import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize the Gemini client securely on the server-side
  const apiKey = process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Enable JSON request body parsing
  app.use(express.json());

  // API Routes MUST be mounted BEFORE Vite middleware
  app.post("/api/gemini/insights", async (req, res) => {
    try {
      const { expenses } = req.body;
      if (!expenses || !Array.isArray(expenses)) {
        return res.status(400).json({ error: "Invalid expenses data. Must be an array." });
      }

      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is missing on the server. Please configure it in your Settings."
        });
      }

      // Use 'gemini-3.5-flash' for basic text tasks like spending analysis insights
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          Analyze the following cooperative organization expenses and provide 3-4 professional, concise insights about spending patterns, potential savings, or financial health.
          
          Expenses:
          ${JSON.stringify(expenses.slice(0, 50))} 
          
          Format your response as a JSON array of strings. Only return the JSON array.
        `,
      });

      const text = response.text || '';
      
      // Extract the JSON block
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.json({ insights: parsed });
        } catch (parseError) {
          console.error("Failed to parse Gemini output text to JSON:", parseError);
        }
      }

      // Fallback response if the model didn't output a valid JSON format
      return res.json({
        insights: [
          "Regularize monthly subscription services to reduce overhead costs.",
          "Identify and consolidate utility and transportation vendors.",
          "Ensure large capital acquisitions are planned and authorized in advance."
        ]
      });

    } catch (error: any) {
      console.error("Gemini server proxy endpoint error:", error);
      return res.status(500).json({
        error: error.message || "An error occurred while generating insights from Gemini."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
