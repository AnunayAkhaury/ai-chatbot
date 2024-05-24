"use client";

import * as React from "react";
import Textarea from 'react-textarea-autosize';
import { useActions, useUIState } from 'ai/rsc';
import { UserMessage, BotMessage } from './stocks/message';
import { type AI } from '@/lib/chat/actions';
import { Button } from '@/components/ui/button';
import { IconArrowElbow, IconPlus } from '@/components/ui/icons';
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { Message, useAssistant } from "ai/react";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


type CustomFile = {
  name: string;
  size: number;
  type: string;
  content: string;
};

export function PromptForm({
  input,
  setInput,
}: {
  input: string;
  setInput: (value: string) => void;
}) {
  const router = useRouter();
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { submitUserMessage } = useActions();
  const [_, setMessages] = useUIState<typeof AI>();
  const { status, messages: assistantMessages, input: aiInput, submitMessage, handleInputChange, error, setInput: setAIinput, threadId, append } = useAssistant({ api: "/api/assistant" });
  const [selectedFile, setSelectedFile] = React.useState<CustomFile | null>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  React.useEffect(() => {
    setMessages(assistantMessages.map((m: Message) => {
      let parsedContent;
      try {
        parsedContent = JSON.parse(m.content);
      } catch (e) {
        console.error('Failed to parse content', m.content);
        parsedContent = { message: m.content };
      }
      return {
        id: nanoid(),
        display: m.role === 'assistant' ? (
          <BotMessage content={m.content} />
        ) : (
          <UserMessage>{parsedContent.message}</UserMessage>
        ),
      };
    }));
  }, [assistantMessages, setMessages]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && e.target.result) {
          setSelectedFile({
            name: file.name,
            size: file.size,
            type: file.type,
            content: e.target.result.toString().split(',')[1], 
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = aiInput.trim();
    console.log(value);
    setAIinput('');
    if (!value) return;

    setMessages((messages: any) => [
      ...messages,
      {
        id: nanoid(),
        display: <UserMessage>{value}</UserMessage>
      }
    ]);

    if (selectedFile) {
      const formData = new FormData();
      formData.append('message', value);
      formData.append('file', JSON.stringify({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        content: selectedFile.content,
      }));
      formData.append('threadId', threadId ?? '');
      formData.append('isAppended', 'true');
      
      const formDataEntries = Object.fromEntries(formData.entries());
      append({
        role: 'user',
        content: JSON.stringify(formDataEntries),
      });
      setSelectedFile(null);
    } else {
      const formData = new FormData();
      formData.append('message', value);
      formData.append('threadId', threadId ?? '');
      formData.append('isAppended', 'false');
      const formDataEntries = Object.fromEntries(formData.entries());
      append({
        role: 'user',
        content: JSON.stringify(formDataEntries),
      });
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-background px-8 sm:rounded-md sm:border sm:px-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-[14px] size-8 rounded-full bg-background p-0 sm:left-4"
              onClick={() => {
                document.getElementById('file-input')?.click();
              }}
            >
              <IconPlus />
              <span className="sr-only">Upload File</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload File</TooltipContent>
        </Tooltip>
        <input
          id="file-input"
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
          {selectedFile && (
          <div className="mt-2 ml-10 text-sm text-gray-600">
            File selected: {selectedFile.name}
          </div>
        )}
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          placeholder="Send a message."
          className="min-h-[60px] w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={aiInput}
          onChange={handleInputChange}
        />
        <div className="absolute right-0 top-[13px] sm:right-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" size="icon" disabled={status === "loading"}>
                <IconArrowElbow />
                <span className="sr-only">Send message</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </form>
  );
}
