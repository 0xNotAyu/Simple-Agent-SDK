import axios from "axios"
import { Agent, AgentBuilder} from "./app/agent.js"
import type { ITool } from "./app/agent.js"
import { exec } from 'child_process';

const weatherTool: ITool = {
    name: "fetchWeatherData",
    description: 'Fetches realtime weather data by cityname',
    doc: "fetchWeatherData(cityname: string): WeatherReport",
    async executor(cityname) {
        const url = `https://wttr.in/${cityname.toLowerCase()}?format=%C+%t`
        const response = await axios.get(url, {responseType: 'text'});
        return JSON.stringify({cityname, weatherInfo: response.data})
    }
}

const cliAccessTool: ITool = {
    name: 'execCli',
    description: `
        The execCli tool executes commands using Windows CMD (cmd.exe)
        Generate only valid Windows CMD commands.Do not generate Bash, PowerShell, or Unix shell syntax.
    `,
    doc: `
            execCli(cli: string): CLIResponse
            
            The command is executed using Windows CMD (cmd.exe), NOT PowerShell or Bash.
            
            Windows CMD escaping rules:
            - Escape < as ^<
            - Escape > as ^>
            - Escape | as ^|
            - Escape & as ^&
            - Escape ( as ^(
            - Escape ) as ^)
            - Escape ^ as ^^
            - Escape % as %%
            - Use >> to append to files.
            - Wrap file paths containing spaces in double quotes.
            - Generate only valid cmd.exe commands.
`,
    executor(cmd) {
        return new Promise((res, rej) => {
            exec(cmd, (err, out) => {
                if (err) return res(`There was an Error ${err}`);
                else return res(out);
            });
        });
    }
}

async function init(){

    const codingAgent: Agent = Agent.builder()
        .setInstructions(`You are an expert coding Agent`)
        .tool(cliAccessTool)
        .build()

    const weatherAgent: Agent = Agent.builder()
        .setInstructions('you are an expert weather agent')
        .tool(weatherTool)
        .build()

    const result = await codingAgent.run('Can you write a small c++ program in of hello world in a new cpp file')
    console.log(result)
}

init()