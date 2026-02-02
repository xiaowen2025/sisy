Frontend Verification Guidelines

1. Navigation: Click through "Present", "Routine", "Chat", "Me". Ensure tabs switch correctly.

2. Routine Templates 
 Load Template:
 Go to Routine tab.
 Scroll to bottom (if needed) and click "Load Wellness Template".
 Verify: A list of routine items (Wake up, Warm-up, etc.) should appear.
 Check Times:
 Verify items have times like '08:00', '09:00', etc.
 Click an item to edit. Verify the time field is populated correctly.

3. Task Generation 
 Verify "Present" Tab:
 Go to Present tab.
 Expectation: You should see tasks corresponding to the routine items you just loaded.
 Note: If the routine item time is '08:00', the task should show '8:00 AM' (or 08:00) and date should be today.
 Task Completing:
 Click the checkbox on a task (e.g., "Wake up").
 Verify: Task moves to "Done".
 Verify: NO new duplicate task is immediately spawned (Checklist Style).

4. Routine <-> Task Sync
 Update Routine Item:
 Go to Routine.
 Edit "Wake up" time from '08:00' to '08:30'.
 Save.
 Verify Task Update:
 Go to Present.
 The "Wake up" task should now show '8:30 AM'.

5. Profile Verification (Me Tab)
 Add Group:
 Go to "Me" tab.
 Click "Add Group" (scroll down if needed).
 Enter a group name (e.g., "Hobbies") and confirm.
 Verify the new group appears.
 Add Attribute:
 In the "Hobbies" group (or any group), find the "Add attribute" input.
 Type an attribute name (e.g., "Reading") and press Enter or click Add.
 Verify the attribute appears in the list.
 Delete Attribute:
 Click the trash/delete icon next to the "Reading" attribute.
 Verify the attribute is removed.
 Delete Group:
 Click the trash/delete icon for the "Hobbies" group.
 Verify the group is removed.

6. Persistence & State
 Reload Page: Refresh the browser.
 Verify: Routine items, Tasks, and Profile changes (Groups/Attributes) should persist.

7. Feedback System (Hints, Highlights, Logs)
 Navigation Hints:
 Trigger a chat update (e.g., "My age is 38").
 Verify: A green dot appears on the "Me" tab icon.
 Trigger a routine update (e.g., "Add reading").
 Verify: A green dot appears on the "Routine" tab icon.
 Persistent Highlighting:
 Go to the tab with the green dot.
 Verify: The updated item/field is highlighted (colored border/bg).
 Verify: The highlight persists indefinitely (wait >5s).
 Click the item. Verify the highlight disappears.
 Audit Log:
 Go to Settings -> Audit Log.
 Verify: Chronological entries exist for the actions performed above (e.g., "Sisy updated profile...", "Sisy added routine...").

8. Daily Checklist Cycle
 Import Routine:
 Go to Settings -> Import Routine.
 Paste a simple routine JSON (e.g., `[{"title":"New Daily", "time":"09:00"}]`).
 Verify: "Present" tab immediately shows "New Daily" task.
 Daily Reset (Simulation):
 Delete the "New Daily" task from the Present list (or mark it done).
 Wait 1 minute (for the periodic tick).
 Verify: Since no "next task" exists and it is due today, the system should NOT regenerate it if it was done. 
 (Wait, logic check: current logic regenerates if missing for today. If DONE, it exists. If DELETED, it is missing.)
 Verify: If deleted, it should reappear (regenerate) after 1 minute if it was supposed to be there today.
 This confirms the "Checklist" logic.