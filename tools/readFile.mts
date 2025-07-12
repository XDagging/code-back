import {z} from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import fs from "fs/promises";





const readFileSchema = z.object({
    filePath: z.string(),
    outputType: z.enum(["string", "base64"]).optional()
})



const readFileTool = new DynamicStructuredTool({
    name: "readFile",
    description: "Let's you read a file on the filesystem",
    schema: readFileSchema,
    func: async (input): Promise<any> => {
        const { filePath, outputType } = input;
        if (filePath) {
            try {
                const data: Buffer = await fs.readFile(filePath);
                switch (outputType) {
                    case "string": 
                        return data.toString()
                    case "base64":
                        return data.toString("base64")

                    default: 
                        return data.toString()
                }
            } catch (err) {
                console.log(err);
                return "File path is wrong: " + err;
            }
        } else {
            return "No file path was provided"
        }
    }
})

export default readFileTool