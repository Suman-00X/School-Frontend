import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@/common/ui";
import "./certificates.css";

/* A certificate's HTML on screen, scaled to the panel's width. The frame runs no scripts
   (sandbox without allow-scripts) and is same-origin only so its height can be measured. */

/* An A4 page is 210 mm wide (794 CSS px) plus the screen margin the formats add */
const PAGE_WIDTH = 794 + 32;

export function CertificatePreview({ html, loading, empty, error }: { html: string | null; loading?: boolean; empty?: ReactNode; error?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(1123 + 32);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (doc?.documentElement) setHeight(Math.max(doc.documentElement.scrollHeight, 400));
  };

  const scale = width ? Math.min(1, width / PAGE_WIDTH) : 0;

  return (
    <div ref={box} className="cert-preview">
      {error && <div className="cert-preview-error">{error}</div>}
      {html === null ? (
        <div className="cert-preview-empty">{loading ? <Spinner /> : empty}</div>
      ) : (
        scale > 0 && (
          <div style={{ height: height * scale, position: "relative" }}>
            {loading && (
              <div className="cert-preview-busy">
                <Spinner />
              </div>
            )}
            <iframe
              ref={frame}
              title="Certificate preview"
              sandbox="allow-same-origin"
              srcDoc={html}
              onLoad={measure}
              style={{ width: PAGE_WIDTH, height, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, display: "block" }}
            />
          </div>
        )
      )}
    </div>
  );
}
