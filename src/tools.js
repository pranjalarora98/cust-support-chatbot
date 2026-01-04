import { tool } from '@langchain/core/tools';

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