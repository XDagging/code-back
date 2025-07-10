import {z} from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

const requestSchema = z.object({
    url: z.string().describe("The URL or the target"),
    method: z.string().describe("The method for the request"),
    headers: z.string().optional().describe("Headers for the request. Very necessary if you know the Content-Type to get proper formatting"),
    body: z.string().optional().describe("The body of the request") // This would be a JSON.stringified
})

type methodType = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

const doRequest = (url: string, method: methodType, headers: string | null, body: string | null) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!url.startsWith("http")) {
                return reject("Invalid url");
            }

            let parsedHeaders: Record<string, string> = {};
            if (headers) {
                try {
                    parsedHeaders = JSON.parse(headers);
                } catch {
                    return reject("Invalid Headers: must be valid JSON");
                }
            }

            let parsedBody: any = undefined;
            if (body) {
                try {
                    parsedBody = JSON.parse(body);
                } catch {
                    return reject("Invalid body: must be valid JSON");
                }
            }

            const response = await fetch(url, {
                method: method.toUpperCase(),
                credentials: "include",
                headers: parsedHeaders,
                body: ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) && body ? body : undefined
            });

            const contentType = response.headers.get("content-type");
            let result: string | object;

            // We need to add a way to authentication be accounted for (let's say it has a set-cookie header)

            console.log("this was the stuff, got here", contentType)
            if (contentType && contentType.includes("application/json")) {
                resolve(await response.json())
            } else {
                const text = await response.text();
                // console.log("this is the text", text)
                resolve(text)
            }
        } catch(e) {
            reject(e);
        }
    }) 
}

const requestTool = new DynamicStructuredTool({
    name: "request",
    description: "Allows to make requests to specific urls.",
    schema: requestSchema,
    func: async (input): Promise<string> => {
        const { url, method, headers, body } = input;
        console.log("this was the url generated", url);
        console.log("method", method);
        console.log("headers", headers);
        console.log("body",  body)
        try {
            const result = await doRequest(url, method as methodType, headers || null, body || null)
            console.log(result);
            console.log("This is the type of result", typeof result)
            return typeof result === "string" ? result : JSON.stringify(result);
        } catch (e: any) {
            return `Request failed: ${e}`;
        }
    }
})

export default requestTool;