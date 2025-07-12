import 'dotenv/config'
import renderTool from "./tools/frontRender.mts"
import fs from "fs"
// import requestTool from "./request.mts"; // Your tool
// import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI,  } from "@langchain/google-genai";
// import { StateGraph } from "@langchain/langgraph";
// import { BaseMessage } from "@langchain/core/messages";
// import { Annotation } from "@langchain/langgraph";

import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";




// Use the tool directly in an array
const agentTools = [renderTool];


// Switch to gemini 2.5 pro 
const llm = new ChatGoogleGenerativeAI({ 
    temperature: 0, 
    model: "gemini-1.5-flash"
});




const agentCheckpointer = new MemorySaver();

const agentNavigate = createReactAgent({
  llm,
  tools: agentTools,
  name: "agentNavigate",
  checkpointer: agentCheckpointer,
  prompt: `
  You will be provided a website. 



  `
})

// console.log("Tool structure:", JSON.stringify(requestTool, null, 2));
// console.log("Tool schema:", requestTool.schema);
// console.log("Tool name:", requestTool.name);

// In charge of finding type of menu



const agentType = createReactAgent({
  llm,
  tools: [renderTool],
  
  name: "agentType",
  checkpointSaver: agentCheckpointer,
  prompt: `
You are searching restaurant websites to determine what kind of menu they use.

Your task is to classify the menu format based on the **text content and image** of the rendered page.

There are only 4 valid outputs:
- 'webapp' — if the menu is rendered directly as text or buttons on the website
- 'pdf' — if the menu is shown via a downloadable or embedded PDF
- 'img' — if the menu is shown entirely as an image or scanned photo
- 'unsure' — if you cannot determine the menu type

---

🔍 How to decide:

- If you see readable food item names, categories, and prices in the text: return 'webapp'
- If the menu is shown as a .pdf or has "Download Menu" buttons: return 'pdf'
- If the image looks like a scanned or flat menu photo with no readable text: return 'img'
- If nothing is clearly detectable or it's ambiguous: return 'unsure'

Only return **one word**: webapp, pdf, img, or unsure.

Do not explain, justify, or output anything else.
`
});





// Would be the playwright and request one
const webMenuTools = [renderTool]

const getLinkTools = [renderTool]

// In charge of getting all the links that could potentially lead to more menu customizables and allat
const agentGetLinks = createReactAgent({
  llm,
  name: "agentGetLinks",
  tools: getLinkTools,
  checkpointSaver: agentCheckpointer,
  prompt: `
Your task is to extract all internal links from the provided webpage that may lead to individual menu items or customization options (e.g., toppings, sizes, sides).

If the full menu is already shown on the given URL, return only that URL in a list.

You will be provided an image of the current state of the webpage to help guide you.

Otherwise:

- Use the "tag" selection type to extract anchor tags. Specifically, use \`selectionType: "tag"\` and \`value: "a"\`.
- Do **not** use "css", "xpath", or any other selector types.
- This will allow you to extract all links by identifying every <a> tag on the page.
- After collecting links, discard irrelevant ones like "/contact", "/about", "/terms", etc.
- Return the list of final URLs you believe are useful for menu scraping.

Be over-inclusive rather than under-inclusive — it's better to collect extra links than to miss critical ones. It's okay to provide a lot of links
`
});


// Could use gemini to give more context
const agentScrapeWeb = createReactAgent({
  llm,
  name: "agentScrapeWeb",
  tools: webMenuTools,
  checkpointSaver: agentCheckpointer,
  prompt:  `
You are a data analyst responsible for extracting every possible menu item and its customizable combinations (e.g., add-ons, toppings, sizes) from a list of restaurant web pages.

Each page in the list may display menu data differently. Your job is to visit **every single link** provided — do not skip or ignore any. Process them **all in a single request** using the input list.

You will be provided an image of the current state of the webpage to help guide you.
---

You will be given a list of URLs (e.g., 10-20 links). You must pass **all of them at once** into the tool, using the \`url\` parameter as an array.

Do **not** call the tool separately for each URL. Instead, call it once with the full list:

Example:
{
  "url": ["link1", "link2", "link3"],
  "action": "skeleton",
  "selectionType": "none",
  "value": ""
}

🔁 Scraping Strategy:

1. For **every link**, first attempt to extract structured information using CSS selectors **if the layout is clean and semantically structured**.

2. If structured scraping fails, or the content is deeply nested (e.g., behind JavaScript, in modals, or dynamic components), **use the "skeleton" action** with \`selectionType: "none"\` to capture the full visible text content of the page.

3. Parse each page separately and extract any relevant menu data.

---

✅ Output Format:

\`\`\`json
[
  {
    "menuSection": "string (required)",
    "menuItemName": "string (required)",
    "menuItemDescription": "string (optional)",
    "menuSize": "string (optional)",
    "menuPrice": number (required),
    "menuOptionOne": "string (optional)",
    "menuOptionOnePrice": number (required if menuOptionOne is present),
    "menuOptionTwo": "string (optional)",
    "menuOptionTwoPrice": number (required if menuOptionTwo is present)
  }
]
\`\`\`

---

📌 Guidelines:

- **Never skip a URL.** Every page must be used, even if content is repetitive.
- Use skeleton mode **only if** semantic scraping fails.
- Do not invent or assume menu options — only include options and prices that are explicitly shown or logically connected.
- If the format is unclear, fall back to extracting and analyzing all visible text.
- Make sure prices and combinations are correct and clearly linked.

Return the most complete list of menu combinations possible using the given pages.
`
});



// Could switch to gemini to give more context
const workflow = createSupervisor({
    agents: [agentGetLinks, agentScrapeWeb, agentType],
    llm: llm,
    outputMode: "full_history",
    prompt: `
You are the supervisor overseeing a team of specialized agents responsible for extracting structured menu data from restaurant websites.

Your mission is to extract **every menu item, variation, and add-on** and return it in a **normalized, structured JSON format**. You are in charge of intelligently routing tasks to the correct agents in the correct order and ensuring high-quality structured data is returned.

Here is what each agent does:

- **agentType**: Determines what type of menu is on the website. It should return one of: 'pdf', 'webapp', 'img', or 'unsure'.
- **agentGetLinks**: Gathers all internal links needed to access the full set of menu items and modifiers. If everything is already visible on the main URL, it just returns that.
- **agentScrapeWeb**: Takes the list of links from agentGetLinks and extracts every valid menu item + option + price combination into structured JSON.

---

🧠 Your responsibilities:

1. **ALWAYS start by calling agentType** to determine the type of menu on the site.

2. If agentType returns:
   - **'pdf'** or **'img'**: stop and wait for a future agent (e.g., agentScrapePDF or agentScrapeIMG) — these are not yet implemented.
   - **'unsure'**: stop and mark for **human review**.
   - **'webapp'**: continue with the following flow:

3. **CALL agentGetLinks** to retrieve all URLs that might contain menu item data.

4. **ONLY AFTER agentGetLinks returns**, call **agentScrapeWeb**, and pass in the links gathered from agentGetLinks.

   - Do not attempt to guess or reuse links yourself.
   - Do not skip agentGetLinks.

5. Once all scraping is complete, validate the structured data:
   - Ensure all fields are filled where possible
   - Look for inconsistencies in modifiers, sections, or pricing
   - If anything seems incomplete or ambiguous, stop and flag for **human-in-the-loop review**.

---

✅ Your output should always be a JSON array like this:

\`\`\`json
[
  {
    "menuSection": "string",
    "menuItemName": "string",
    "menuItemDescription": "string",
    "menuSize": "string",
    "menuPrice": number,
    "menuOptionOne": "string",
    "menuOptionOnePrice": number,
    "menuOptionTwo": "string",
    "menuOptionTwoPrice": number
  }
]
\`\`\`
Each entry represents a **unique combination** of menu item + options + pricing. All fields must be included, and optional fields can be empty strings if not found.
`






})

const app = workflow.compile();

class LiveLogger extends BaseCallbackHandler {
    name="live-logger"

    async handleLLMStart(_llm, prompts, runId, parentRunId, extraParams) {
        console.log(`[LLM Start] Run ${runId} | Prompt:\n${prompts[0]}\n`);
    }

    async handleLLMEnd(output, runId, parentRunId) {
        console.log(`[LLM End] Run ${runId} | Output:\n${output.generations?.[0]?.[0]?.text}\n`);
    }

    async handleToolStart(tool, input, runId, parentRunId) {
        console.log(`[Tool Start] ${tool.name} | Input:\n${input}\n`);
    }
    async handleToolEnd(output, runId, parentRunId) {
        console.log(`[Tool End] Run ${runId} | Output:\n${output}\n`);
    }

    async handleAgentAction(action, runId, parentRunId) {
        console.log(`[Agent Action] Run ${runId} | Action:\n${JSON.stringify(action, null, 2)}\n`);
    }

    async handleAgentEnd(action, runId, parentRunId) {
        console.log(`[Agent End] Run ${runId} | Output:\n${JSON.stringify(action, null, 2)}\n`);
    }
}



const result = await app.invoke({
    messages: [ 
        new HumanMessage("find me every menu combination for this restaurant: https://stksteakhouse.olo.com/menu/stk-downtown/")
    ],
    
},
{
    callbacks: [new LiveLogger()],
    configurable: {thread_id: "42"}
})

if (typeof result === "string")
fs.writeFile("result.txt", result, () => {
    console.log("result written")
})
else
console.log("This wasn't a writtable type")


const code = ""
const error = ""
const url = "https://api.thedailysat.com"
const comments = ""


const prompt=`
This is the code provided: ${code}

This is the error being given: ${error}

Here is the url you can test to see how to fix this error: ${url}

Here's some extra comments: ${comments}
`

// const agentFinalState = await agent.invoke(
//     {
//         messages: [
//             new HumanMessage(prompt),
//         ],
//     },
//     {
//         configurable: { thread_id: "42" },
//     }
// );


// Here are all the AI agents + Tools that would be needed:

// Tools:

// 1) One that can actually do the requests (done)
// 2) 

// Agents:

// One to process code and the error, knows that endpoints to test

// 

// console.log(agentFinalState.messages.at(-1)?.content);