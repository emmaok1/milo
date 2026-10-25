import type { JournalEntry } from "./listener-model";
import { reportRange, type ReportPeriod } from "./report-model";
/** Fictional, deterministic in-memory data. Never insert into journal or Memory. */
export function sampleReportEntries(
  anchor: string,
  period: ReportPeriod,
): JournalEntry[] {
  const result: JournalEntry[] = [];
  for (const [day, date] of reportRange(anchor, period).dates.entries()) {
    if (day % 7 === 2) continue;
    const count = day % 4 === 0 ? 2 : 3;
    for (let moment = 0; moment < count; moment++) {
      const minutes = [490, 765, 1135][moment] + (day % 5) * 7;
      const feelings: JournalEntry["feelings"] =
        (day + moment) % 5 === 0
          ? ["Pain"]
          : (day + moment) % 3 === 0
            ? ["Regret"]
            : ["Joy"];
      const reactions: JournalEntry["reactions"] =
        moment === 0
          ? ["Wanted company"]
          : moment === 1 && day % 3 === 0
            ? ["Kept thinking about the meal"]
            : moment === 2 && day % 4 === 1
              ? ["Wanted some quiet"]
              : [];
      result.push({
        id: `00000000-0000-4000-8000-${date.replaceAll("-", "")}${String(moment).padStart(4, "0")}`,
        date,
        time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
        private: true,
        photo:
          "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1qiiiuYk//9k=",
        foodCategory: (
          ["Meal", "Meal", "Snack", "Fast food", "Dessert"] as const
        )[(day + moment) % 5],
        recordVersion: 2,
        feelings,
        reactions,
        behaviors: [],
        note: "Fictional sample moment.",
      });
    }
  }
  return result;
}
export function showSampleReport(preview: string | null, entryCount: number) {
  return preview === "1" || (preview !== "0" && entryCount === 0);
}
export function reportViewHref(period: ReportPeriod, sample: boolean) {
  return `/report?period=${period}&preview=${sample ? "1" : "0"}`;
}
