import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MORPHIC OpenAI Backend"
  });
});

// AI feedback
app.post("/api/feedback", async (req, res) => {
  try {
    if (!client) {
      return res.status(500).json({
        success: false,
        error: "OpenAI API key is not configured on the server."
      });
    }

    const sculptureData = req.body;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      instructions:
        "You are an AI assistant for MORPHIC, a digital sculpture project. " +
        "Analyze the user's sculpture information and provide short, helpful " +
        "creative feedback about their digital sculpture. Do not execute " +
        "Unity actions or modify the sculpture directly.",
      input: JSON.stringify(sculptureData)
    });

    res.json({
      success: true,
      message: response.output_text
    });

  } catch (error) {
    console.error("OpenAI request failed:", error);

    res.status(500).json({
      success: false,
      error: "AI request failed."
    });
  }
});

app.listen(PORT, () => {
  console.log(`MORPHIC backend running on port ${PORT}`);
});
