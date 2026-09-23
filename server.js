import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { retrieveKnowledge } from "./knowledge/retriever.js";
import { rateLimit } from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 10000;

// Rate limit only the real AI endpoint
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many AI requests. Please try again later."
  }
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// OpenAI client
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MORPHIC OpenAI Backend"
  });
});


// ==========================================
// RAG RETRIEVAL TEST
// ==========================================

app.get("/api/rag-test", async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Please provide a query using ?q="
      });
    }

    const results = await retrieveKnowledge(query);

    res.json({
      success: true,
      query,
      results
    });

  } catch (error) {
    console.error("RAG retrieval failed:", error);

    res.status(500).json({
      success: false,
      error: "RAG retrieval failed."
    });
  }
});


// ==========================================
// SAFE AI PIPELINE TEST
// This does NOT call OpenAI
// ==========================================

app.post("/api/feedback-test", async (req, res) => {
  try {
    const sculptureData = req.body;

    // Validate the request
    if (!sculptureData || typeof sculptureData !== "object") {
      return res.status(400).json({
        success: false,
        error: "Request body must be a JSON object."
      });
    }

    if (sculptureData.projectType !== "digital_sculpture") {
      return res.status(400).json({
        success: false,
        error: "Invalid projectType."
      });
    }

    if (!sculptureData.eventType) {
      return res.status(400).json({
        success: false,
        error: "eventType is required."
      });
    }

    if (
      !sculptureData.context ||
      typeof sculptureData.context !== "object"
    ) {
      return res.status(400).json({
        success: false,
        error: "context is required."
      });
    }

    // Build the RAG search query
    const userQuestion = sculptureData.context.userQuestion || "";

    const knowledgeQuery = [
      sculptureData.eventType,
      userQuestion
    ]
      .filter(Boolean)
      .join(" ");

    // Retrieve relevant knowledge
    const knowledgeResults = await retrieveKnowledge(knowledgeQuery);

    const knowledgeContext = knowledgeResults
      .map((result) => result.content)
      .join("\n\n---\n\n");

    // Return prepared data WITHOUT calling OpenAI
    res.json({
      success: true,
      testMode: true,
      knowledgeQuery,
      retrievedResults: knowledgeResults,
      preparedInput:
        "Relevant MORPHIC knowledge:\n\n" +
        knowledgeContext +
        "\n\nCurrent sculpture data:\n\n" +
        JSON.stringify(sculptureData)
    });

  } catch (error) {
    console.error("AI pipeline test failed:", error);

    res.status(500).json({
      success: false,
      error: "AI pipeline test failed."
    });
  }
});


// ==========================================
// REAL AI FEEDBACK
// This endpoint can call OpenAI
// ==========================================

app.post("/api/feedback", aiLimiter, async (req, res) => {
  try {
    const sculptureData = req.body;

    // Validate the request
    if (!sculptureData || typeof sculptureData !== "object") {
      return res.status(400).json({
        success: false,
        error: "Request body must be a JSON object."
      });
    }

    if (sculptureData.projectType !== "digital_sculpture") {
      return res.status(400).json({
        success: false,
        error: "Invalid projectType."
      });
    }

    if (!sculptureData.eventType) {
      return res.status(400).json({
        success: false,
        error: "eventType is required."
      });
    }

    if (
      !sculptureData.context ||
      typeof sculptureData.context !== "object"
    ) {
      return res.status(400).json({
        success: false,
        error: "context is required."
      });
    }

    // Check whether the OpenAI API is configured
    if (!client) {
      return res.status(500).json({
        success: false,
        error: "OpenAI API key is not configured on the server."
      });
    }

    // Build a search query for the RAG system
    const userQuestion = sculptureData.context.userQuestion || "";

    const knowledgeQuery = [
      sculptureData.eventType,
      userQuestion
    ]
      .filter(Boolean)
      .join(" ");

    // Retrieve relevant MORPHIC knowledge
    const knowledgeResults = await retrieveKnowledge(knowledgeQuery);

    const knowledgeContext = knowledgeResults
      .map((result) => result.content)
      .join("\n\n---\n\n");

    // Send current sculpture data + retrieved knowledge to OpenAI
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",

      instructions:
        "You are an AI assistant for MORPHIC, a digital sculpture project. " +
        "Use the provided MORPHIC knowledge and current sculpture data to " +
        "provide short, helpful, contextual creative feedback. " +
        "Do not execute Unity actions or modify the sculpture directly. " +
        "Treat the current sculpture data as the current state of the application. " +
        "Return only the required structured response.",

      input:
        "Relevant MORPHIC knowledge:\n\n" +
        knowledgeContext +
        "\n\nCurrent sculpture data:\n\n" +
        JSON.stringify(sculptureData),

      text: {
        format: {
          type: "json_schema",
          name: "morphic_ai_feedback",
          description:
            "Structured AI feedback for the MORPHIC sculpture application.",
          strict: true,

          schema: {
            type: "object",

            properties: {
              message: {
                type: "string"
              },

              feedbackType: {
                type: "string",
                enum: [
                  "hint",
                  "creative",
                  "explanation",
                  "summary",
                  "encouragement"
                ]
              },

              action: {
                type: "object",

                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "none",
                      "show_hint",
                      "show_summary",
                      "play_encouragement"
                    ]
                  },

                  target: {
                    type: "string"
                  },

                  value: {
                    type: "number"
                  }
                },

                required: [
                  "type",
                  "target",
                  "value"
                ],

                additionalProperties: false
              },

              priority: {
                type: "string",
                enum: [
                  "low",
                  "normal",
                  "high"
                ]
              },

              cooldownSeconds: {
                type: "number"
              }
            },

            required: [
              "message",
              "feedbackType",
              "action",
              "priority",
              "cooldownSeconds"
            ],

            additionalProperties: false
          }
        }
      }
    });

    // Convert the structured AI response into a JavaScript object
    const aiFeedback = JSON.parse(response.output_text);

    res.json({
      success: true,
      feedback: aiFeedback
    });

  } catch (error) {
    console.error("OpenAI request failed:", error);

    res.status(500).json({
      success: false,
      error: "AI request failed."
    });
  }
});


// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`MORPHIC backend running on port ${PORT}`);
});