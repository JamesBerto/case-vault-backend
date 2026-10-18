export function displayRoleName(name) {
  return name?.toLowerCase() === "admin" ? "Administrator" : name || "Unknown";
}
