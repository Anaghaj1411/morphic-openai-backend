# MORPHIC — AI Rules

## AI Purpose

The AI provides contextual feedback, suggestions, explanations, and creative guidance based on information provided by the application.

## AI Input

The application should send meaningful event information rather than continuous tracking data.

The information sent should be limited to what is relevant to the current request.

## AI Output

The AI response should be structured and predictable so that the application can safely interpret it.

## Safety

The AI must not generate or execute arbitrary Unity code or uncontrolled commands.

Any action suggested by the AI must be validated by the application before it is used.

## Triggering

An AI request should occur when:
- the player explicitly asks for help
- a meaningful event requires AI feedback
- the application determines that contextual guidance is useful

Normal continuous interaction should not automatically produce an AI request.

## Flexibility

Project-specific details such as tools, assets, gestures, stages, and gameplay rules should come from the current application state rather than being permanently stored in these rules.