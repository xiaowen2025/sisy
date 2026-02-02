# SiSy Project Glossary

**SiSy**
The name of the application. An "always-available companion" designed to keep the user oriented on their next step with minimal interaction.

## User Interface (UI) Strings & Tabs

**Present**
The "Home" tab (Tab 1). A vertical timeline focused on the "Now" task. It emphasizes exactly 3 tasks (Center + Neighbors) when stationary but allows infinite scrolling.

**Routine**
The "Routine" tab (Tab 2). The interface for managing the "Routine Template", which is the default structure for the user's day.

**Me**
The "Me" tab (Tab 3). The user profile interface. It visualizes what SiSy knows about the user as key-value fields organized into Groups.

**Settings**
The configuration area (Tab 4). Handles data management (Import/Export), template loading, and the Audit Log.

**Chat**
The persistent input field anchored above the navigation bar on every screen. It provides context-aware interaction with the agent.

**Command Modal**
The detailed view that opens when tapping a Task. Allows for actions like Complete, Skip, Delay, and accessing the underlying Routine Item editor.

## Data Models

**Task**
A specific instance of a todo item for a particular day. Can be generated from a Routine Item or created ad-hoc.
*   Properties: `id`, `title`, `scheduled_time`, `status`, `source`.

**Routine Item**
The "master template" for a habit or recurring task. Modifications here propagate to future Tasks.
*   Properties: `id`, `title`, `time`, `auto_complete`, `description`, `repeat_interval`.

**Profile Field**
A single piece of information known about the user (e.g., "Wake up time: 7am").
*   Properties: `key`, `value`, `group`, `source`.

**Profile Group**
A collection of Profile Fields (e.g., "Basics", "Health").

**Log**
History or comments associated with a specific Routine Item. Captures completion comments, skip reasons, or edits.

**Audit Log**
A chronological history of all updates made by the agent (SiSy) to the Profile or Routine.

## Agent Terms

**Actions**
Structured commands returned by the AI agent to perform operations on the app state.
*   `create_routine_item`: Creates a new item in the routine.
*   `update_routine_item`: Modifies an existing routine item.
*   `upsert_profile_field`: Adds or updates a field in the user profile.

**Context Awareness**
The capability of the Chat input to know which tab is active (Present, Routine, Me) and include that context in the message payload sent to the agent.
