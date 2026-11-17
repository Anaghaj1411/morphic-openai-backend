import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { retrieveKnowledge } from "./knowledge/retriever.js";
import { rateLimit } from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 10000;

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many AI requests. Please try again later."
  }
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MORPHIC OpenAI Backend"
  });
});

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

app.post("/api/feedback-test", async (req, res) => {
  try {
    const sculptureData = req.body;

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

    const userQuestion = sculptureData.context.userQuestion || "";
    const currentTool = sculptureData.context.currentTool || "";
    const currentStage = sculptureData.context.currentStage || "";

    const knowledgeQuery = [
      currentTool,
      currentStage,
      userQuestion
    ]
      .filter(Boolean)
      .join(" ");

    const knowledgeResults = await retrieveKnowledge(knowledgeQuery);

    const knowledgeContext = knowledgeResults
      .map((result) => result.content)
      .join("\n\n---\n\n");

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

app.post("/api/feedback", aiLimiter, async (req, res) => {
  try {
    const sculptureData = req.body;

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

    if (!client) {
      return res.status(500).json({
        success: false,
        error: "OpenAI API key is not configured on the server."
      });
    }

    const userQuestion = sculptureData.context.userQuestion || "";
    const currentTool = sculptureData.context.currentTool || "";
    const currentStage = sculptureData.context.currentStage || "";

    const knowledgeQuery = [
      currentTool,
      currentStage,
      userQuestion
    ]
      .filter(Boolean)
      .join(" ");

    const knowledgeResults = await retrieveKnowledge(knowledgeQuery);

    const knowledgeContext = knowledgeResults
      .map((result) => result.content)
      .join("\n\n---\n\n");

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",

      instructions:
        "You are Lisa, the pottery-studio host in MORPHIC. " +
        "Use the game manual and the current sculpture data. " +
        "Answer only the player's userQuestion. " +
        "Follow context.replyInstruction and replyLanguage. " +
        "Use context.currentTool so lantern, teapot, and keris stay distinct. " +
        "Do not click buttons or run Unity code. " +
        "Return only the required structured response. " +
        "HOW-TO: keep message under 25 words. One path only. At most 3 short numbered steps. " +
        "Use exact button labels. feedbackType explanation. " +
        "WORK REVIEW: if they ask how their work looks, what you think, or for feedback on the piece, " +
        "use context.craftSummary, colors, designs, width/height and other shape numbers, " +
        "hasStamp, hasSelfie, bands, clayCoils, and vertexSculpt. " +
        "Give warm specific praise naming those real details. Do not invent missing details. " +
        "If they have barely started, encourage a first shape or color. " +
        "2 to 4 short spoken sentences, up to 70 words. feedbackType encouragement. " +
        "Do not give how-to steps unless they also asked how to do something.",

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

app.listen(PORT, () => {
  console.log(`MORPHIC backend running on port ${PORT}`);
});