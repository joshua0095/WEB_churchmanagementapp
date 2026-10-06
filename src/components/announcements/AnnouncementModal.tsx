import { useEffect, useState, type FormEvent } from "react";
import { createAnnouncement, sendAnnouncement, updateAnnouncement, type Announcement } from "../../api";
import { Modal, useToast } from "../dialogs";
import Button from "../ui/Button";
import Switch from "../ui/Switch";
import { AnnouncementCover, AnnouncementSlide, parseEventDate } from "./HomeCards";
import ImageDropZone from "./ImageDropZone";
import { prepareAnnouncementImage } from "./imageFiles";

interface AnnouncementModalProps {
  open: boolean;
  onClose: () => void;
  /** The announcement being edited, or null for a new one. */
  editing: Announcement | null;
  /** Sending is admin-only on the server, so only admins get the "Send to members" switch. */
  canSend: boolean;
  onSaved: () => void;
}

const FORM_ID = "announcement-form";

/** New / Edit announcement: fields on the left, a live "Preview on Home" on the right (below
 * the fields on the mobile sheet). */
function AnnouncementModal({ open, onClose, editing, canSend, onSaved }: AnnouncementModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  /** "yyyy-MM-dd" from the date input, or "" for none. */
  const [eventDate, setEventDate] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [sendOnPost, setSendOnPost] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fresh form each time it opens (prefilled when editing).
  useEffect(() => {
    if (!open) return;
    // The eyebrow line is gone; an older announcement that only had one keeps it as its title.
    setTitle(editing?.title ?? editing?.eyebrow ?? "");
    setContent(editing?.content ?? "");
    setEventDate(editing?.eventDate ?? "");
    setImageDataUrl(editing?.imageDataUrl ?? null);
    setImageError(null);
    setFormError(null);
    setSendOnPost(true);
  }, [open, editing]);

  const pickImage = async (file: File) => {
    setImageError(null);
    setImageBusy(true);
    try {
      setImageDataUrl(await prepareAnnouncementImage(file));
      setFormError(null);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Couldn't read that image.");
    } finally {
      setImageBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !imageDataUrl) {
      setFormError("Add at least a title or an image.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const request = { eyebrow: null, title, content, imageDataUrl, eventDate: eventDate || null };
    try {
      if (editing) {
        await updateAnnouncement(editing.id, request);
        toast.show({ type: "success", title: "Announcement updated" });
      } else {
        const created = await createAnnouncement(request);
        const send = canSend && sendOnPost;
        let sent = false;
        if (send) {
          try {
            sent = (await sendAnnouncement(created.id)).sentCount > 0;
          } catch {
            // Posted fine; only the email failed — say so and let them use "Send to members" later.
          }
        }
        if (send && !sent) {
          toast.show({
            type: "warning",
            title: "Announcement posted",
            message: "It couldn't be sent to members. Try “Send to members” on its card.",
          });
        } else {
          toast.show({ type: "success", title: sent ? "Announcement posted and sent to members" : "Announcement posted" });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save the announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || imageBusy;
  const isEmpty = !title.trim() && !content.trim() && !eventDate && !imageDataUrl;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="xl"
      title={editing ? "Edit announcement" : "New announcement"}
      bodyClassName="ann-split"
      footer={
        <div className="ann-modal-footer">
          {canSend && !editing ? (
            <label className="ann-switch-row">
              <Switch checked={sendOnPost} onChange={setSendOnPost} aria-label="Send to members when posted" />
              <span aria-hidden="true">Send to members when posted</span>
            </label>
          ) : (
            <span />
          )}
          <div className="ann-modal-footer-buttons">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} disabled={busy}>
              {submitting ? (editing ? "Saving…" : "Posting…") : editing ? "Save changes" : "Post announcement"}
            </Button>
          </div>
        </div>
      }
    >
      <form id={FORM_ID} className="ann-split-fields" onSubmit={handleSubmit} noValidate>
        <div className="ann-field">
          <label className="ann-label" htmlFor="ann-image">
            Image <span className="ann-label-hint">· optional, 16:9</span>
          </label>
          <ImageDropZone
            id="ann-image"
            src={imageDataUrl}
            alt="Announcement image"
            busy={imageBusy}
            error={imageError}
            onPick={pickImage}
            onRemove={() => setImageDataUrl(null)}
          />
        </div>

        <div className="ann-field">
          <label className="ann-label" htmlFor="ann-title">
            Title <span className="ann-label-hint">· optional</span>
          </label>
          <input
            id="ann-title"
            className="ann-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) setFormError(null);
            }}
            placeholder="e.g. Absolute Obedience"
            aria-invalid={formError ? true : undefined}
            aria-describedby="ann-form-hint"
          />
        </div>

        <div className="ann-field">
          <label className="ann-label" htmlFor="ann-content">
            Details <span className="ann-label-hint">· optional</span>
          </label>
          <textarea
            id="ann-content"
            className="ann-input ann-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What should members know? Time, place, what to bring…"
          />
        </div>

        <div className="ann-field">
          <label className="ann-label" htmlFor="ann-date">
            Date <span className="ann-label-hint">· optional</span>
          </label>
          <input
            id="ann-date"
            type="date"
            className="ann-input ann-input--date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            aria-describedby="ann-date-hint"
          />
          <p id="ann-date-hint" className="ann-hint">
            The day it's for. It's removed automatically the day after this date.
          </p>
        </div>

        <p id="ann-form-hint" className={formError ? "ann-field-error" : "ann-hint"} role={formError ? "alert" : undefined}>
          {formError ?? "Add at least a title or an image."}
        </p>
      </form>

      <aside className="ann-split-preview" aria-label="Preview on Home">
        <p className="ann-preview-label">Preview on Home</p>
        <div
          className={[
            "home-card home-announce ann-preview-card",
            isEmpty && "ann-preview-card--sample",
            imageDataUrl && "home-announce--image",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          {imageDataUrl && <AnnouncementCover src={imageDataUrl} alt="" />}
          <div className="home-announce-head">
            <p className="home-eyebrow">Church announcements</p>
            <span className="home-link home-link--static">View all</span>
          </div>
          <div className="home-announce-body">
            {!isEmpty ? (
              <AnnouncementSlide date={parseEventDate(eventDate || null)} title={title.trim() || null} content={content.trim() || null} />
            ) : (
              <AnnouncementSlide
                date={new Date()}
                title="Absolute Obedience"
                content="Details to include in the announcement show here, two lines at most…"
              />
            )}
          </div>
        </div>
        <p className="ann-preview-note">If you add an image, it fills the card. Members hover over it (or tap it on a phone) to see the details and controls.</p>
      </aside>
    </Modal>
  );
}

export default AnnouncementModal;
