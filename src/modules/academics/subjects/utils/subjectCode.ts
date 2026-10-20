/* "Mathematics" -> "MAT"; when taken MATH, then the first letter with two later ones (MTH…).
   Letters only: a class subject's code adds the class's digits (MAT221). */
export function suggestCode(name: string, taken: Set<string>) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  if (letters.length < 2) return "";
  const candidates = [letters.slice(0, 3), letters.slice(0, 4), letters.slice(0, 2)];
  for (let i = 1; i < letters.length; i++) for (let j = i + 1; j < letters.length; j++) candidates.push(letters[0] + letters[i] + letters[j]);
  candidates.push(letters.slice(0, 5), letters.slice(0, 6));
  return candidates.find(c => c.length >= 2 && !taken.has(c)) ?? "";
}
