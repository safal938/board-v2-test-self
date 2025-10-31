import React, { useState, useCallback, useEffect, useRef } from "react";
import styled from "styled-components";

const NoteContainer = styled.div`
  width: 100%;
  height: 100%;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;T
`;

const NoteHeader = styled.div`
  background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const NoteTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Timestamp = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  gap: 6px;
`;

const SaveIndicator = styled.span<{ saving?: boolean }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${props => props.saving ? 'rgba(255, 255, 255, 0.2)' : 'rgba(34, 197, 94, 0.3)'};
  color: white;
  font-weight: 500;
`;

const NoteTextArea = styled.textarea`
  flex: 1;
  padding: 16px;
  border: none;
  font-size: 14px;
  color: #1e293b;
  background: white;
  resize: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
    sans-serif;
  line-height: 1.6;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: #cbd5e1;
  }
`;

interface DoctorNoteProps {
  id: string;
  noteData?: {
    content?: string;
    timestamp?: string;
  };
  onUpdate?: (id: string, data: any) => void;
}

const DoctorNote: React.FC<DoctorNoteProps> = ({ id, noteData, onUpdate }) => {
  const [content, setContent] = useState(noteData?.content || "");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
    },
    []
  );

  // Auto-save every 10 seconds
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for 10 seconds
    autoSaveTimerRef.current = setTimeout(() => {
      if (onUpdate && content !== noteData?.content) {
        console.log("🔄 Auto-saving doctor note:", id);
        setIsSaving(true);
        onUpdate(id, {
          noteData: {
            content: content,
            timestamp: new Date().toISOString(),
          },
        });
        setLastSaved(new Date());
        
        // Clear saving indicator after 1 second
        setTimeout(() => setIsSaving(false), 1000);
      }
    }, 10000); // 10 seconds

    // Cleanup on unmount or when content changes
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, id, onUpdate, noteData?.content]);

  const timestamp = lastSaved
    ? lastSaved.toLocaleString()
    : noteData?.timestamp
    ? new Date(noteData.timestamp).toLocaleString()
    : new Date().toLocaleString();

  return (
    <NoteContainer>
      <NoteHeader>
        <NoteTitle>📝 Doctor's Note</NoteTitle>
        <Timestamp>
          {lastSaved && (
            <SaveIndicator saving={isSaving}>
              {isSaving ? "Saving..." : "Saved"}
            </SaveIndicator>
          )}
          {timestamp}
        </Timestamp>
      </NoteHeader>
      <NoteTextArea
        value={content}
        onChange={handleChange}
        placeholder="Type your note here..."
      />
    </NoteContainer>
  );
};

export default DoctorNote;
