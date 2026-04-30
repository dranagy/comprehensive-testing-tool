"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { ingest, sessions as sessionsApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { Session } from "@/lib/types";

const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];
const FORMAT_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "text/markdown": "MD",
};

export default function IngestPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ name: string; format: string; testsGenerated: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchSession = useCallback(() => {
    sessionsApi.get(sessionId)
      .then(setSession)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load session", "error"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  async function handleFiles(files: FileList | File[]) {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const result = await ingest.upload(sessionId, fileArr);
      const docs = (result.documents as Array<{ name: string; format: string; testsGenerated?: number }>) ?? [];
      setUploadedDocs((prev) => [
        ...prev,
        ...docs.map((d) => ({ name: d.name, format: d.format, testsGenerated: d.testsGenerated ?? 0 })),
      ]);
      fetchSession();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Upload Documents</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)}>
          Back to Session
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-error-container text-error rounded-md text-sm">{error}</div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary-light/30" : "border-border bg-surface hover:bg-surface-dim"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <svg className="mx-auto w-10 h-10 text-on-surface-variant mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-on-surface">
          {uploading ? "Uploading..." : "Drop files here or click to browse"}
        </p>
        <p className="text-xs text-on-surface-variant mt-1">
          Accepted: PDF, DOCX, TXT, Markdown
        </p>
      </div>

      {/* Uploaded documents */}
      {uploadedDocs.length > 0 && (
        <div className="bg-surface rounded-lg border border-border-light">
          <div className="px-4 py-3 border-b border-border-light">
            <h2 className="font-display font-semibold text-sm text-foreground">Uploaded Documents</h2>
          </div>
          <div className="divide-y divide-border-light">
            {uploadedDocs.map((doc, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-on-surface">{doc.name}</span>
                  <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">{doc.format}</span>
                </div>
                <span className="text-xs text-on-surface-variant">{doc.testsGenerated} tests generated</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session && session.status !== "INGESTION" && (
        <div className="text-sm text-on-surface-variant">
          <StatusBadge status={session.status} /> — Documents already ingested.
        </div>
      )}
    </div>
  );
}
