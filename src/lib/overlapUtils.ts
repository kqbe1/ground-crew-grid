/**
 * Detect time overlaps between tasks for a given worker on a given date.
 */

interface TaskTimeSlot {
  id: string;
  assigned_to: string | null;
  scheduled_date: string;
  start_time: string;
  duration_minutes: number;
  second_assigned_to?: string | null;
  title?: string | null;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function involvesWorker(task: TaskTimeSlot, workerId: string): boolean {
  return task.assigned_to === workerId || task.second_assigned_to === workerId;
}

/** "08:00" + 90 => "09:30" */
export function slotLabel(startTime: string, durationMinutes: number): string {
  const start = toMinutes(startTime);
  const end = start + durationMinutes;
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Check if a proposed time slot overlaps with any existing task for a worker.
 * Returns the list of conflicting tasks.
 */
export function findOverlaps(
  workerId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  allTasks: TaskTimeSlot[],
  excludeTaskId?: string
): TaskTimeSlot[] {
  if (!workerId || !startTime) return [];

  const newStart = toMinutes(startTime);
  const newEnd = newStart + durationMinutes;

  return allTasks.filter((t) => {
    if (t.id === excludeTaskId) return false;
    if (!involvesWorker(t, workerId)) return false;
    if (t.scheduled_date !== date) return false;
    if (!t.start_time) return false;

    const tStart = toMinutes(t.start_time);
    const tEnd = tStart + t.duration_minutes;

    // Overlap: ranges intersect if newStart < tEnd && newEnd > tStart
    return newStart < tEnd && newEnd > tStart;
  });
}

export interface WorkerConflict {
  workerId: string;
  task: TaskTimeSlot;
}

/**
 * Same as findOverlaps but for several workers at once (principal + second + extras).
 */
export function findOverlapsForWorkers(
  workerIds: (string | null | undefined)[],
  date: string,
  startTime: string,
  durationMinutes: number,
  allTasks: TaskTimeSlot[],
  excludeTaskId?: string
): WorkerConflict[] {
  const unique = Array.from(new Set(workerIds.filter(Boolean) as string[]));
  const out: WorkerConflict[] = [];
  const seen = new Set<string>();
  for (const workerId of unique) {
    for (const task of findOverlaps(workerId, date, startTime, durationMinutes, allTasks, excludeTaskId)) {
      const key = `${workerId}-${task.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ workerId, task });
    }
  }
  return out;
}

/**
 * Get a set of task IDs that have overlaps with other tasks on the same worker/date.
 */
export function getOverlappingTaskIds(tasks: TaskTimeSlot[]): Set<string> {
  const overlapping = new Set<string>();

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];

      if (a.assigned_to !== b.assigned_to) continue;
      if (a.scheduled_date !== b.scheduled_date) continue;
      if (!a.start_time || !b.start_time) continue;

      const aStart = toMinutes(a.start_time);
      const aEnd = aStart + a.duration_minutes;
      const bStart = toMinutes(b.start_time);
      const bEnd = bStart + b.duration_minutes;

      if (aStart < bEnd && aEnd > bStart) {
        overlapping.add(a.id);
        overlapping.add(b.id);
      }
    }
  }

  return overlapping;
}
