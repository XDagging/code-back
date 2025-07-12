import { z } from "zod";
import { tool } from "@langchain/core/tools";
import ivm from "isolated-vm";

const processToolSchema = z.object({
  verbose: z.boolean().optional(),
  code: z.string(),
  functionName: z.string(),
  parameters: z.array(z.string()).optional(),
});






const processTool = tool(
  async (input) => {
    const { verbose, code, parameters, functionName } = input;

    if (!code || !functionName) return "No function was sent";

    try {
      const isolate = new ivm.Isolate({ memoryLimit: 32 }); // 32 MB limit
      const context = await isolate.createContext();
      const jail = context.global;

      // Expose global to context
      await jail.set("global", jail.derefInto());

      // Inject code into the isolate
      await context.eval(`${code};`);

      // Parse parameters safely
      const parsedParams =
        parameters?.map((value) => {
          if (!isNaN(Number(value))) return Number(value);
          if (value.toLowerCase() === "true") return true;
          if (value.toLowerCase() === "false") return false;
          return value;
        }) ?? [];

      if (verbose) console.log("Parsed parameters:", parsedParams);

      const argsString = parsedParams
        .map((v) => JSON.stringify(v))
        .join(", ");

      // Timing logic
      const start = Date.now();

      // Execute the function inside the sandbox
      const result = await context.eval(
        `global.${functionName}(${argsString});`
      );

      const duration = Date.now() - start;

      return `This was the response from that function: ${result}${
        verbose ? ` (executed in ${duration}ms)` : ""
      }`;
    } catch (e: any) {
      return `Executing that code gave the following error: ${e.message || e}`;
    }
  },
  {
    name: "CodeTool",
    description: "Can run simple javascript functions that have no dependencies",
    schema: processToolSchema,
  }
);

export default processTool;


const testCode = `
function add(a, b) {
  return a + b;
}
`;

async function testRun() {
  const result = await processTool.invoke({
    verbose: true,
    code: testCode,
    functionName: "add",
    parameters: ["2", "3"]
  });

 
}

testRun();

