import { HARNESS_PROMPT } from "./config.js";
import Openai from 'openai'
import "dotenv/config"


export interface IMessage {
    role: 'user' | 'assistant' | 'developer';
    content: string
}

export interface ITool {
    name: string,
    description: string,
    doc? : string,
    executor : (input:string) => Promise<string>
}

export type Interceptor = (message: IMessage) => void


export class AgentBuilder{
    public instructions: string | undefined
    public toolList: ITool[]

    constructor() {
        this.toolList = []
    }

    public setInstructions(instructions:string){
        this.instructions = instructions
        return this
    }

    public tool(t:ITool) {
        this.toolList.push(t)
        return this
    }

    public build(){
        return new Agent(this)
    }


}


export class Agent {
    private instructions: string
    private messageHistory: IMessage[]
    private toolMap: Map<string, ITool>
    private openai: Openai

    private interceptors: Interceptor[]

    private MAX_LOOP = 30

    constructor(builder: AgentBuilder) {
        this.toolMap = new Map()
        this.openai = new Openai({
            baseURL: process.env.BASE_URL,
            apiKey: process.env.OPENAI_API_KEY
        })
        this.interceptors = []

        for ( const t of builder.toolList){
            this.toolMap.set(t.name, t)
        }

        this.instructions = `
            ${HARNESS_PROMPT}\n\n

            System Prompt:
            ${builder.instructions}

            Avaliable Tools: 
            ${builder.toolList.map(t => JSON.stringify({functionName: t.name, functionDescription: t.description, functionDoc: t.doc})).join('\n')}

        `
        this.messageHistory = []
    }

    public attachInterceptor(interceptor: Interceptor) {
        this.interceptors.push(interceptor)
    }

    private notifyInterceptors(message: IMessage) {
        for (const interceptor of this.interceptors) {
            interceptor(message)
        }
    }

    static builder(){
        return new AgentBuilder()
    }

    public printSystemPrompt(){
        console.log(this.instructions)
    }

    public async run(query:string) {
        
        this.messageHistory.push({role:'user', content: query})

        for(let i = 0; i < this.MAX_LOOP; i++){
            const llmResponse = await this.openai.responses.create({
                model: 'gpt-4o-mini',
                input: [
                    {role: 'system', content: this.instructions},
                    ...this.messageHistory.map(e => ({role: e.role, content: e.content}))
                ]
            })

            const rawLLMResponse:string = llmResponse.output_text as string

            this.messageHistory.push({role: 'assistant', content: rawLLMResponse})
            this.notifyInterceptors({ role: 'assistant', content: rawLLMResponse })

            const parsedResult = JSON.parse(rawLLMResponse)

            if(parsedResult.step.toLowerCase() === "output") return this.messageHistory

            if(parsedResult.step.toLowerCase() === "tool_request"){
                const {functionName, input} = parsedResult
                const tool = this.toolMap.get(functionName)

                if(!tool) {
                    this.messageHistory.push({role: 'developer', content: `Error: function with name ${functionName} do not exist`})
                }

                const toolResult = await tool?.executor(input)
                this.messageHistory.push({role: 'developer', content: JSON.stringify({
                    functionName,
                    input,
                    toolResult,
                })})
                this.notifyInterceptors({role: 'developer', content: JSON.stringify({
                    functionName,
                    input,
                    toolResult,
                })})
            }
        }
    }
}