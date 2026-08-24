/**
 * Combines user-entered local calendar fields into an unambiguous ISO instant.
 *
 * JavaScript normalizes impossible local times (for example 02:30 during a
 * spring-forward transition) instead of rejecting them. Re-reading every
 * component prevents a silently shifted activity from landing on another
 * time or date.
 */
export function activityInstantFromLocalFields(
  localDate: string,
  localTime: string,
): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(localTime);

  if (!dateMatch || !timeMatch) {
    throw new Error("Enter a valid local date and time");
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (hour > 23 || minute > 59) {
    throw new Error("Enter a valid local date and time");
  }

  const instant = new Date(year, month - 1, day, hour, minute, 0, 0);
  const fieldsWerePreserved =
    instant.getFullYear() === year &&
    instant.getMonth() === month - 1 &&
    instant.getDate() === day &&
    instant.getHours() === hour &&
    instant.getMinutes() === minute;

  if (!fieldsWerePreserved || Number.isNaN(instant.getTime())) {
    throw new Error(
      "That local date and time does not exist in your current timezone. Choose another time.",
    );
  }

  return instant.toISOString();
}

export function localClockTimeForInstant(isoInstant: string): string {
  const instant = new Date(isoInstant);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Activity start time is invalid");
  }
  return `${String(instant.getHours()).padStart(2, "0")}:${String(
    instant.getMinutes(),
  ).padStart(2, "0")}`;
}

export function currentLocalClockTime(referenceDate = new Date()): string {
  return `${String(referenceDate.getHours()).padStart(2, "0")}:${String(
    referenceDate.getMinutes(),
  ).padStart(2, "0")}`;
}
