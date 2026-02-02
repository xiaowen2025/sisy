# SiSy Demo Script

## Goal
Showcase SiSy as an **intelligent, minimalist companion** that turns chaos into structure and adapts to you.

## Core Features to Highlight
1.  **AI-Powered Setup**: Natural language -> Structured Routine.
2.  **Minimalist "Present" View**: Focus on *Now*, hide the clutter.
3.  **Context-Aware Adaptation**: Change plans with a sentence.
4.  **Memory ("Me" Tab)**: The system learns about you.

---

## The Demo Flow (60 Seconds)

### Scene 1: From Chaos to Order (The "Wow")
*Context: User starts with an empty slate.*

1.  **Action**: Open **Routine** tab (empty).
2.  **Interaction**: Open Chat. Paste a raw, messy unstructured routine.
    > *User*: "Here's my usual Tuesday: Gym at 7, then work standup at 9, deep work until 12, lunch, then meetings until 5."
3.  **Result**: SiSy instantly parses this and populates the **Routine** list with clean, structured items (Time | Title).
4.  **Narration**: "Just tell SiSy your day, and it builds the structure for you."

### Scene 2: Living in the Moment (The "Zen")
*Context: It is now Tuesday morning.*

1.  **Action**: Switch to **Present** tab.
2.  **Visual**: Show the **Focus View**. Only "Gym" (Now) and "Work Standup" (Next) are clearly visible. The rest is faded/hidden.
3.  **Interaction**: Swipe Right on "Gym" to complete it.
4.  **Result**: "Gym" slides away, "Work Standup" snaps to center.
5.  **Narration**: "A distraction-free interface that keeps you focused on the one thing that matters right now."

### Scene 3: Adaptation (The "Partner")
*Context: Something comes up.*

1.  **Interaction**: Open Chat.
    > *User*: "I'm running late. Push the standup to 9:15 and cancel the first deep work block."
2.  **Result**: The Timeline on the screen immediately animates to reflect the changes.
3.  **Narration**: "Plans change. SiSy adapts immediately, so you don't have to fiddle with menus."

### Scene 4: Memory (The "Memory")
*Context: Teaching SiSy something new.*

1.  **Interaction**: In Chat.
    > *User*: "By the way, I'm trying to train for a triathlon, so the gym sessions are swimming."
2.  **Action**: Switch to **Me** tab.
3.  **Visual**: See a new entry under 'Goals' or 'Health'.
    *   *Key*: `Fitness Goal`
    *   *Value*: `Triathlon training`
4.  **Narration**: "SiSy listens and remembers context about you, effectively building a user manual for your life."

---

## Preparation Checklist
- [ ] Ensure "Present" view correctly hides non-focus tasks.
- [ ] Ensure Chat can parse "Push back..." time shifting requests (Flow C/B).
- [ ] Ensure Chat can "upsert_profile_field" based on conversation.