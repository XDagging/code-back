import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { v4 as uuidv4 } from 'uuid';
import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer';
import { ElementHandle } from "puppeteer";
// import { emitKeypressEvents } from "readline";
import fs from "fs"
// import { timeout } from "puppeteer";

// Little confused on the scope of work here. We will work on this 

// Essentially, this tool should allow the ai agent to click on any component freely. 


// Known issues

// Sometimes doesn't work with modal structures


const renderSchema = z.object({
    
    url: z.array(z.string()),
    action: z.enum(["click", "fill", "reload", "find", "skeleton"]),
    selectionType: z.enum(["css", "xpath", "text", "aria", "none", "tag"]),
    value: z.string(),
    elm: z.string().optional(),
    saveState: z.boolean().optional(),
    stateId: z.string().optional(),
    cookies: z.array(z.object({
        domain: z.string(),
        name: z.string(),
        value: z.string()
    })).optional()
})

// const element = await page.waitForSelector('div > .class-name');

type Action = {

}

type ParsedData = {
    url: string;
    data: string;
    img: string;
    stateId: string;    

}

type Result = {
    message: string,
    code: string
}



// Maybe i should put a timeout that is very large to see if it is possible right now it is lagging my computer

async function doParsing(page: Page ,selectionType: "css" | "xpath" | "text" | "aria" | "none" | "tag", action: "click" | "fill" | "reload" | "find" | "skeleton", value: string, elm: string | undefined): Promise<string> {
    return new Promise(async(resolve) => {
        if (action==="find") {
            let content : ElementHandle<Element> | null;
            await sleep(3000);
            switch (selectionType) {
           
                case "xpath": 
                    console.log(page.content())
                    content = await page.waitForSelector("xpath/" + value, {timeout: 20000});
                    resolve(content!==null ? content.evaluate((el) => el.textContent) : "")
                    break;
                case "none":
                    console.log("We got here and are processing")
                    await sleep(3000);
                    const val: string = await page.evaluate(() => document.body.textContent || "");
                    // console.log("we are resolving ts", value)
                    resolve(val);
                    break;
                case "css":
                    content = await page.waitForSelector(value);
                    resolve(content!==null ? content.evaluate((el) => el.textContent) : "")
                    break;
                case "tag":
                    // Find all <a> tags with href attributes
                    const links = await page.$$eval(value, (elements) =>
                        elements.map(el => (el as HTMLAnchorElement).href)
                    );
                    resolve(JSON.stringify(links));
                

                    break;


                default:
                    resolve("")
                    break;
            }



        } else if (action ==="skeleton") {
            console.log("We got here and are processing")
            const value: string = await page.evaluate(() => document.body.innerText || "");
            console.log("we are resolving ts", value)
            resolve(value);


        } else if (action==="click") {
            let content: ElementHandle | null;
            switch (selectionType) {
                
                case "xpath": 
                    console.log(page.content())
                    content = await page.waitForSelector("xpath/" + value, {timeout: 20000})
                    content?.click()
                    resolve("")
                    break;
                case "css":
                    content = await page.waitForSelector(value);
                    await content?.click()
                    resolve("")
                    break;
                case "tag":
                    // Find the first wtvr tags with href attributes
                    const element = await page.$eval(elm?.substring(0,1)+value, (elm) => {
                        return elm as HTMLAnchorElement
                    }) 
                    await element.click()
                    resolve("");
                    break;
                default:
                    resolve("")
                    break;
            }






        }

        else if (action==="fill") {


            let content: ElementHandle | null;
            switch (selectionType) {
                
                case "xpath": 
                    console.log(page.content())
                    content = await page.waitForSelector("xpath/" + value, {timeout: 20000})
                    if (content) {
                        await content.click({ clickCount: 3 }); // Focus and select all text
                        await page.keyboard.type(value);
                        resolve(value)
                    }  else {
                        resolve("")
                    }
                    
                    break;
                case "css":

                    content = await page.waitForSelector(value);
                    if (content) {
                        await content.click({ clickCount: 3 }); // Focus and select all text
                        await page.keyboard.type(value);
                        resolve(value)
                    }  else {
                        resolve("")
                    }

                    break;
                case "tag":
                    // Find all <a> tags with href attributes
                    const links = await page.$$eval(value, (elements) =>
                        elements.map(el => (el as HTMLAnchorElement))
                    );

                    if (links) {
                        links.forEach(async(link) => {
                            await link.click(); // Focus and select all text
                            await page.keyboard.type(value);
                        })
                        
                        resolve(value);
                    }  else {
                        resolve("");
                    }
                    resolve("");
                    break;
                default:
                    resolve("")
                    break;
            }
        } else if (action==="reload") {
            page.reload();
        }


        else {
            console.log("Went to the else for some reason")
            resolve("")
        }
    })
    
    
    

}



function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeForLLM(input: string): string {
  return input
    // .replace(/\u0000/g, "") // Remove null characters
    .replace(/\s+/g, " ")   // Normalize whitespace
    .trim();
}

function createScreenshotPath(url: string) {
    const screenshotPath = String(url.split(".")[url.split(".").length-1]) + ".png"

    return screenshotPath.replaceAll("/","-")

}  


// function convertToBase64(path: string): Promise<string> {
//     return new Promise((resolve, reject) => {
//         fs.readFile(path, (err, data) => {
//             if (err) {
//                 console.log("was an error in reading the image");
//                 resolve("err");
//             } else if (data) {
//                 resolve(data.toString("base64"));
//             } else {
//                 resolve("err");
//             }
//         });
//     });
// }

type Cookie = {
    name: string,
    value: string,
    domain: string,
}


async function setCookies(cookies: Cookie[] | undefined, context: BrowserContext) {
    if (cookies&&context) {
        
        for (let i=0; i<cookies.length;i++) {
            const currCookie = cookies[i]
            await context.setCookie({
                name: currCookie.name,
                domain: currCookie.domain,
                value: currCookie.value
            })
        }
        return 
    } else {
        return
        // No cookies
    }

}

type BrowserStore = {
    browser: Browser,
    context: BrowserContext
}



const globalBrowserStore = new Map<string, BrowserStore>();


const renderTool = tool(    
    
    async(input): Promise<Action[] | Result | string | Page> => {
        const {url, action, selectionType, value, elm, cookies, saveState, stateId} = input;

        console.log("this was called", input);
        let browser: Browser;
        let context: BrowserContext;
        const sessionId = stateId || uuidv4() 
        if (saveState&&stateId) {    
            const importedVIM = globalBrowserStore.get(sessionId);


            if (importedVIM?.browser&&importedVIM?.context) {
                browser = importedVIM.browser;
                context = importedVIM.context;
            } else {
                return "Wrong ID given";
            }
        
        } else {
            browser = await puppeteer.launch();
            context = await browser.createBrowserContext()
        }
        
        // const browser = await puppeteer.launch();
        // const context = await browser.createBrowserContext(); 
        if (saveState&&!stateId) {
            globalBrowserStore.set(sessionId, {
                browser: browser,
                context: context
            })
        }
        
        setCookies(cookies, context)
        

        
        const page = await browser.newPage();
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
        });
        if (Array.isArray(url)) {
            const allData = [] as ParsedData[]

            for (let curr = 0; curr < url.length; curr++) {
                await sleep(2000);
                console.log("Calling next page");
                await page.goto(url[curr]);
                const response: string = await doParsing(page, selectionType, action, value, elm);
                // console.log("This was the path I was thinking about", createScreenshotPath(url[curr]))
                const path = createScreenshotPath(url[curr])

                const img = await page.screenshot({fullPage: false, optimizeForSpeed: true, encoding: "base64"})
                // const imageData = await convertToBase64(path)



                let res = await sanitizeForLLM(response);
                console.log(res);
                
                allData.push({
                    url: url[curr],
                    data: res,
                    img: img,
                    stateId: sessionId
                });
            }

            const finalDataInFormat = allData.map((data) => ([
                {
                    type: "text",
                    text: data.data,
                },
                {
                    type: "image_url",
                    image_url: { url: `data:image/png;base64,${data.img}` }
                }
            ])).flat();

            return finalDataInFormat
            
            
            
//             JSON.stringify(allData.map(d => ({
//   url: d.url,
//   data: d.data,
//   img: d.img
// })), null, 2);



        } else {
            throw new Error("URL wasn't a link")

            

        }
    },
    {
        name: "Renders-frontend-pages-for-webscraping",
        description: `Renders-frontend-pages-for-webscraping simulates a headless browser session using Puppeteer to interact with JavaScript-heavy websites. It supports advanced page rendering and DOM parsing operations, including:

Navigating to one or more URLs

Clicking on elements (planned)

Extracting text content based on different selection strategies (css, xpath, text, aria, tag, or none)

Performing structured actions such as click, fill, reload, find, and skeleton (only find and skeleton currently implemented)

This tool is particularly useful for scraping content from dynamic webpages that require JavaScript execution or user interaction (e.g., menus behind modals, tabs, or buttons).

Supported Parameters:
url (array of strings): The list of webpages to render and process.

action (enum): The task to perform. Currently supports:

find: Extracts content from a specified element.

skeleton: Extracts the full page's visible text content.

selectionType (enum): The method used to select an element. Use "none" to extract all body text.

value (string): The actual selector (e.g., CSS string, XPath expression, tag name, etc.).

Output:
A JSON-formatted list of results, each including:

The original url

The extracted data (cleaned and truncated to ~4000 characters)

⚠️ Note: Modal-based or deeply dynamic content may fail to load without additional user-like actions (e.g., clicking), which are planned for future support.

`,
        schema: renderSchema
    }
)

export default renderTool



async function testCode() {
    console.log(await renderTool.invoke({
  url: [ 'https://www.summerhouserestaurants.com/north-bethesda/menus/' ],
  action: 'find',
  selectionType: 'tag',
  value: 'a',
  saveState: true,
  
}))

    console.log(globalBrowserStore.values())
}




testCode()