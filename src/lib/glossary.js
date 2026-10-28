// Plain-language meaning of every metric. Shown in tooltips, on the Reports
// page and in PDF reports so everyone reads the numbers the same way.
export const GLOSSARY = {
  done: {
    label: 'Tasks completed',
    short: 'Tasks marked done in this period.',
    tip: 'Counts every task marked Done that was planned for a day in this period, including tasks assigned by a manager.',
  },
  completionRate: {
    label: 'Completion rate',
    short: 'Share of planned tasks that were finished.',
    tip: 'Tasks completed divided by all tasks planned for the period. 80% means 8 of every 10 planned tasks were finished.',
  },
  consistency: {
    label: 'Active days',
    short: 'Working days with work logged.',
    tip: 'Working days (Monday to Friday, excluding company holidays) on which the person worked on a task, had a meeting or wrote a note, out of the working days expected. It is counted on its own, nobody has to submit. Weekends and holidays never count against anyone.',
  },
  blocked: {
    label: 'Blocked tasks',
    short: 'Tasks waiting on someone or something.',
    tip: 'Tasks currently marked Blocked. These usually need a manager to step in.',
  },
  carried: {
    label: 'Carried over',
    short: 'Tasks finished late or still open from an earlier day.',
    tip: 'A task is carried over when it was not finished on the day it was planned for. A few is normal; many may mean too much work was planned.',
  },
  onTime: {
    label: 'Assigned work on time',
    short: 'Assigned tasks finished by their due date.',
    tip: 'Of the tasks assigned by a manager or BA with a due date that has passed, the share that was completed on or before the due date.',
  },
  extraDays: {
    label: 'Extra days',
    short: 'Weekend or holiday days with logged work.',
    tip: 'Days outside the normal working week on which the person still logged work. Shown for recognition; never required.',
  },
  planned: {
    label: 'Tasks planned',
    short: 'All tasks planned for days in this period.',
    tip: 'Every task planned for a day in this period, whatever its status.',
  },
}
