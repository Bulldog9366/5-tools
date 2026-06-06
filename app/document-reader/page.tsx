"use client";

import React, { useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import mammoth from "mammoth";

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

const PDFJS_VERSION = "4.10.38";

export default function DocumentReaderPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [progress, setProgress] = useState(0);
  const [isReading, setIsReading] = useState(false);

  const canRead = useMemo(() => !!file && !isReading, [file, isReading]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(selected);
    setDocumentText("");
    setProgress(0);

    if (!selected) {
      setPreviewUrl("");
      setStatus("Ready");
      return;
    }

    setStatus(`Loaded: ${selected.name}`);

    if (selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl("");
    }
  }

  function clearReader() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(null);
    setPreviewUrl("");
    setDocumentText("");
    setProgress(0);
    setStatus("Ready");
  }

  function fileToDataUrl(fileToRead: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Could not read file."));
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(fileToRead);
    });
  }

  async function loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[data-pdfjs-version="${PDFJS_VERSION}"]`
      );

      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("PDF.js failed to load."))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
      script.type = "module";
      script.dataset.pdfjsVersion = PDFJS_VERSION;

      script.onload = () => resolve();
      script.onerror = () => reject(new Error("PDF.js failed to load."));

      document.head.appendChild(script);
    });

    if (!window.pdfjsLib) {
      throw new Error("PDF.js loaded but was not available.");
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

    return window.pdfjsLib;
  }

  async function runImageOCR(imageSource: string) {
    const worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status) setStatus(m.status);
        if (typeof m.progress === "number") {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });

    try {
      const result = await worker.recognize(imageSource);
      return result.data.text || "";
    } finally {
      await worker.terminate();
    }
  }

  async function readImageFile(selectedFile: File) {
    setStatus("Preparing image...");
    const imageDataUrl = await fileToDataUrl(selectedFile);

    setStatus("Running OCR on image...");
    const text = await runImageOCR(imageDataUrl);

    setDocumentText(text.trim());
    setProgress(100);
    setStatus("Image OCR complete");
  }

  async function readWordDocument(selectedFile: File) {
    setStatus("Reading Word document...");

    const arrayBuffer = await selectedFile.arrayBuffer();

    const result = await mammoth.extractRawText({
      arrayBuffer,
    });

    setDocumentText((result.value || "").trim());
    setProgress(100);
    setStatus("Word document extraction complete");
  }

  async function readPdfDocument(selectedFile: File) {
    setStatus("Loading PDF system...");

    const pdfjsLib = await loadPdfJs();

    setStatus("Loading PDF...");

    const arrayBuffer = await selectedFile.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    let combinedText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      setStatus(`Extracting PDF text page ${pageNum}/${pdf.numPages}`);
      setProgress(Math.round((pageNum / pdf.numPages) * 45));

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      combinedText += `\n\n--- PAGE ${pageNum} ---\n\n${pageText}`;
    }

    if (combinedText.replace(/\s/g, "").length > 50) {
      setDocumentText(combinedText.trim());
      setProgress(100);
      setStatus("PDF text extraction complete");
      return;
    }

    combinedText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      setStatus(`OCR PDF page ${pageNum}/${pdf.numPages}`);
      setProgress(45 + Math.round((pageNum / pdf.numPages) * 50));

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        combinedText += `\n\n--- PAGE ${pageNum} ---\n\nUnable to render page.`;
        continue;
      }

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const imageData = canvas.toDataURL("image/png");
      const pageText = await runImageOCR(imageData);

      combinedText += `\n\n--- PAGE ${pageNum} ---\n\n${pageText}`;
    }

    setDocumentText(combinedText.trim());
    setProgress(100);
    setStatus("PDF OCR complete");
  }

  async function processDocument() {
    if (!file) return;

    setIsReading(true);
    setProgress(0);
    setDocumentText("");

    try {
      const fileName = file.name.toLowerCase();
      const fileType = file.type;

      if (fileType.startsWith("image/")) {
        await readImageFile(file);
      } else if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        await readPdfDocument(file);
      } else if (
        fileType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".docx")
      ) {
        await readWordDocument(file);
      } else {
        setStatus("Unsupported file type. Use PNG, JPG, WEBP, PDF, or DOCX.");
      }
    } catch (error) {
      console.error(error);
      setStatus("Document processing failed. Try another file or clearer scan.");
    } finally {
      setIsReading(false);
    }
  }

  async function copyText() {
    if (!documentText) return;

    await navigator.clipboard.writeText(documentText);
    setStatus("Text copied");
  }

  function downloadText() {
    if (!documentText) return;

    const blob = new Blob([documentText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "document-reader-output.txt";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#ece8df] text-[#111111]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 rounded-2xl bg-[#111111] p-6 text-white shadow">
          <p className="text-sm uppercase tracking-[0.25em] text-[#c9a227]">
            5 Tools
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Document Reader</h1>
              <p className="mt-2 max-w-3xl text-sm text-neutral-300">
                Read images, PDFs, and Word documents. OCR automatically runs
                when needed.
              </p>
            </div>

            <a
              href="/"
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Back to Dashboard
            </a>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-[#d8d2c4] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Upload Document</h2>

            <p className="mt-2 text-sm text-neutral-600">
              Supported: PNG, JPG, JPEG, WEBP, PDF, DOCX
            </p>

            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.docx"
              onChange={handleFileChange}
              disabled={isReading}
              className="mt-4 block w-full rounded-xl border border-[#d8d2c4] bg-[#f8f6f1] p-3 text-sm disabled:opacity-50"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={processDocument}
                disabled={!canRead}
                className="rounded-xl bg-[#111111] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isReading ? "Processing..." : "Read Document"}
              </button>

              <button
                onClick={clearReader}
                disabled={isReading}
                className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-3 font-semibold text-[#111111] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-[#f8f6f1] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span>Status</span>
                <span>{progress}%</span>
              </div>

              <p className="mt-1 break-words font-medium">{status}</p>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#d8d2c4]">
                <div
                  className="h-full bg-[#c9a227] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {previewUrl && (
              <div className="mt-5">
                <h3 className="mb-2 font-semibold">Preview</h3>

                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="max-h-[480px] w-full rounded-xl border border-[#d8d2c4] object-contain"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#d8d2c4] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Extracted Text</h2>

                <p className="mt-1 text-sm text-neutral-600">
                  Review, clean up, copy, or download extracted document text.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyText}
                  disabled={!documentText}
                  className="rounded-xl border border-[#d8d2c4] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Copy
                </button>

                <button
                  onClick={downloadText}
                  disabled={!documentText}
                  className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Download TXT
                </button>
              </div>
            </div>

            <textarea
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              placeholder="Document text will appear here..."
              className="mt-4 min-h-[620px] w-full rounded-xl border border-[#d8d2c4] bg-[#f8f6f1] p-4 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-[#c9a227]"
            />
          </div>
        </section>
      </div>
    </main>
  );
}