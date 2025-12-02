export function greet(name = 'World'): string {
  return `Hello, ${name}!`;
}

if (require.main === module) {
  // Run as a script
  console.log(greet());
}
