# MORPHIC — Project Overview

## Project Type
MORPHIC is an interactive 3D digital sculpting game controlled through hand and body gestures.

## Core Idea
The player uses a webcam and hand/body tracking to interact with virtual clay.
The player can shape, modify, and refine a digital sculpture through physical movement.

## Interaction Concept
Player movement is converted into meaningful sculpting actions.

Examples include:
- changing the width or height of the sculpture
- rotating the sculpture
- inflating a local region
- indenting a local region
- grabbing and moving a local region
- smoothing a surface
- flattening a surface

The exact tools and controls may change during development.

## Technical Concept
MORPHIC combines:
- Unity for the interactive application
- MediaPipe for hand/body tracking
- Blender for creating and preparing 3D assets
- Unity runtime deformation for local sculpting
- Blender Shape Keys for controlled large-scale transformations
- a backend service for AI integration
- OpenAI for contextual creative feedback

## Hybrid Sculpting Approach
MORPHIC uses two complementary deformation methods:

### Shape Keys
Shape Keys provide predefined large-scale transformations of a base clay form.

Examples:
- width
- height
- depth

### Runtime Sculpting
Runtime sculpting provides local and more flexible deformation.

Examples:
- inflate
- indent
- grab
- smooth
- flatten

The exact sculpture, tools, and transformations can change as the project develops.

## AI Role
The AI should provide contextual feedback based on meaningful sculpture behavior and game state.

Possible AI uses include:
- giving sculpting suggestions
- explaining repeated problems
- providing creative feedback
- summarizing a sculpting session
- responding to player questions
- suggesting what the player could try next

AI should not directly execute arbitrary Unity code or unrestricted commands.

## Important Architecture Principle
Unity records and organizes meaningful player behavior into structured events.

Only when an AI trigger occurs, or when the player requests AI help, should relevant information be sent to the backend.

The backend provides project knowledge and context to the AI and returns a controlled response.

## Flexibility Requirement
MORPHIC is still under development.

The following may change:
- sculpture assets
- cultural content
- locations
- gameplay mechanics
- sculpting tools
- gesture mappings
- story elements
- AI features

The backend knowledge base should therefore be modular and easy to update.