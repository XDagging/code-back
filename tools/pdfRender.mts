import fs from 'fs';
import pdf from 'pdf-parse'
import { tool } from "@langchain/core/tools";
import { z } from "zod"
import path from "path"






const pdfRenderSchema = z.object({
    filePath: z.string(),

})



const pdfRenderTool = tool(

    async(input) => {
        // console.log("aksdjadfks")
        const {filePath } = input
       if (filePath) {
    const absolutePath = path.resolve(path.dirname(".") + "/media/", filePath);
    console.log("File Path:", absolutePath);

    try {
        const file = fs.readFileSync(absolutePath); // ❗️ DO NOT use `await` here
        console.log("The file buffer:", file.slice(0, 10)); // Just a preview

        const data = await pdf(file); // await only here
        // console.log("PDF data:", data.text);
        return data.text
    } catch (e) {
        console.error("❌ Error while parsing PDF:");
        console.error(e.message);
        console.error(e.stack);
    }
}



           

         else {
            return "File path is invalid"
        }






    },
    {
        name: "Write Tool",
        description: "Allows you to modify files",
        schema: pdfRenderSchema

    }

)



async function testCode() {

    console.log(await pdfRenderTool.invoke({
        filePath: "sample.pdf"

    }))


}

testCode()