# Visual practice · 1.10

This supplements [REBUILD](REBUILD.md) and [Exercise workspace](EXERCISE-WORKSPACE.md). It changes presentation and adds optional recall; the saved project schema and deterministic generator are unchanged.

## Reading the neck

Every fret remains a full-cell mouse, touch and keyboard target of at least 44 × 44 CSS pixels. Membership changes its symbol, not its hit area:

| State | Symbol |
| --- | --- |
| Outside the key, unused | 24px neutral disc |
| In the key, unused | 32px colored ring |
| Used anywhere in the pattern | 36px filled, rounded square |
| Used in the pattern but outside the key | Filled square with a dashed dark border |
| Current selected or playing step | Additional white outline |

Membership is the set of exact `stringId:fret` positions from all saved events. An equivalent pitch on another string does not become a pattern position. Rests add nothing. The current step remains a separate layer: playback highlights its actual notes, and chord lines connect only that chord. A small dot marks the tonic. Interval colors still follow the chosen reference; retain the warm major-third / cool minor-third palette and contrast-aware foregrounds for custom colors. The short symbol legend appears above the neck in Learn/Practice. Accessible names announce pitch, string, fret, pattern/key membership and selection. Wood grain is retained in every workspace.

`note-state.js` holds pure membership and legend rendering. `app.js` builds the fretboard; `workspace.js` places the legend and challenge in the simple workspaces. `workspace.css` is the final stylesheet after `styles.css` and `compact.css`. Do not restore the older rule that hides all outside-key notes.

## Dragging practice values and windows

Practice length (1–64) and speed (30–240 quarter notes/minute) have native sliders beside exact numeric entry. A fixed length slider disables when Random count is checked. Numeric entry keeps existing validation.

Random count, string-count and notes-per-string bounds use the same window control as per-string fret limits. Bounds are inclusive integers, respectively 1–64, 1–12, 1–16 and 0–36. Numbered endpoints resize; the middle grip translates both ends. A translation keeps the width, clamping the shift against the domain edges. An endpoint stops at the opposite endpoint. Numeric crossing remains an explicit validation error.

`range-controls.js` implements pure `moveWindow`, `resizeWindow` and `pointerValue`, shared track markup, pointer/keyboard control, and value sliders. Each track carries its key, domain and optional reversed orientation. `practice-ranges.js` connects fret and Practice windows to one validated project transaction. `practice-view.js` supplies their markup.

- Pointer movement previews only DOM values. Release commits once, so one Undo restores both endpoints. Numeric entry commits on change.
- Capture only the primary pointer and match its ID. Cancel on Escape, pointer cancellation, lost capture, window blur, hidden document or application re-render. A cancelled value slider ignores later movements of the same gesture. No cancelled preview reaches storage or the generator.
- Arrow keys move one unit; Shift + arrows move five on a window. Home/End move to the allowed edge. A band preserves width for keyboard movement too. Left-handed fret windows reverse horizontal movement only; numeric values and vertical arrows keep their meaning.
- Fret ranges remain constraints for future generation. Moving one never moves saved or kept notes. Existing intersections with visible frets, capo, key, pitch, string pool and reach rules remain in force. Invalid combinations fail atomically.

## Optional recall

**Challenge yourself** is a collapsed section in Learn and Practice. It offers three exercises:

1. **Find notes:** choose from unique key pitch classes reachable on visible enabled strings. Accept any octave of the requested note.
2. **Find intervals:** use the same reachable key tones. Ask for a named interval and its explicit 0–11 half-step distance above the current home. Accept the pitch class in any octave. Spell out major/minor; never lowercase interval abbreviations, which would confuse M3 with m3. Tritone is spelling-neutral.
3. **Recall melody:** retain sounding events in order, including repeats, and skip rests. Require the exact MIDI pitch, accepting alternate string positions with that pitch. Reject multi-note chords, empty patterns and any melody whose pitches are unreachable in the visible enabled instrument. This exercise checks pitch recall only, not rhythm or physical performance.

Start creates an ephemeral deck, shuffled for note/interval rounds and ordered for melody. A fresh fret attack counts one attempt. Holding, bending and sliding never create extra attempts; a solved target stays solved until Next. Reference audio does not grade itself. Wrong guesses name the played pitch and allow retry. Count solved questions and first-try successes for this session. Finish shows the round result; Try again starts fresh. Closing the section ends the session. Key/instrument changes reset a challenge; melody content changes also reset melody recall. Navigating workspaces does not edit music.

**Hide hints** temporarily gives every fret the same neutral symbol and hides pitch labels, tonic markers, pattern colors, lesson-note strip, chord lines and timeline answers. Accessible fret names become string/fret coordinates too. The physical tuning labels remain. End/close/uncheck restores all hints. Keep the prompt, explicit feedback and Hear target available. This is a learning aid, not persistent progress tracking or a microphone-based assessment.

`recall.js` exports pure target construction and pitch judging, plus an ephemeral controller. `expression.js` reports attacks separately from continuous pitch changes. Session state never enters project JSON or Undo history.

## Acceptance

Run syntax, pure tests and build. Browser regression adds desktop and native touch-emulated gestures for values/windows, one-step Undo, preview isolation, Escape/pointer cancellation, crossing, left-handed direction and persistence. Verify all three symbol sizes, chromatic pattern notes, wrong/correct guesses, exact melody register, hidden accessible labels, restored hints and unchanged saved music. Keep the broader Learn/Practice/Studio, audio, layout, worker and import/export regression. Visually inspect desktop and narrow layouts; automated Web Audio checks do not establish human listening quality or learning outcomes. Final release evidence belongs in [DEPLOYMENT](DEPLOYMENT.md).
