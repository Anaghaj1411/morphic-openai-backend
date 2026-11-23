import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { retrieveKnowledge } from "./knowledge/retriever.js";
import { buildSculptureFacts, formatSculptureFacts } from "./lib/sculptureFacts.js";
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

app.post("/api/sculpture-data", async (req, res) => {
  try {
    const sculptureData = req.body;

    if (!sculptureData || typeof sculptureData !== "object") {
      return res.status(400).json({
        success: false,
        error: "Request body must be a JSON object."
      });
    }

    res.json({
      success: true,
      sculptureData
    });

  } catch (error) {
    console.error("Sculpture data retrieval failed:", error);

    res.status(500).json({
      success: false,
      error: "Sculpture data retrieval failed."
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

    // Detect work review questions to enhance knowledge retrieval
    const isWorkReview = /how (do|does|is|are|did|was).*(look|looks|work|works)|what (do|do you).*(think)|feedback|review|opinion|judgment|evaluate|critique/i.test(userQuestion);

    const knowledgeQuery = [
      currentTool,
      currentStage,
      isWorkReview ? "review feedback evaluation" : "",
      userQuestion
    ]
      .filter(Boolean)
      .join(" ");

    const knowledgeResults = await retrieveKnowledge(knowledgeQuery);

    const knowledgeContext = knowledgeResults
      .map((result) => result.content)
      .join("\n\n---\n\n");

    const sculptureFacts = formatSculptureFacts(buildSculptureFacts(sculptureData));

    res.json({
      success: true,
      testMode: true,
      knowledgeQuery,
      retrievedResults: knowledgeResults,
      sculptureFacts,
      preparedInput:
        "Relevant MORPHIC knowledge:\n\n" +
        knowledgeContext +
        "\n\n" +
        sculptureFacts +
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

    // Detect work review questions to enhance knowledge retrieval
    const isWorkReview = /how (do|does|is|are|did|was).*(look|looks|work|works)|what (do|do you).*(think)|feedback|review|opinion|judgment|evaluate|critique/i.test(userQuestion);

    const knowledgeQuery = [
      currentTool,
      currentStage,
      isWorkReview ? "review feedback evaluation" : "",
      userQuestion
    ]
      .filter(Boolean)
      .join(" ");

    const knowledgeResults = await retrieveKnowledge(knowledgeQuery);

    const knowledgeContext = knowledgeResults
      .map((result) => result.content)
      .join("\n\n---\n\n");

    const sculptureFacts = formatSculptureFacts(buildSculptureFacts(sculptureData));

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",

      instructions:
        "You are Lisa, the warm and friendly pottery-studio host in MORPHIC. " +
        "You're like a patient art teacher who genuinely cares about each student's creative journey. " +
        "Use natural, conversational language - vary your sentence structure and word choice. " +
        "Add warmth with phrases like 'lovely', 'beautiful', 'great job', 'I love how you...' " +
        "Use the game manual and the current sculpture data. " +
        "Answer only the player's userQuestion. " +
        "Follow context.replyInstruction and replyLanguage. " +
        "Use context.currentTool so lantern, teapot, and keris stay distinct. " +
        "Do not click buttons or run Unity code. " +
        "Return only the required structured response. " +
        "HOW-TO: keep message under 25 words. One path only. At most 3 short numbered steps. " +
        "Use exact button labels. feedbackType explanation. " +
        "WORK REVIEW: if they ask how their work looks, what you think, or for feedback on the piece, " +
        "use only VERIFIED SCULPTURE FACTS. Those facts already read craftSummary, colors, designs, " +
        "width/height and other shape numbers, hasStamp, hasSelfie, bands, clayCoils, and vertexSculpt. " +
        "CRITICAL: Only comment on features listed as present or given a value. " +
        "If a feature is absent or unrecorded, do not mention it. " +
        "COLORS: Never name a color from a hex code yourself. The facts already name every recorded color. " +
        "Use those exact color words. Do not say terracotta, crimson, azure, mauve, or any name that is not in the facts. " +
        "Attach a color to a part only when that part is listed beside the color. " +
        "If the facts say the part is unknown, talk about the overall palette and do not assign the color to a top, bottom, body, tassel, lid, spout, handle, blade, or carving. " +
        "If the facts say no colors are recorded, do not mention color at all. " +
        "PART NAMES: Use exact part names from the game manual. " +
        "For lantern: 'Lantern Top' (top cap), 'Lantern Bottom' (base), 'Lantern Tassel', 'Lantern Body'. Do not confuse these. " +
        "For teapot: 'Teapot Lid', 'Teapot Spout', 'Teapot Handle', 'Teapot Body'. Do not confuse these. " +
        "For keris: 'KERIS BODY' (blade), 'KERIS CARVING' (decorative overlay), 'KERIS HANDLE' (grip). Do not confuse these. " +
        "First, praise specific strengths with genuine enthusiasm (colors that work well, interesting shapes, good patterns). " +
        "Use varied praise phrases: 'That's gorgeous!', 'I really like...', 'Wonderful choice of...', 'You've got a great eye for...' " +
        "Then, offer 1-2 gentle, constructive suggestions (try complementary colors, add contrast, balance proportions). " +
        "Suggest specific color combinations or design ideas that would enhance the piece. " +
        "Frame suggestions as possibilities, not commands: 'You might consider...', 'Have you thought about...', 'Maybe try...' " +
        "Do not invent missing details. If they have barely started, encourage warmly: 'Let's start with a shape!', 'Pick a color and go for it!' " +
        "3 to 5 short spoken sentences, up to 100 words. feedbackType encouragement. " +
        "Sound like a real person talking, not a robot. Mix short and medium sentences. " +
        "Do not give how-to steps unless they also asked how to do something.",

      input:
        "Relevant MORPHIC knowledge:\n\n" +
        knowledgeContext +
        "\n\n" +
        sculptureFacts +
        "\n\nCurrent sculpture data:\n\n" +
        JSON.stringify(sculptureData) +
        "\n\nIf the raw JSON and VERIFIED SCULPTURE FACTS disagree, trust the facts.",

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