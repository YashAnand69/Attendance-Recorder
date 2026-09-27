// Keep both hosting adapters usable without exposing secrets to the frontend.
export function env(name: string): string | undefined {
  return typeof Netlify !== "undefined" ? Netlify.env.get(name) : process.env[name];
}
