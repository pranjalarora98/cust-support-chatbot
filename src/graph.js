import { StateAnnotation } from "./state.js";
import { StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { model } from "./model.js";
import { getOffers, searchLearningKB } from "./tools.js";

const marketingTools = [getOffers]
const marketingToolNode = new ToolNode(marketingTools)

const learningTools = [searchLearningKB]
const learningToolNode = new ToolNode(learningTools);

const frontDeskSupport = async (state) => {
    const SYSTEM_PROMPT = 'You are frontline support staff for Coder s Gyan, an ed-tech company that helps software developers excel in their careers through practical webdevelopment and Generative AI courses. be concise in your responses. You can chat with students and help them with basic questions, but if the student is having a marketing or learning support query, do not try to answer the question directly or gather information. Instead, immediately transfer them to the marketing team(promo codes, discounts, offers, and special campaigns) or learning support team(courses, syllabus coverage, learning paths, and study strategies) by asking the user to hold for a moment. Otherwise, just respond conversationally.You must respond in json'

    const supportResponse = await model.invoke([
        {
            role: 'system',
            content: SYSTEM_PROMPT
        },
        ...state.messages
    ], {
        response_format: { type: 'json_object' }
    })

    // console.log('frontdesk', JSON.parse(supportResponse.content).response)


    const CATEGORIZATION_SYSTEM_PROMPT = `Your are an expert customer support routing system.Your job is to detect whether a customer support representative is routing a user to a marketing team or learning support team , or if they are just responding conversationally.Return a json object with key nextRepresentative which can be either learning, marketing or none.Return JSON:
{ "nextRepresentative": "marketing" | "learning" | "none" }`

    const categoryResponse = await model.invoke([
        {
            role: 'system',
            content: CATEGORIZATION_SYSTEM_PROMPT
        },
        ...state.messages,
        { role: 'assistant', content: supportResponse.content },
    ], {
        response_format: { type: 'json_object' }
    })

    const { nextRepresentative } = JSON.parse(categoryResponse.content);

    return { ...state, nextRepresentative, messages: [...state.messages, { role: 'assistant', content: JSON.parse(supportResponse.content).response }] }
}

const marketingSupport = async (state) => {
    const llmWithTools = model.bindTools(marketingTools)

    console.log('marketing support called');

    const SYSTEM_PROMPT = `You are part of the Marketing Team at Coder's Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
You specialize in handling questions about promo codes, discounts, offers, and special campaigns.
Answer clearly, concisely, and in a friendly manner. For queries outside promotions (course content, learning), politely redirect the student to the correct team.
Important: Answer only using given context, else say I don't have enough information about it.`;

    const response = await llmWithTools.invoke([{
        role: 'system',
        content: SYSTEM_PROMPT
    },
    ...state.messages
    ]);

    console.log('marketing tool response', response)
    return { ...state, messages: [...state.messages, response] };
}

const learningSupport = async (state) => {
    const SYSTEM_PROMPT = `You are part of the Learning Support Team at Coder's Gyan, an ed-tech company that helps software developers excel in their careers through practical web development and Generative AI courses.
You assist students with questions about available courses, syllabus coverage, learning paths, and study strategies.
Keep your answers concise, clear, and supportive. Strictly use information from retrived context for answering queries. If the query is about learning issues, politely redirect the student to the respective team.
Important: Call searchLearningKB max 3 times if the tool result is not relevant to original query.`;

    console.log('learning support called');

    const llmWithTools = model.bindTools(learningTools);

    const response = await llmWithTools.invoke([{
        role: 'system',
        content: SYSTEM_PROMPT
    },
    ...state.messages
    ])


    console.log('learning tool response', response)

    return { ...state, messages: [...state.messages, response] };
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

const hasMarketingToolCall = (state) => {
    if (state.messages[state.messages.length - 1]?.tool_calls?.length > 0)
        return 'marketingTool';
    return '__end__';
}

const hasLearningToolCall = (state) => {
    if (state.messages[state.messages.length - 1]?.tool_calls?.length > 0)
        return 'learningTool';
    return '__end__';
}

const graph = new StateGraph(StateAnnotation);

graph.addNode('frontDeskSupport', frontDeskSupport)
    .addNode('marketingSupport', marketingSupport)
    .addNode('marketingTool', marketingToolNode)
    .addNode('learningSupport', learningSupport)
    .addNode('learningTool', learningToolNode)
    .addEdge('__start__', 'frontDeskSupport')
    .addConditionalEdges('frontDeskSupport', getNextNode)
    .addConditionalEdges('marketingSupport', hasMarketingToolCall)
    .addConditionalEdges('learningSupport', hasLearningToolCall)
    .addEdge('marketingTool', '__end__')
    .addEdge('learningTool', '__end__');;

const app = graph.compile();

const stream = await app.stream({ messages: [{ role: 'user', content: 'Can i know mission of Codersgyaan?' }] })

for await (const step of stream) {
    console.log('STEP:', Object.keys(step)[0]);
    console.log(JSON.stringify(step, null, 2));
}