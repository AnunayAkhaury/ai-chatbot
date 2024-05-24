import { AssistantResponse } from 'ai';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai_assist = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});
async function getOrCreateVectorStore(openai_assist: OpenAI) {
  const vectorStoreName = 'Uploaded Files';
  const existingVectorStores = await openai_assist.beta.vectorStores.list();

  let vectorStore = existingVectorStores.data.find(store => store.name === vectorStoreName);

  if (!vectorStore) {
    vectorStore = await openai_assist.beta.vectorStores.create({
      name: vectorStoreName,
    });
  }

  return vectorStore.id;
}

export async function POST(req: Request) {
  const contentType = req.headers.get('Content-Type') || '';
  const assistant_id = process.env.ASSISTANT_ID ?? '';
  try {
    if (contentType.includes('application/json')) {
      const json = await req.json();
      console.log('Received JSON:', json);
      const parsedData = JSON.parse(json.message);
      console.log('Parsed JSON:', parsedData);
      const message = parsedData.message;
      const threadIdtemp = parsedData.threadId || null;
      const appended = parsedData.isAppended === 'true';
      let file: { name: string; size: number; type: string; content: string } | null = null;
      if (appended) {
        file = parsedData.file ? JSON.parse(parsedData.file) : null;

        console.log('Message:', message);
        console.log('Thread ID:', threadIdtemp);
        if (file) {
          const fileContent = Buffer.from(file.content, 'base64');
          const vectorStoreId = await getOrCreateVectorStore(openai_assist);
          const fileLike = new File([fileContent], file.name, { type: file.type });
          const uploadedFile = await openai_assist.beta.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, {
            files: [fileLike],
          });
          await openai_assist.beta.assistants.update(assistant_id, {
            tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
          });
          console.log('Vector Store created and file uploaded:', uploadedFile);
          
        } else {
          console.log('No file uploaded');
        }
      } else {
        console.log('Normal submission:', message, threadIdtemp);
      }

      const threadId = threadIdtemp ?? (await openai_assist.beta.threads.create({})).id;


      const createdMessage = await openai_assist.beta.threads.messages.create(threadId, {
            role: 'user',
            content: message?.toString() || '',
          });
       

       

      console.log('createdMessage:', createdMessage);

      return AssistantResponse(
        { threadId, messageId: createdMessage.id },
        async ({ forwardStream, sendDataMessage }: { forwardStream: any, sendDataMessage: any }) => {
          const runStream = openai_assist.beta.threads.runs.stream(threadId, {
            assistant_id:
              process.env.ASSISTANT_ID ??
              (() => {
                throw new Error('ASSISTANT_ID is not set');
              })(),
          });


          let runResult = await forwardStream(runStream);

          while (
            runResult?.status === 'requires_action' &&
            runResult.required_action?.type === 'submit_tool_outputs'
          ) {
            const tool_outputs =
              runResult.required_action.submit_tool_outputs.tool_calls.map(
                (toolCall: any) => {
                  const parameters = JSON.parse(toolCall.function.arguments);

                  switch (toolCall.function.name) {

                    default:
                      throw new Error(
                        `Unknown tool call function: ${toolCall.function.name}`,
                      );
                  }
                },
              );

            runResult = await forwardStream(
              openai_assist.beta.threads.runs.submitToolOutputsStream(
                threadId,
                runResult.id,
                { tool_outputs },
              ),
            );
          }
        },
      );
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
