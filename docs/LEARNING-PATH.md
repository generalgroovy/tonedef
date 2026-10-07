# ToneDef 1.11 — learning through practice

This is the current supplement to [REBUILD](REBUILD.md), [Exercise workspace](EXERCISE-WORKSPACE.md) and [Visual practice](VISUAL-PRACTICE.md). Existing instrument, gesture, pattern, theory, generation, lock, import/export and layout contracts remain in force. No new account, runtime dependency, project field or storage migration is needed.

## Product contract

- Learn → Practice → Studio remains the main navigation; Arrange lives in Studio. No skill-level gate hides functionality. Learn defaults to Notes, with six numbered topics in a compact 3×2 grid: Notes, Steps, Scales, Intervals, Chords, Modes. A next-topic button offers direction; every topic is directly selectable.
- Explain actual actions. A note attack or pitch-strip click supplies a note name and its relation to the current home/scale. Outside-scale notes are described as possible tension, not errors. Note names include the octave. Info defines strings, open strings/capo, fret distances, sharps/flats, degrees and intervals.
- Pair lessons keep the first attack as the starting pitch and compare every later attack to it until New pair. Spell both pitches with current settings, then use the existing `intervalBetween`; preserve quality, direction and compound size. E3→C3 is a major third down four half steps; C3→E4 is a major tenth up sixteen. Use full interval words, not a semitone-only lookup. Continuous bend/slide updates do not create new attacks or silently change the pair.
- The feedback card is the one simple-view explanation, not another interval table. In stacked layouts (width ≤1100 or height ≤700), move that same card above the fretboard so it stays beside the action; a Try it on the neck link jumps there. Move it back to the lesson sidebar when the layout widens. Do not create duplicate feedback nodes. Hear pair uses the independent finite lesson player and never overwrites the saved pattern. Escape, navigation, key changes and other sound gestures stop it. New pair clears both notes and returns focus to the fretboard. Key/collection/spelling/topic changes clear stale explanations. Lessons do not commit music or create Undo entries.
- Chords is a lesson sandbox. For any recognised seven-note scale with sequential diatonic degrees, choose degree d∈0…6 and build indices d,d+2,d+4. Pitch is `60+tonic+scale[index%7]+12*floor(index/7)`. Spell using the scale; recognise the exact chord with its chosen root. Display quality and half steps from that chord root (not always home), with Root/Third/Fifth pitch buttons. Hear chord tones arpeggiates the three exact pitches. Pentatonic, chromatic, empty and custom unsupported collections show an explicit seven-note-scale prompt; never silently substitute major. Root choice is ephemeral, not a project edit.

## Practice goals and depth

Promote the existing recipe selector to the top of Practice with optgroups Start here, Build fluency, Stretch your control. Show one-line aim; keep instructions and extensions in How to practise · go deeper. Recipes only configure future-generation settings. New pattern is still explicit and undoable. Existing music, locks, tuning, ranges and Random flags are preserved. Impossible combinations retain the existing actionable failure behavior.

Eight recipes: previous Scale walk, Thirds study, Triplet groups, Four-note groups, Chord pulse, Dotted line, plus:

- **First notes & pulse**: melodic base (`inKey=true`, no repeated adjacent pitch, no rests, alternate picking, maxLeap12, appendfalse), 4 melody events, ascending scale steps, steady rhythm, duration96, tempo60.
- **Seventh-chord changes**: progression/chord editor, appendfalse, 4 events, free sequence, random contour, steady rhythm, duration192, seventh vocabulary, inKeytrue, rests0, down picking, tempo60.

Match a goal by generation type, sequence, rhythm, in-key rule, rest rate; also duration for steady rhythm and vocabulary for progression. Tempo, length, direction and physical constraints remain adjustable. A different motif shows Custom pattern. The cue explains a useful task; the extension links concepts to advanced tools (ranked motion, chord interpretation, inversions, different grouping against the beat). Do not label generated progressions as functional compositions or pentatonic skip-one pairs as universally thirds.

Practice More choices adds picking and conditionally finger order, using the existing schema exactly once. These affect new generated events; existing event picking remains explicit in Studio. Timing guidance reads the actual saved event durations, including rests and locks, rather than the next-generation recipe. Quarter-note BPM is the existing tempo unit even in compound meter. One pass seconds = sum(duration)/96×60/tempo.

## Self-assessed practice loop

`src/practice-coach.js` owns pure session transitions and a small DOM controller. Practise this pattern is a native disclosure in Practice, after speed/repeat. Start requires at least one sounding event. Listen to the saved pattern with the existing Play control; play on the physical instrument; mark Clean pass or Needs work. The app explicitly does not listen to or grade the instrument.

Session shape: `{active,streak,passes,best,tempo,message}`; no localStorage. Start resets it. Clean adds one total pass and increments a capped 0…3 streak at current tempo. Three passes record a best completed tempo and reveal an optional `min(240,tempo+5)` action. Needs work resets the streak. Slower uses `max(30,tempo−5)`. Speed changes use the normal project transaction and Undo. They never occur automatically and never start playback. Any changed tempo, including Undo, resets the streak but retains session totals/best. End deactivates the session. Closing/reopening the disclosure or changing view keeps the in-memory session. A reload does not.

Reset on changes to the actual exercise identity: home/collection, capo, physical strings/tuning/enabled state, meter, or event kind/duration/picking/fingers/physical note positions and sounding pitches. Ignore event IDs, selection, locks, tempo, display and future-generation rules. This prevents credit carrying to different music while allowing selection/Keep step during practice. Render and UI actions synchronise identity before using the session. Preserve keyboard focus when the speed-increase button disappears. Session marks never touch project history; only explicit speed changes do.

## Ear matching

Extend the existing recall selector with Match by ear. Targets are unique visible enabled-string pitch classes from the current key; select a real visible representative, shuffle once each round and accept any octave. Start and Next play the current target using an audio-only audition; the prompt never names the target or its interval. Start turns Hide hints on. Hear target repeats it without grading. A wrong attack names only the attempted pitch; a correct attack can reveal the answer. Score once per target. Keep existing challenge context resets, physical-fret accessibility, melody exact-register policy and project preservation. If volume is zero, explain how to unmute rather than start a silent ear exercise.

Hide hints also hides the new lesson feedback and chord description, alongside the pitch strip, note legend and pattern. Do not publish target names through fret ARIA labels or target-audio highlighting. Learner explanations pause while a challenge is active. Closing/ending restores the previous lesson normally.

## Files and acceptance

Changed areas: `src/learning.js` (pure lesson content/theory), `src/app.js` (ephemeral lesson state/audio integration), `src/exercises.js` (goals/recipes), `src/practice-view.js`, new `src/practice-coach.js`, `src/recall.js`, and `workspace.css` (3-column navigation, compact feedback, session controls). Build automatically includes all `src/*.js`.

Run `npm test`, `npm run check`, `npm run build`. Tests cover all 12 roots and all degrees of every supported seven-note scale, spelling/octave/quality, compound/directional intervals, unsupported scales, untouched inputs, session reset identity, tempo/streak/Undo semantics and all eight generators. `scripts/learning-path-checks.mjs` runs inside the existing isolated Playwright CI suite on 1366×768,1280×720,390×844 touch,320×800 touch. Exercise real attacks, keyboard focus, Hear/Stop/Escape, chord degree changes, ear hint masking, self-assessment, tempo Undo, new-music reset and advanced picking. Existing 21-context regression still checks all advanced inventory, ranges, audio, constraints and layout. Retain failure screenshots.

Validate the candidate branch before main. After Pages succeeds, compare build manifest and every runtime file with committed bytes over validated HTTPS, then smoke-test the public app without replacing the user's saved music. Record exact revisions and results in DEPLOYMENT. These are software and emulated-interaction checks; they do not establish physical performance, an independent usability study or learning outcomes.

## Theory references

The interval implementation and explanations were checked against the quality/number, enharmonic and compound-interval distinctions in [Open Music Theory: Intervals](https://viva.pressbooks.pub/openmusictheory/chapter/intervals/). The chord lesson follows root/third/fifth and the four basic triad qualities described in [Open Music Theory: Triads](https://viva.pressbooks.pub/openmusictheory/chapter/triads/). Explanations and practice cues are original concise summaries. Three self-reported passes and a 5 bpm suggestion are adjustable-workflow conventions, not a scientifically validated assessment of mastery.
