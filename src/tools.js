import { tool } from '@langchain/core/tools';
import { vectorStore } from './pdfReader.js';

export const getOffers = tool(() => {
    return [
        {
            code: 'LAUNCH',
            discount_percent: 20
        },
        {
            code: 'FIRST_20',
            discount_percent: 40
        }
    ]
}, {
    name: 'getOffers',
    description: 'Call this tool to get the available discount and offers',

})

export const searchLearningKB = tool(async (query) => {
    const results = await vectorStore.similaritySearch(query, 3);
    console.log('Learning KB search results:', results);
    return results.map((res, idx) => `Result ${idx + 1}:\n${res.pageContent}`).join('\n\n');
}, {
    name: 'searchLearningKB',
    description: 'Use this tool to search the learning knowledge base to answer user queries related to learning content, courses, and study materials.',
})