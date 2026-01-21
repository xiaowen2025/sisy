# Product Requirement Document (PRD): SiSy


**Core Vision:**
- Prevent plans from “crashing” when real life happens (fatigue, overtime, surprises).
- Let routines evolve through feedback + observation, so the system adapts instead of the user failing.
---

## 1. Brand Identity & Visual Intent

- **Design Language:** **Extreme Minimalism**
    
- **Interaction Mood:** Like an old friend—present when needed, invisible when you are focused.
    
## 2. Core Loop: Dynamic Evolution

### Phase A: Frictionless Onboarding

To lower the entry barrier, SiSy builds user profiles multi-dimensionally:

- **Zero-Pressure Start:** Profiles can be empty initially; no forced forms.
    
- **Progressive Completion:**
  - **Manual:** Traditional form entry.
    
  - **Dialogue:** SiSy gathers details through gentle chat interviews.
    
  - **Observation:** SiSy automatically updates the profile based on daily performance.
    
- **Plan Generation:**
    
    - **Flexible Goals:** User enters $Goal \rightarrow$ AI generates a "fuzzy" draft (leaves breathing room rather than minute-by-minute precision).
        
    - **Routine Import:** Import any format; AI adapts it and offers optimization suggestions.
        

### Phase B: Real-time Feedback

When life happens (fatigue, sudden overtime, etc.):

- **Status Input:** Users can tell SiSy their state at any time (e.g., "I'm exhausted").
    
- **Smart Deconstruction:** AI analyzes the obstacle and provides emotional support or immediate "micro-action" suggestions.
    

### Phase C: Dynamic Correction

- **Instant Rewrite:** AI instantly recalculates the rest of the day to ensure the plan remains viable.
    
- **Profile Evolution:** Adjustments are saved to the "Long-term Profile" (e.g., the system learns the user has low energy on Tuesday afternoons).
    

---

## 3. Product Definition (what this is / isn’t)

- **Problem statement:** Most planning tools assume stable days. When disruptions happen, the plan collapses and users disengage. SiSy keeps plans viable under uncertainty by continuously adapting.
- **Positioning:** A minimalist, always-available companion that helps you stay on track with the least possible interaction.
- **Non-goals (initially):**
  - Full calendar replacement
  - Social features / team planning
  - Deep health diagnostics (medical-grade)

## 4. Primary users & scenarios

- **Primary user:** Busy knowledge worker with variable schedule and frequent interruptions.
- **Key scenarios:**
  - **“I’m exhausted” at 3pm:** convert remaining tasks into a survivable plan + a single micro-action.
  - **Unexpected meeting:** shift tasks, keep commitments, preserve slack.
  - **Routine drift:** system notices repeated skips and updates the default routine suggestion.

## 5. MVP scope (first shippable)

- **Capture:** always-available input to record state + intent in one sentence.
- **Plan view:** show only the **current/next** task with minimal friction.
- **Reschedule:** one gesture to push/pull time, with lightweight confirmation.
- **Learn:** store simple signals (completion, postponement reason, energy level) into a basic profile.

> Note: `sisy/docs/v0.md` describes the initial UI modules (Omni-Chat + Home/Routine/Me). This doc defines the “why” and the adaptive loop; `v0.md` defines the first “what” to build.
