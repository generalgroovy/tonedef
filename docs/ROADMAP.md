# Roadmap

The current release focuses on fretted guitar/bass exploration and practice generation.

## Progress tracking

Add a separate append-only PracticeSession record: project ID and immutable snapshot/version, date, intended tempo, performed duration, self-rating and optional note. Keep practice outcomes separate from the musical project and generator seed. Require explicit start/finish and clear device-local storage/export. No accuracy score without a validated measurement method. Do not infer improvement from playback duration. A dashboard can summarize repetitions, chosen tempo and user-reported difficulty.

## More instruments

Extract an InstrumentAdapter contract: stable physical positions, sounding pitch mapping, playable candidate enumeration, layout, and technique vocabulary. Preserve absolute MIDI pitch plus notation spelling in the theory engine while keeping the adapter's physical coordinates canonical in each project. A piano adapter has keys; a wind adapter needs instrument transposition and fingering/range data; violin needs continuous pitch/stopped-position decisions. Version migrations and adapter-specific goldens must precede import support. Do not label the existing 1–12 string configuration as a validated adapter for every instrument.

## Subsequent musical depth

Multi-event passage selection; richer rhythmic grammar; explicit chord-tone finger assignments; ergonomic fingering search with hand positions; optional independent-voice matching clearly separate from pitch ranks; valid MIDI export; readable notation and alternative tunings/temperaments. Each should retain exact position/pitch agreement and reversible edits.

## Verification expansion

Firefox/WebKit, physical iOS/Android, screen-reader sessions, real listening and musician playtests. Track observed usability failures and repair them before adding more controls. Runtime evidence and human acceptance remain separate statuses.
