import { StateAnnotation } from "./state.js";
import { StateGraph } from "@langchain/langgraph";
import { model } from "./model.js";

const frontDeskSupport = async (state) => {
    const SYSTEM_PROMPT = 'You are frontline support staff for Coder s Gyan, an ed-tech company that helps software developers excel in their careers through practical webdevelopment and Generative AI courses. be concise in your responses. You can chat with students and help them with basic questions, but if the student is having a marketing or learning support query, do not try to answer the question directly or gather information. Instead, immediately transfer them to the marketing team(promo codes, discounts, offers, and special campaigns) or learning support team(courses, syllabus coverage, learning paths, and study strategies) by asking the user to hold for a moment. Otherwise, just respond conversationally.You must respond in json'

    const supportResponse = await model.invoke([
        {
            role: 'system',
            content: SYSTEM_PROMPT
        },
        ...state.messages
    ])

    const assistantJson = JSON.parse(supportResponse.content);

    const CATEGORIZATION_SYSTEM_PROMPT = `Your are an expert customer support routing system.Your job is to detect whether a customer support representative is routing a user to a marketing team or learning support team , or if they are just responding conversationally.Return a json object with key nextRepresentative which can be either learning, marketing or none.Return JSON:
{ "nextRepresentative": "marketing" | "learning" | "none" }`

    const categoryResponse = await model.invoke([
        {
            role: 'system',
            content: CATEGORIZATION_SYSTEM_PROMPT
        },
        ...state.messages,
        supportResponse,
    ], {
        response_format: { type: 'json_object' }
    })

    console.log(supportResponse);
    const { nextRepresentative } = JSON.parse(categoryResponse.content);

    return { ...state, messages: [...state.messages, { role: 'assistant', content: assistantJson.message }], nextRepresentative }
}

const marketingSupport = (state) => {
    console.log('handled by marketing team')
    return state
}

const learningSupport = (state) => {
    console.log('handled by learning team')

    return state
}

const getNextNode = (state) => {
    if (state.nextRepresentative === 'marketing') {
        return 'marketingSupport';
    } else if (state.nextRepresentative === 'learning') {
        return 'learningSupport';
    } else {
        return '__end__'
    }
}


const graph = new StateGraph(StateAnnotation);

graph.addNode('frontDeskSupport', frontDeskSupport)
    .addNode('marketingSupport', marketingSupport)
    .addNode('learningSupport', learningSupport)
    .addEdge('__start__', 'frontDeskSupport')
    .addConditionalEdges('frontDeskSupport', getNextNode)
    .addEdge('marketingSupport', '__end__')
    .addEdge('learningSupport', '__end__')

const app = graph.compile();

const finalR = await app.stream({ messages: [{ role: 'user', content: 'Can i know contents of course?' }] })

for await (const r of finalR)
    console.log(r);