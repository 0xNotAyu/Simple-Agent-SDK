/**
 * Example 2: Two agents, with a triage agent handing off to a specialist.
 * Run with: npm run example:handoff
 */
import "dotenv/config";
import { Agent, OpenAIProvider, defineTool, z } from "../src/index.js";

const weatherTool = defineTool({
  name: "getWeather",
  description: "Gets the current weather for a city",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }) {
    // Mocked for demo purposes -- swap for a real API call.
    return { city, tempC: 30, condition: "Sunny" };
  },
});

async function main() {
  const provider = new OpenAIProvider({ model: "gpt-4o-mini", apiKey: ''});

  const weatherAgent = Agent.builder()
    .name("WeatherAgent")
    .instructions("You are a weather specialist. Use getWeather to answer weather questions.")
    .model(provider)
    .tool(weatherTool)
    .build();

  const triageAgent = Agent.builder()
    .name("TriageAgent")
    .instructions(
      "You are a triage agent. If the user asks about weather, hand off to WeatherAgent. " +
        "Otherwise answer directly."
    )
    .model(provider)
    .handoffTo(weatherAgent)
    .build();

  triageAgent.events.on("handoff_started", (e) =>
    console.log(`[handoff] ${e.fromAgent} -> ${e.toAgent}`)
  );

  const result = await triageAgent.run("What's the weather like in Jaipur right now?");
  console.log("\nFinal output:", result.output);
}

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
