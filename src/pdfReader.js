import fs from 'fs';
import { createRequire } from 'module';
import { model } from './model.js';
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';

import dotenv from 'dotenv';
dotenv.config();

import { PDFParse } from 'pdf-parse';

export const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: process.env.OPEN_API_KEY,
});


const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});


async function extractTextFromPDF(filePath) {

    const parser = new PDFParse({ url: './cg-knowledge-base.pdf' });
    const result = await parser.getText();

    // const buffer = fs.readFileSync(filePath);
    // const data = await PDFParse(buffer);
    return result.text;
}

function chunkText(text, chunkSize = 800, overlap = 100) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
        chunks.push(text.slice(start, start + chunkSize));
        start += chunkSize - overlap;
    }

    return chunks;
}

// ---- RUN ----
const text = await extractTextFromPDF('./cg-knowledge-base.pdf');

const chunks = chunkText(text);
console.log('Total chunks:', chunks.length);
console.log('Sample chunk:', chunks[0].slice(0, 200));

const indexName = "cg-learning-knowledge";

// await pinecone.createIndex({
//     name: indexName,
//     dimension: 3072,
//     metric: "cosine",
//     spec: {
//         serverless: {
//             cloud: "aws",
//             region: "us-east-1",
//         },
//     },
// });

const index = pinecone.index(indexName);



const embeddingsArray = await embeddings.embedDocuments(chunks);

const vectors = chunks.map((chunk, i) => ({
    id: `chunk_${i}`,
    embedding: embeddingsArray[i],
    text: chunk,
}));


const pineconeVectors = vectors.map((v) => ({
    id: v.id,
    values: v.embedding,
    metadata: {
        text: v.text,
        source: "cg-knowledge-base.pdf",
    },
}));

await index.upsert(pineconeVectors);
