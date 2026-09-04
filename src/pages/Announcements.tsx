import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  type Announcement,
} from "../api";
import {
  AppShell,
  Button,
  Card,
  ListRow,
  ProfileMenu,
  SkeletonListRow,
  TextField,
} from "../components/ui";

const ASPECT_RATIO = 16 / 9;
const ASPECT_TOLERANCE = 0.02;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function readImageFile(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return Promise.reject(new Error(`Image must be smaller than 15MB (yours is ${mb}MB).`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the image file."));
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (Math.abs(ratio - ASPECT_RATIO) > ASPECT_TOLERANCE) {
          reject(
            new Error(
              `Image must have a 16:9 aspect ratio (yours is ${img.naturalWidth}×${img.naturalHeight}).`,
            ),
          );
          return;
        }
        resolve(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eyebrow, setEyebrow] = useState("");
  const [title, setTitle] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      setAnnouncements(await getAnnouncements());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    try {
      setImageDataUrl(await readImageFile(file));
    } catch (err) {
      setImageDataUrl(null);
      setImageError(err instanceof Error ? err.message : "Failed to read image");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setEyebrow("");
    setTitle("");
    setImageDataUrl(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createAnnouncement({ eyebrow, title, imageDataUrl });
      resetForm();
      await loadAnnouncements();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAnnouncement(id);
      await loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete announcement");
    }
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Announcements</h1>
      </div>

      <div className="page-sections">
        <Card>
          <h2 className="section-title">Add an announcement</h2>
          <form onSubmit={handleSubmit} className="user-form">
            <TextField
              label="Eyebrow (optional)"
              type="text"
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder="REVIVAL: A CALL TO"
            />
            <TextField
              label="Title (optional)"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ABSOLUTE OBEDIENCE"
            />

            <label className="ui-field image-upload">
              <span className="ui-field-label">Image (16:9)</span>
              <div className="image-upload-preview">
                {imageDataUrl ? (
                  <img src={imageDataUrl} alt="Announcement preview" />
                ) : (
                  <span>No image selected</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
              />
              {imageError && <p className="error">{imageError}</p>}
            </label>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Announcement"}
            </Button>
            {formError && <p className="error">{formError}</p>}
          </form>
        </Card>

        <Card>
          <h2 className="section-title">Current announcements</h2>
          {loading && (
            <ul className="ui-list">
              <SkeletonListRow withThumbnail />
              <SkeletonListRow withThumbnail />
              <SkeletonListRow withThumbnail />
            </ul>
          )}
          {error && <p className="error">{error}</p>}
          {!loading && !error && announcements.length === 0 && (
            <p className="helper-text">No announcements yet.</p>
          )}
          {!loading && !error && announcements.length > 0 && (
            <ul className="ui-list">
              {announcements.map((a) => (
                <ListRow
                  key={a.id}
                  thumbnail={a.imageDataUrl ? <img src={a.imageDataUrl} alt="" /> : undefined}
                  primary={a.title ?? a.eyebrow ?? "(no text)"}
                  secondary={a.title ? a.eyebrow : null}
                  actions={
                    <Button
                      type="button"
                      variant="danger"
                      className="!px-[0.7rem] !py-[0.35rem] !text-[0.75rem]"
                      onClick={() => handleDelete(a.id)}
                    >
                      Delete
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default Announcements;
