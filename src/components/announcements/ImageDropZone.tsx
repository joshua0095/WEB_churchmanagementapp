import { useRef, useState, type DragEvent } from "react";
import { TrashLineIcon, UploadIcon } from "./icons";

interface ImageDropZoneProps {
  /** The chosen image (data/object URL or an existing poster's URL), or null for the empty drop zone. */
  src: string | null;
  alt: string;
  onPick: (file: File) => void;
  onRemove: () => void;
  /** Shown under the zone while a picked file is being read/compressed. */
  busy?: boolean;
  error?: string | null;
  /** Lets a <label> elsewhere name the browse button. */
  id?: string;
}

/** 16:9 dashed drop zone replacing the native "Choose File" input: drag an image in or browse.
 * Once picked it shows the image with Replace / Remove. */
function ImageDropZone({ src, alt, onPick, onRemove, busy, error, id }: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const browse = () => inputRef.current?.click();

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onPick(file);
  };

  const dragProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop,
  };

  return (
    <div className="ann-drop-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />

      {src ? (
        <>
          <div className={["ann-drop-preview", dragging && "ann-drop--dragging"].filter(Boolean).join(" ")} {...dragProps}>
            <img src={src} alt={alt} />
          </div>
          <div className="ann-drop-actions">
            <button type="button" id={id} className="ann-btn ann-btn--outline ann-btn--sm" onClick={browse} disabled={busy}>
              <UploadIcon />
              Replace image
            </button>
            <button type="button" className="ann-text-danger" onClick={onRemove} disabled={busy}>
              <TrashLineIcon />
              Remove
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          id={id}
          className={["ann-drop", dragging && "ann-drop--dragging"].filter(Boolean).join(" ")}
          onClick={browse}
          disabled={busy}
          {...dragProps}
        >
          <span className="ann-drop-icon" aria-hidden="true">
            <UploadIcon />
          </span>
          <span className="ann-drop-title">
            {busy ? (
              "Preparing image…"
            ) : (
              <>
                Drag an image here or <span className="ann-drop-link">browse</span>
              </>
            )}
          </span>
          <span className="ann-drop-hint">JPG or PNG · a 1920×1080 poster works best</span>
        </button>
      )}

      {error && (
        <p className="ann-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default ImageDropZone;
