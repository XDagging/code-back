import fs from "fs";
import { tool } from "@langchain/core/tools";
import { z } from "zod"






const writeFileSchema = z.object({
    filePath: z.string(),
    newContent: z.string(),
})






const writeTool = tool(
    async(input) => {
        const { filePath, newContent } = input;
        if (filePath&&newContent) {
            fs.writeFile(filePath, newContent.toString(), (err) => {
                if (err) {
                    console.log("Something went wrong");
                    return "Something went wrong in writing file: " + err
                } else {
                    return "Modified file as intended: " + newContent
                }
            })
        } else {    
            return "Invalid Parameters in either File path or New Content"
        }
        console.log("hello world")
    }, {    
        name: "Write Tool",
        description: "Allows you to modify files",
        schema: writeFileSchema


    }

)


export default writeTool
