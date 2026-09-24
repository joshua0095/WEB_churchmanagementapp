import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button, Modal } from "./ui";
import { CameraIcon } from "./ui/shellIcons";
import { cropImageToDataUrl } from "../utils/imageCompression";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
/** "navy" (default) matches every existing avatar across the app (worker/congregation
 * lists, leader pickers, etc.) — "gold"/"cream" are only for the shell's own avatars
 * (sidebar user card, account button, profile hero) and never change that default. */
type AvatarTone = "navy" | "gold" | "cream";

const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-xs",
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
  xl: "h-28 w-28 text-4xl",
};

const AVATAR_TONE_CLASSES: Record<AvatarTone, string> = {
  navy: "bg-[var(--color-navy)] text-white",
  gold: "bg-[var(--color-gold)] text-[var(--color-text-on-gold)]",
  cream: "bg-[var(--color-bg)] text-[var(--color-text-primary)]",
};

export function InitialAvatar({
  name,
  photoUrl,
  size = "sm",
  tone = "navy",
  serif = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: AvatarSize;
  tone?: AvatarTone;
  /** Fraunces instead of the default sans — only used for the large profile-hero avatar. */
  serif?: boolean;
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
      className={`flex ${sizeClasses} shrink-0 items-center justify-center rounded-full font-bold ${AVATAR_TONE_CLASSES[tone]} ${serif ? "font-display" : ""}`}
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
 * image's own pixel coordinates. A "Replace photo" control lets them swap in a different file
 * without leaving the modal, re-seeding the cropper from scratch. */
function PhotoCropModal({ file: initialFile, onCancel, onSave }: PhotoCropModalProps) {
  const [file, setFile] = useState(initialFile);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Creating the object URL here (rather than in a useState initializer) and revoking
  // exactly the URL this effect run created keeps mount/cleanup symmetric — with StrictMode's
  // dev-mode mount->cleanup->remount cycle, a URL created outside the effect gets revoked by
  // the first cleanup while the image is still loading it, breaking the image permanently.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleReplace = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0];
    e.target.value = "";
    if (!next) return;

    if (!next.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setFile(next);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

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
          <Button
            type="button"
            variant="secondary"
            onClick={() => replaceInputRef.current?.click()}
            disabled={saving}
          >
            Replace photo
          </Button>
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
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleReplace}
        />
        {error && <p className="error text-xs">{error}</p>}
      </div>
    </Modal>
  );
}

/** Shared file-pick + crop flow behind both PhotoPicker and EditableAvatar, so the two
 * presentations (button row vs. inline badge) don't duplicate the crop-modal wiring.
 *
 * When `existingPhotoUrl` is passed and set, `openPicker` skips the native file dialog and
 * jumps straight into the crop modal seeded from that photo — the modal's own "Replace photo"
 * control is how the person swaps in a different file from there. With no existing photo (or
 * the argument omitted), it opens the native file dialog since there's nothing yet to crop. */
function usePhotoUpload(onChange: (dataUrl: string | null) => void, existingPhotoUrl?: string | null) {
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

  const openPicker = async () => {
    if (!existingPhotoUrl) {
      inputRef.current?.click();
      return;
    }
    try {
      const blob = await (await fetch(existingPhotoUrl)).blob();
      setError(null);
      setPendingFile(new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
    } catch {
      setError("Couldn't load your current photo.");
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={handleFileChange}
    />
  );

  const cropModal = pendingFile && (
    <PhotoCropModal
      file={pendingFile}
      onCancel={() => setPendingFile(null)}
      onSave={(dataUrl) => {
        onChange(dataUrl);
        setPendingFile(null);
      }}
    />
  );

  return { error, openPicker, fileInput, cropModal };
}

interface PhotoPickerProps {
  name: string;
  photoUrl: string | null;
  onChange: (dataUrl: string | null) => void;
}

/** Avatar preview plus an upload/remove control. When a photo is already set, "Change photo"
 * jumps straight into PhotoCropModal seeded from it (Replace photo inside swaps the file);
 * otherwise it opens the native file dialog first. Either way the result is downscaled and
 * re-encoded client-side (see cropImageToDataUrl) and handed to `onChange` — this app stores
 * photos as data URLs rather than uploading them anywhere. */
export function PhotoPicker({ name, photoUrl, onChange }: PhotoPickerProps) {
  const { error, openPicker, fileInput, cropModal } = usePhotoUpload(onChange, photoUrl);

  return (
    <div className="flex items-center gap-4">
      <InitialAvatar name={name} photoUrl={photoUrl} size="lg" />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={openPicker}>
            {photoUrl ? "Change photo" : "Upload photo"}
          </Button>
          {photoUrl && (
            <Button type="button" variant="secondary" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        {fileInput}
        {error && <p className="error text-xs">{error}</p>}
      </div>
      {cropModal}
    </div>
  );
}

interface EditableAvatarProps {
  name: string;
  photoUrl: string | null;
  onChange: (dataUrl: string | null) => void;
  size?: AvatarSize;
  tone?: AvatarTone;
  /** Fraunces initials — passed straight through to InitialAvatar (see there). */
  serif?: boolean;
}

/** Avatar with the edit affordance built into the image itself: a bordered ring plus a
 * camera badge (and, once a photo is set, a small remove badge) instead of separate
 * upload/remove buttons — for places like the profile hero where the avatar IS the control. */
export function EditableAvatar({ name, photoUrl, onChange, size = "lg", tone, serif }: EditableAvatarProps) {
  const { error, openPicker, fileInput, cropModal } = usePhotoUpload(onChange, photoUrl);

  return (
    <div className="flex flex-col gap-1">
      <div className={`avatar-editor avatar-editor--${size}`}>
        <div className="avatar-editor-ring">
          <InitialAvatar name={name} photoUrl={photoUrl} size={size} tone={tone} serif={serif} />
        </div>
        <button
          type="button"
          className="avatar-editor-edit"
          onClick={openPicker}
          aria-label={photoUrl ? "Change photo" : "Upload photo"}
        >
          <CameraIcon />
        </button>
        {photoUrl && (
          <button type="button" className="avatar-editor-remove" onClick={() => onChange(null)} aria-label="Remove photo">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {fileInput}
      </div>
      {error && <p className="error text-xs">{error}</p>}
      {cropModal}
    </div>
  );
}

export function formatBirthday(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
