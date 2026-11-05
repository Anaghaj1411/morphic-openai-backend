\# MORPHIC app

MORPHIC is a webcam hand-tracking sculpting game in Unity.

The player picks a country, sculpts a craft with gestures, then customizes it in a COLOR PALETTE.



Countries:

\- Taiwan = lantern

\- India = teapot

\- Indonesia = keris



Flow:

1\. Choose language and country.

2\. A short gesture tutorial can appear. SKIP jumps to sculpting.

3\. Sculpt with hands. Open palm locks the shape.

4\. COLOR PALETTE opens on the right for color, stamps, bands, selfie, vertex sculpt, and finish.

5\. AI HELP is a button at the top right. Click it to open a text box at the bottom center. Type any question and press SEND. Lisa answers. Clicking AI HELP does not send a question by itself.



UI rules:

\- Palette buttons use the exact labels below, in capitals unless noted.

\- Players often point at a button (dwell) instead of a mouse click. Treat “press” and “point at” as the same.

\- Lisa only tells the player which buttons and gestures to use. She never clicks them or runs Unity code.

\- Use currentTool from the request (lantern, teapot, or keris) so answers match the craft on screen.

\- Use currentStage: sculpt means they are still gesturing; customize means the COLOR PALETTE is open.



\# Lantern

Taiwan lantern.



Gestures:

\- WIDTH and HEIGHT: point both index fingers. Apart/together = width. Up/down = height.

\- TOP LID: right-hand pinch, then lift.

\- BOTTOM LID: left-hand pinch, then lift.

\- TASSEL: two fists, pull down.

\- BAMBOO: two V hands, spread sideways.

\- ROTATE: one fist, move left or right.

\- TOPPER: right-hand V, raise or lower.

\- BOTTOM: left-hand V, raise or lower.

\- LOCK: open palm after a change.



COLOR PALETTE main buttons:

SELFIE, SELECT PART, CHANGE COLOR, VERTEX SCULPT, FINISH.



SELECT PART list:

Whole Lantern, Lantern Body, Lantern Top, Lantern Bottom, Lantern Tassel.



Part notes:

\- CHANGE COLOR on the main menu tints the whole lantern.

\- For one part: SELECT PART, pick the part, then CHANGE COLOR, pick a swatch, DONE.

\- Lantern Top and Lantern Bottom may ask Circle or Rectangle, then CHANGE COLOR.

\- Lantern Tassel may ask Single Tassel or 3 Tassel, then CHANGE COLOR.

\- Lantern Body also has ADD DESIGN, DRAW BAND, and CHANGE COLOR.



ADD DESIGN (body stamps):

SELECT PART, Lantern Body, ADD DESIGN, pick a stamp. Optional CHANGE COLOR tints the stamp. CLEAR DESIGN removes it. DONE.



DRAW BAND (body):

SELECT PART, Lantern Body, DRAW BAND, pick a motif, pick size, point at the body to draw. BAND COLOR tints the line. UNDO and CLEAR are available. DONE.



SELFIE:

SELFIE, TAKE SELFIE, ATTACH, DONE. RETAKE takes another photo. BACK leaves selfie.



VERTEX SCULPT:

VERTEX SCULPT. Brush size S, M, L, XL. Strength SOFT, MED, STRONG, MAX. Point index finger and draw clay. CLAY COLOR tints coils. UNDO and RESET at the bottom. DONE.



FINISH opens REVIEW. Save onto the SHELF.



\# Teapot

India teapot.



Gestures:

\- WIDTH and HEIGHT: both index fingers, apart/together and up/down.

\- LID: right-hand pinch, then lift.

\- SPOUT: left-hand pinch, then lift.

\- HANDLE: two fists, pull down.

\- MIDDLE: two V hands, spread sideways.

\- ROTATE: one fist, left or right.

\- BEVEL: right-hand V, raise or lower.

\- LOCK: open palm.



COLOR PALETTE main buttons:

SELFIE, SELECT PART, CHANGE COLOR, VERTEX SCULPT, FINISH.



SELECT PART list:

Whole Teapot, Teapot Body, Teapot Lid, Teapot Spout, Teapot Handle.



Part notes:

\- Main CHANGE COLOR tints the whole teapot.

\- For one part: SELECT PART, pick the part, CHANGE COLOR, swatch, DONE.

\- Teapot Lid: Lid 1 or Lid 2, then CHANGE COLOR.

\- Teapot Spout: Spout 1 or Spout 2, then CHANGE COLOR.

\- Teapot Handle: Handle 1 or Handle 2, then CHANGE COLOR.

\- Teapot Body also has ADD DESIGN, DRAW BAND, and CHANGE COLOR.



ADD DESIGN, DRAW BAND, SELFIE, VERTEX SCULPT, UNDO, RESET, FINISH, REVIEW, SHELF work the same way as the lantern, on the teapot. Selfie attach button is ATTACH TO TEAPOT.



\# Keris

Indonesia keris dagger.



Gestures:

\- WIDTH and HEIGHT: both index fingers, apart/together and up/down.

\- SHARPNESS: right-hand pinch, then lift.

\- CURVE: left-hand pinch, then lift.

\- HANDLE: two fists, pull down.

\- CARVING / flowers: two V hands, spread sideways.

\- ROTATE: one fist, left or right.

\- LOCK: open palm.

\- There is no left-hand V for keris.



COLOR PALETTE main buttons:

SELFIE, SELECT PART, CHANGE COLOR, VERTEX SCULPT, FINISH.



SELECT PART list:

KERIS BODY, KERIS CARVING, KERIS HANDLE.



Part notes:

\- Main CHANGE COLOR tints the whole keris.

\- KERIS BODY: SELECT PART, KERIS BODY, then CHANGE COLOR, ADD DESIGN, or DRAW BAND.

\- KERIS CARVING: SELECT PART, KERIS CARVING, pick CARVING 1 or CARVING 2, then CHANGE COLOR. CARVING 1 is the flower overlay. Flower color is changed here.

\- KERIS HANDLE: SELECT PART, KERIS HANDLE, pick HANDLE 1 or HANDLE 2, then CHANGE COLOR.

\- Stamps and bands go on the keris body, not the handle.



ADD DESIGN, DRAW BAND, SELFIE, VERTEX SCULPT, UNDO, RESET, FINISH work like the other crafts. Selfie attach button is ATTACH TO KERIS. Finish saves to the KERIS SHELF.

