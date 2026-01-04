import { ChatGroq } from "@langchain/groq";
import dotenv from 'dotenv';

dotenv.config();

export const model = new ChatGroq({
    model: 'openai/gpt-oss-120b',
    temperature: 0,
})