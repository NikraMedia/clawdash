// Lightweight cron expression → human-readable description.
// No external dependencies. Handles the most common patterns.
//
// Examples:
//   "* * * * *"       → "Every minute"
//   "*/5 * * * *"     → "Every 5 minutes"
//   "0 * * * *"       → "Every hour"
//   "0 */2 * * *"     → "Every 2 hours"
//   "0 8 * * *"       → "Daily at 8:00 AM"
//   "30 14 * * *"     → "Daily at 2:30 PM"
//   "0 8 * * 1-5"     → "Weekdays at 8:00 AM"
//   "0 0 * * 0"       → "Weekly on Sunday at 12:00 AM"
//   "0 8,12,18 * * *" → "Daily at 8:00 AM, 12:00 PM, 6:00 PM"
//   "0 0 1 * *"       → "Monthly on day 1 at 12:00 AM"

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour12(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${period}`;
}

function parseField(field: string, max: number): number[] | "all" | null {
  if (field === "*") return "all";

  // Step: */N
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    if (isNaN(step) || step < 1) return null;
    const result: number[] = [];
    for (let i = 0; i <= max; i += step) result.push(i);
    return result;
  }

  // Range: N-M
  if (field.includes("-") && !field.includes(",")) {
    const [lo, hi] = field.split("-").map(Number);
    if (isNaN(lo!) || isNaN(hi!)) return null;
    const result: number[] = [];
    for (let i = lo!; i <= hi!; i++) result.push(i);
    return result;
  }

  // Comma-separated: N,N,N
  if (field.includes(",")) {
    const values = field.split(",").map(Number);
    if (values.some(isNaN)) return null;
    return values;
  }

  // Single value
  const val = parseInt(field, 10);
  if (isNaN(val)) return null;
  return [val];
}

export function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;

  const [minuteField, hourField, domField, , dowField] = parts;

  // Every minute: * * * * *
  if (minuteField === "*" && hourField === "*" && domField === "*" && dowField === "*") {
    return "Every minute";
  }

  // Every N minutes: */N * * * *
  if (minuteField!.startsWith("*/") && hourField === "*" && domField === "*" && dowField === "*") {
    const step = parseInt(minuteField!.slice(2), 10);
    if (!isNaN(step)) {
      if (step === 1) return "Every minute";
      return `Every ${step} minutes`;
    }
  }

  const minutes = parseField(minuteField!, 59);
  const hours = parseField(hourField!, 23);
  const dom = parseField(domField!, 31);
  const dow = parseField(dowField!, 6);

  // Specific minute, every hour: N * * * *
  if (Array.isArray(minutes) && minutes.length === 1 && hours === "all" && dom === "all" && (dow === "all" || dowField === "*")) {
    if (minutes[0] === 0) return "Every hour";
    return `Every hour at :${minutes[0]!.toString().padStart(2, "0")}`;
  }

  // Every N hours: 0 */N * * *
  if (Array.isArray(minutes) && minutes.length === 1 && minutes[0] === 0 &&
      hourField!.startsWith("*/") && domField === "*" && (dowField === "*" || dow === "all")) {
    const step = parseInt(hourField!.slice(2), 10);
    if (!isNaN(step)) {
      if (step === 1) return "Every hour";
      return `Every ${step} hours`;
    }
  }

  // Specific time patterns
  if (Array.isArray(minutes) && minutes.length === 1 && Array.isArray(hours)) {
    const minute = minutes[0]!;

    // Multiple hours in a day: 0 8,12,18 * * *
    if (hours.length > 1 && dom === "all" && (dow === "all" || dowField === "*")) {
      const times = hours.map((h) => formatHour12(h, minute));
      return `Daily at ${times.join(", ")}`;
    }

    // Single hour
    if (hours.length === 1) {
      const hour = hours[0]!;
      const timeStr = formatHour12(hour, minute);

      // Weekdays: 0 8 * * 1-5
      if (dom === "all" && Array.isArray(dow)) {
        if (dow.length === 5 && dow[0] === 1 && dow[4] === 5) {
          return `Weekdays at ${timeStr}`;
        }
        if (dow.length === 2 && dow[0] === 0 && dow[1] === 6) {
          return `Weekends at ${timeStr}`;
        }
        if (dow.length === 1) {
          return `Weekly on ${DAY_NAMES[dow[0]!]} at ${timeStr}`;
        }
        const dayNames = dow.map((d) => DAY_ABBR[d]!);
        return `${dayNames.join(", ")} at ${timeStr}`;
      }

      // Monthly: 0 8 1 * *
      if (Array.isArray(dom) && dom.length === 1 && (dow === "all" || dowField === "*")) {
        const day = dom[0]!;
        const suffix = day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
        return `Monthly on the ${day}${suffix} at ${timeStr}`;
      }

      // Daily: 0 8 * * *
      if (dom === "all" && (dow === "all" || dowField === "*")) {
        return `Daily at ${timeStr}`;
      }
    }
  }

  // Fallback: return the expression as-is
  return expr;
}

/**
 * Format a CronSchedule object into a human-readable description.
 * Handles cron, every, and at schedule kinds.
 */
export function scheduleToHuman(schedule: {
  kind: string;
  expr?: string;
  everyMs?: number;
  at?: string;
}): string {
  if (schedule.kind === "cron" && schedule.expr) {
    return cronToHuman(schedule.expr);
  }

  if (schedule.kind === "every" && schedule.everyMs != null) {
    const ms = schedule.everyMs;
    if (ms < 60_000) return `Every ${Math.round(ms / 1_000)}s`;
    if (ms < 3_600_000) return `Every ${Math.round(ms / 60_000)} minutes`;
    if (ms < 86_400_000) return `Every ${Math.round(ms / 3_600_000)} hours`;
    return `Every ${Math.round(ms / 86_400_000)} days`;
  }

  if (schedule.kind === "at" && schedule.at) {
    return `Once at ${schedule.at}`;
  }

  return "Unknown schedule";
}

/**
 * Get the raw schedule expression for display as secondary info.
 */
export function scheduleToRaw(schedule: {
  kind: string;
  expr?: string;
  everyMs?: number;
  at?: string;
}): string {
  if (schedule.kind === "cron" && schedule.expr) return schedule.expr;
  if (schedule.kind === "every" && schedule.everyMs != null) return `${schedule.everyMs}ms`;
  if (schedule.kind === "at" && schedule.at) return schedule.at;
  return "\u2014";
}
