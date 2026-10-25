const avatarColors = ["#e5dced", "#e8d4bd", "#d7e3cb", "#d5e0e8", "#ead4cc", "#e7dfb9"];
export function friendColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarColors[hash % avatarColors.length];
}
export function friendInitial(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() || "?";
}
