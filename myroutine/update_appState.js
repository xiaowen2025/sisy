const fs = require('fs');
const content = fs.readFileSync('lib/appState.tsx', 'utf8');
const lines = content.split('\n');

const startLine = 404; // 1-based
const endLine = 451;   // 1-based

// Check guard
if (lines[startLine - 1].trim() !== '// Overdue: Sort DESC (Newest first)') {
    console.error('Start line mismatch:', lines[startLine - 1]);
    process.exit(1);
}

const newLogic = `    // Overdue: Sort DESC (Newest first)
    overdue.sort((a, b) => {
      const at = a.scheduled_time ? Date.parse(a.scheduled_time) : 0;
      const bt = b.scheduled_time ? Date.parse(b.scheduled_time) : 0;
      return bt - at;
    });

    let nowTask: Task | null = null;
    let pastTask: Task | null = null;
    let nextTask: Task | null = null;

    if (overdue.length > 0) {
      // Prioritize most recent overdue task as "Now"
      nowTask = overdue[0];
      
      // Past handles the next overdue task
      // Note: Past Context only shows if non-autocomplete (per Req 9).
      const potentialPast = overdue.slice(1).find(t => !t.auto_complete);
      pastTask = potentialPast || null;

      // Next is the first upcoming task
      nextTask = upcoming.length > 0 ? upcoming[0] : null;
    } else {
      // Fallback: First upcoming task
      nowTask = upcoming.length > 0 ? upcoming[0] : null;
      pastTask = null;
      nextTask = upcoming.length > 1 ? upcoming[1] : null;
    }

    return { nowTask, nextTask, pastTask: pastTask || null };
  }, [todoSorted, tick]);`;

lines.splice(startLine - 1, endLine - startLine + 1, newLogic);

fs.writeFileSync('lib/appState.tsx', lines.join('\n'));
console.log("Success");
