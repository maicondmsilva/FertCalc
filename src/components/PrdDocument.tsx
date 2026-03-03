import React from 'react';
import ReactMarkdown from 'react-markdown';

interface PrdDocumentProps {
  content: string;
}

export default function PrdDocument({ content }: PrdDocumentProps) {
  return (
    <div className="markdown-body p-6 bg-white rounded-xl shadow-sm border border-stone-200">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
