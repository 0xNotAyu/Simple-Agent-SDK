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



async function init(){


    const weatherAgent: Agent = Agent.builder()
        .setInstructions('you are an expert weather agent')
        .tool(weatherTool)
        .build()

    const result = await weatherAgent.run('')
    console.log(result)
}

init()