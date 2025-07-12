import { tool } from "@langchain/core/tools";
import { z } from "zod";
import path from "path";
import { readFileSync } from "fs";
import Tesseract from "tesseract.js";

const imgRenderSchema = z.object({
  pathToImg: z.string(),
});

const imgRenderTool = tool(
  async (input) => {    
    const { pathToImg } = input;

    if (!pathToImg) return "No path provided";

    const absolutePath = path.resolve("./media", pathToImg);
    console.log("File Path:", absolutePath);

    try {
      const { data: { text } } = await Tesseract.recognize(
        absolutePath,
        "eng",
        {
          logger: (m) => console.log(m), // Optional: logs OCR progress
        }
      );

      console.log("OCR Text:", text);
      return text;
    } catch (e) {
      console.error("OCR failed:", e);
      return `Error during OCR: ${e.message || e}`;
    }
  },
  {
    name: "Image Render Tool",
    description: "Extracts text from an image using OCR",
    schema: imgRenderSchema,
  }
);

async function testCode() {
  const result = await imgRenderTool.invoke({
    pathToImg: "makiMakiImg.jpg",
  });
  console.log("Final result:", result);
}

testCode();
