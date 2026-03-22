import { outlineAgent } from "../src/agents/writing/outlineAgent.js";

const keyword = "seo nedir";
const fakeResearch = "SEO informational intent, beginner guide, Turkish market";

const outline = await outlineAgent({ keyword, research: fakeResearch });
console.log("OUTLINE tokens:", outline.outputTokens);
console.log("OUTLINE preview:", outline.text.slice(0, 300));
