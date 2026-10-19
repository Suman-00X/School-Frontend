/* The backend's rule for experienceYears: a whole number of years, 0 to 60 */
export const experienceError = (v: string) =>
  v.trim() && !(/^\d+$/.test(v.trim()) && Number(v) <= 60) ? "must be a whole number from 0 to 60" : undefined;
