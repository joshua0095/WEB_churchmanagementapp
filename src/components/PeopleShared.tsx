import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button, Modal } from "./ui";
import { cropImageToDataUrl } from "../utils/imageCompression";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-xs",
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
};

export function InitialAvatar({
  name,
  photoUrl,
  size = "sm",
}: {
  name: string;
  photoUrl?: string | null;
  size?: AvatarSize;
}) {
  const sizeClasses = AVATAR_SIZE_CLASSES[size];

  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sizeClasses} shrink-0 rounded-full object-cover`} />;
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

  return (
    <span
      className={`flex ${sizeClasses} shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] font-bold text-white`}
    >
      {initials || "?"}
    </span>
  );
}

interface PhotoCropModalProps {
  file: File;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}

/** Lets the person pan/zoom a round crop box over the photo they picked before it's saved,
 * instead of silently center-cropping whatever they uploaded. Confirms into a compressed data
 * URL via cropImageToDataUrl, using the crop rectangle react-easy-crop reports in the original
 * image's own pixel coordinates. */
function PhotoCropModal({ file, onCancel, onSave }: PhotoCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Creating the object URL here (rather than in a useState initializer) and revoking
  // exactly the URL this effect run created keeps mount/cleanup symmetric — with StrictMode's
  // dev-mode mount->cleanup->remount cycle, a URL created outside the effect gets revoked by
  // the first cleanup while the image is still loading it, breaking the image permanently.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      onSave(await cropImageToDataUrl(file, croppedAreaPixels));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process that image");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Crop photo"
      closeOnBackdropClick={false}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !croppedAreaPixels}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative h-72 w-full overflow-hidden rounded-md bg-black/5">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            />
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        {error && <p className="error text-xs">{error}</p>}
      </div>
    </Modal>
  );
}

interface PhotoPickerProps {
  name: string;
  photoUrl: string | null;
  onChange: (dataUrl: string | null) => void;
}

/** Avatar preview plus an upload/remove control. Picking a file opens PhotoCropModal so the
 * person can frame it before it's downscaled and re-encoded client-side (see
 * cropImageToDataUrl) and handed to `onChange` — this app stores photos as data URLs rather
 * than uploading them anywhere. */
export function PhotoPicker({ name, photoUrl, onChange }: PhotoPickerProps) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setPendingFile(file);
  };

  return (
    <div className="flex items-center gap-4">
      <InitialAvatar name={name} photoUrl={photoUrl} size="lg" />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            {photoUrl ? "Change photo" : "Upload photo"}
          </Button>
          {photoUrl && (
            <Button type="button" variant="secondary" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <p className="error text-xs">{error}</p>}
      </div>
      {pendingFile && (
        <PhotoCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onSave={(dataUrl) => {
            onChange(dataUrl);
            setPendingFile(null);
          }}
        />
      )}
    </div>
  );
}

export function formatBirthday(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
