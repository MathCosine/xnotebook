# xleaf: product plan

## The pitch

**Spill it in class. Find it filed later.**

In class you can't always keep a tidy notebook. You hear something worth remembering, and the moment's gone by the time you've found the right page. xleaf is a notebook you can throw half-sentences at. Every bit gets filed under the right topic, cleaned up, and the things your teacher said would be on the test are highlighted. Afterwards you have notes organised by topic, ready to study from, without having organised anything.

**For:** high-school and university students, especially in lecture-heavy subjects (biology, history, chemistry, economics) where a lot of small facts arrive quickly.

**Why it's different:** note apps make you decide where something goes *before* you write it. xleaf decides after. Capture costs one keystroke, and organisation happens on its own.

## The core loop

1. **Pick the class.** One notebook per class, chosen in the sidebar.
2. **Jot.** Type a bit and press Enter. Typos and shorthand are fine.
3. **It files itself.** Within a second the bit lands under a topic tab. The "just jotted" strip shows where each one went, and a tap moves it.
4. **It gets checked.** After class, a stronger model reads back over the new bits, fixes mistakes, and leaves a red-pen margin note if a fact looks wrong.
5. **Study by topic.** Open a tab, or the **On the test** tab for every exam hint, and export to Markdown if you want.

## What's built (v0.1, this branch)

| Area | Done |
| --- | --- |
| Capture | Jot box with Enter-to-file, `#topic` routing, `!!`/"on the test" detection, "just jotted" strip with one-tap re-filing, `/` or `n` shortcut |
| On-device filing | TF-IDF matcher that learns from filed bits; kind detection (fact, definition, exam, todo, question, formula); "looks like a topic" suggestions for Loose leaf |
| AI filing | Claude Haiku via Puter.js: topic, kind and a tidied rewrite with LaTeX, batched; the original is always kept |
| AI review | Claude Sonnet re-checks filing, faithfulness and facts after ~8 quiet minutes, every 12 new bits, or on demand; red-pen margin notes; merge suggestions for duplicate topics |
| Notebook | Binder tabs, Loose leaf, On the test, pinning, inline edit, drag onto tabs, merge/rename/recolour/delete topics, Markdown export, JSON backup |
| Sync | Supabase email+password auth, row-level security, offline outbox with retry, cross-tab safety, "move this device's notebooks into my account" |
| Design | Paper and Chalkboard themes, ruled lines aligned to the text, marbled composition-book covers, hand-drawn SVG illustrations and icons, phone layout, installable |
| Hosting | GitHub Actions → GitHub Pages; tests run before every deploy |

## Running costs

| | Now (just you) | 1,000 students |
| --- | --- | --- |
| Hosting (GitHub Pages) | $0 | $0, or Cloudflare Pages at $0 |
| Database + auth (Supabase) | $0 | $0 (free tier: 500 MB, 50k monthly users); $25/mo Pro once you need backups and no pausing |
| AI | $0 (Puter user-pays) | $0 to you; each user's Puter allowance covers their usage |

The user-pays model is what makes this sellable without a budget: AI cost never lands on you.

## Roadmap

**v0.2: better in class**
- Offline-first service worker, so it opens with no signal at all (the data layer already queues writes).
- Auto-pick the notebook from a class timetable ("it's 10am Tuesday → Chemistry").
- Voice jot: hold to dictate a bit (Web Speech API).
- Photo of the whiteboard → Claude reads it and files the bits (vision).
- Undo history for AI changes ("Sonnet moved 3 bits, undo").

**v0.3: studying**
- Flashcards generated from definitions and exam hints, with spaced repetition.
- "Quiz me on this topic": Claude asks questions built only from your own notes.
- A one-page study sheet per topic.
- Export to Anki, Notion and Google Docs.

**v0.4: sharing**
- Read-only share links for a notebook (send your notes to a friend who missed class).
- Class notebooks that several students jot into, with merged and deduplicated bits.

## Making it sellable

- **Name and brand:** *xleaf* (xnotebook + looseleaf) has a logo, favicon, wordmark and two themes. Before going public, check the domain and App Store name.
- **Pricing:** free forever with on-device filing plus Puter AI. Optionally, *xleaf Pro* at about $3/mo for students who don't want a Puter account: AI on our own API key with a usage cap, flashcards and quizzes, and unlimited share links.
- **Distribution:** a landing page (the welcome screen is most of one), TikTok/Reels of "watch my lecture notes organise themselves", student ambassadors, and a Product Hunt launch around back-to-school.
- **App stores:** wrap the same web app with Capacitor for iOS and Android once the offline service worker lands.
- **Trust:** notes are private by default (row-level security), AI edits are always reversible, and export is one click, so nobody is locked in.

## Open questions

1. Should AI rewrites keep the student's voice (lowercase, shorthand) or go full textbook? Right now it's in between: fixed and clarified, but short.
2. Should Sonnet's margin notes be allowed to *correct* the text, or only flag it? Currently it only flags, so the student decides.
3. One notebook per class, or one big notebook with classes as top-level topics?
