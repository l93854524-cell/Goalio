import { addDays, todayISO } from "@/lib/domain/dates";

export interface TimeService {
  today(): string;
  move(days: number): void;
}

export function createTimeService(options: { demo: boolean; initialDate?: string }): TimeService {
  let demoDate = options.initialDate ?? todayISO();
  return {
    today: () => (options.demo ? demoDate : todayISO()),
    move(days: number) {
      if (!options.demo) throw new Error("Demo date control is disabled");
      demoDate = addDays(demoDate, days);
    },
  };
}
