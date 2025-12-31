// UI entry point
// TODO: Add framework (React, Solid, etc.) or vanilla JS implementation

async function checkApiHealth() {
  try {
    const response = await fetch("/api/health");
    const data = (await response.json()) as { status: string };
    // eslint-disable-next-line no-console
    console.log("API Health:", data);
  } catch {
    console.error("API not reachable");
  }
}

// Check API on load
void checkApiHealth();
