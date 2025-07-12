import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { readFileSync } from "fs";
import fs from "fs"



const assetInstallerSchema = z.object({
    url: z.string(),
    fileName: z.string(),
    fileExtension: z.string()


})


// This tool will just write the file, but that doesn't necessarily mean the file is valid since we are just outputting the buffer from the request
const assetInstallerTool = tool(

    async(input) => {
        const {url, fileName, fileExtension} = input
        try {
            const response = await fetch(url, {
                method: "GET"
            })


            const content = Buffer.from(await response.arrayBuffer())
            // console.log(await response.arrayBuffer
            // const nodeBuffer = Buffer.from(content, "base64")
            const absolutePath = path.resolve("./media", fileName);
            await fs.writeFile(absolutePath + fileExtension, content, () => {

            });

            console.log(content);


            } catch(e) {

                console.log("Here is the error", e)
                return "There was an error: " + e 
                
            }
        






       

        





    }, {
        name: "Asset Installer",
        description: "Installs online assets to local",
        schema: assetInstallerSchema
    }
)


async function testCode() {
    await assetInstallerTool.invoke({
        url: "https://cdn.prod.website-files.com/5aa5e0f4dc199e000140e6ce/67b251f082eb69c24ff69be6_Makimaki%20Lunch2025.jpg",
        fileName: "boo",
        fileExtension: ".png"
    })



}

testCode()