import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createCongregant, updateCongregant, type CongregationMember, type Gender } from "../../api";
import { Modal, useToast } from "../dialogs";
import Button from "../ui/Button";
import { CheckThinIcon } from "../ui/shellIcons";

const OTHER = "__other__";

/** Whole years from a "yyyy-MM-dd" birthday to today; null if there's no usable date. */
export function ageFrom(birthday: string | null | undefined): number | null {
  if (!birthday) return null;
  const [y, m, d] = birthday.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

/** Distinct values, trimmed and de-duplicated ignoring case (first spelling wins), sorted. */
export function distinctCategories(values: (string | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const t = v?.trim();
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

interface ChoiceOption {
  value: string;
  label: string;
}

/** Pill radio chips (role="radiogroup"). Arrow keys move between them; with `allowNone`,
 * clicking the selected chip clears it. */
function ChoiceChips({
  label,
  options,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  options: ChoiceOption[];
  value: string;
  /** `via` says whether a click/tap or the arrow keys made the change. */
  onChange: (v: string, via: "click" | "key") => void;
  allowNone?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const labelId = useId();

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    onChange(options[next].value, "key");
    refs.current[next]?.focus();
  };

  return (
    <div className="cg-field">
      <span className="cg-label" id={labelId}>
        {label}
      </span>
      <div className="cg-choices" role="radiogroup" aria-labelledby={labelId}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (selectedIndex === -1 && i === 0) ? 0 : -1}
              className="cg-choice"
              onClick={() => onChange(on && allowNone ? "" : o.value, "click")}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {on && <CheckThinIcon strokeWidth={2.6} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CategoryState {
  /** An existing option, OTHER, or "" for none. */
  choice: string;
  other: string;
}

function initialCategory(value: string | null | undefined, options: string[]): CategoryState {
  const v = value?.trim();
  if (!v) return { choice: "", other: "" };
  const match = options.find((o) => o.toLowerCase() === v.toLowerCase());
  return match ? { choice: match, other: "" } : { choice: OTHER, other: v };
}

/** The value to save: an existing option as-is, or the typed "Other" value — snapped to an
 * existing option\x27s spelling if it only differs in case ("children" → "Children"). */
function resolveCategory(state: CategoryState, options: string[]): string | null {
  if (state.choice !== OTHER) return state.choice || null;
  const typed = state.other.trim();
  if (!typed) return null;
  return options.find((o) => o.toLowerCase() === typed.toLowerCase()) ?? typed;
}

function CategoryChoice({
  label,
  options,
  state,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  state: CategoryState;
  onChange: (s: CategoryState) => void;
  placeholder: string;
}) {
  const otherRef = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <div className="cg-category">
      <ChoiceChips
        label={label}
        options={[...options.map((o) => ({ value: o, label: o })), { value: OTHER, label: "Other…" }]}
        value={state.choice}
        allowNone
        onChange={(choice, via) => {
          onChange({ ...state, choice });
          // Clicking "Other…" goes straight to typing; arrowing past it keeps moving through the chips.
          if (choice === OTHER && via === "click") requestAnimationFrame(() => otherRef.current?.focus());
        }}
      />
      {state.choice === OTHER && (
        <div className="cg-other">
          <label className="sr-only" htmlFor={id}>
            {label} — new value
          </label>
          <input
            id={id}
            ref={otherRef}
            className="cg-input"
            value={state.other}
            onChange={(e) => onChange({ ...state, other: e.target.value })}
            placeholder={placeholder}
            maxLength={60}
          />
        </div>
      )}
    </div>
  );
}

interface CongregantModalProps {
  open: boolean;
  editing: CongregationMember | null;
  oldOptions: string[];
  newOptions: string[];
  onClose: () => void;
  onSaved: (member: CongregationMember | null) => void;
}

const emptyForm = { firstName: "", middleName: "", lastName: "", nickname: "", birthday: "", gender: "" as "" | Gender };

/** Add to congregation / Edit person — Name, About and Category sections. */
function CongregantModal({ open, editing, oldOptions, newOptions, onClose, onSaved }: CongregantModalProps) {
  const toast = useToast();
  const uid = useId();
  const [form, setForm] = useState(emptyForm);
  const [oldCat, setOldCat] = useState<CategoryState>({ choice: "", other: "" });
  const [newCat, setNewCat] = useState<CategoryState>({ choice: "", other: "" });
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            firstName: editing.firstName,
            middleName: editing.middleName ?? "",
            lastName: editing.lastName,
            nickname: editing.nickname ?? "",
            birthday: editing.birthday ? editing.birthday.slice(0, 10) : "",
            gender: editing.gender ?? "",
          }
        : emptyForm,
    );
    setOldCat(initialCategory(editing?.oldCategory, oldOptions));
    setNewCat(initialCategory(editing?.newCategory, newOptions));
    setErrors({});
    setFormError(null);
    // Options only seed the form when it opens; they don\x27t change while it\x27s open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
    if (key === "firstName" || key === "lastName") setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async () => {
    const found: typeof errors = {};
    if (!form.firstName.trim()) found.firstName = "Enter a first name.";
    if (!form.lastName.trim()) found.lastName = "Enter a last name.";
    setErrors(found);
    if (found.firstName) return firstRef.current?.focus();
    if (found.lastName) return lastRef.current?.focus();

    setSaving(true);
    setFormError(null);
    const payload = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || null,
      lastName: form.lastName.trim(),
      nickname: form.nickname.trim() || null,
      birthday: form.birthday || null,
      gender: form.gender || null,
      oldCategory: resolveCategory(oldCat, oldOptions),
      newCategory: resolveCategory(newCat, newOptions),
    };
    try {
      if (editing) {
        const saved = await updateCongregant(editing.id, payload);
        toast.show({ type: "success", title: "Changes saved" });
        onSaved(saved);
      } else {
        const saved = await createCongregant(payload);
        toast.show({ type: "success", title: `${payload.firstName} added to the congregation` });
        onSaved(saved);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const age = ageFrom(form.birthday);

  const text = (
    key: "firstName" | "lastName" | "middleName" | "nickname",
    label: string,
    opts: { optional?: boolean; ref?: React.Ref<HTMLInputElement>; autoComplete?: string } = {},
  ) => {
    const id = `${uid}-${key}`;
    const error = key === "firstName" || key === "lastName" ? errors[key] : undefined;
    return (
      <div className="cg-field">
        <label className="cg-label" htmlFor={id}>
          {label}
          {opts.optional && <span className="cg-label-hint"> · optional</span>}
        </label>
        <input
          id={id}
          ref={opts.ref}
          className="cg-input"
          value={form[key]}
          onChange={set(key)}
          autoComplete={opts.autoComplete ?? "off"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error && (
          <p id={`${id}-error`} className="cg-error">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      size="lg"
      title={editing ? "Edit person" : "Add to congregation"}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add person"}
          </Button>
        </>
      }
    >
      <section className="cg-section" aria-labelledby={`${uid}-s-name`}>
        <h3 className="cg-section-label" id={`${uid}-s-name`}>
          Name
        </h3>
        <div className="cg-grid">
          {text("firstName", "First name", { ref: firstRef, autoComplete: "given-name" })}
          {text("lastName", "Last name", { ref: lastRef, autoComplete: "family-name" })}
          {text("middleName", "Middle name", { optional: true, autoComplete: "additional-name" })}
          {text("nickname", "Nickname", { optional: true })}
        </div>
      </section>

      <section className="cg-section" aria-labelledby={`${uid}-s-about`}>
        <h3 className="cg-section-label" id={`${uid}-s-about`}>
          About
        </h3>
        <ChoiceChips
          label="Gender"
          options={[
            { value: "Female", label: "Female" },
            { value: "Male", label: "Male" },
            { value: "", label: "Not specified" },
          ]}
          value={form.gender}
          onChange={(gender) => setForm((f) => ({ ...f, gender: gender as "" | Gender }))}
        />
        <div className="cg-field cg-field--half">
          <label className="cg-label" htmlFor={`${uid}-birthday`}>
            Birthday<span className="cg-label-hint"> · optional</span>
          </label>
          <input
            id={`${uid}-birthday`}
            type="date"
            className="cg-input"
            value={form.birthday}
            onChange={set("birthday")}
            aria-describedby={age !== null ? `${uid}-age` : undefined}
          />
          {age !== null && (
            <p id={`${uid}-age`} className="cg-age">
              Age {age}
            </p>
          )}
        </div>
      </section>

      <section className="cg-section" aria-labelledby={`${uid}-s-cat`}>
        <h3 className="cg-section-label" id={`${uid}-s-cat`}>
          Category
        </h3>
        <CategoryChoice label="Old category" options={oldOptions} state={oldCat} onChange={setOldCat} placeholder="e.g. Men" />
        <CategoryChoice label="New category" options={newOptions} state={newCat} onChange={setNewCat} placeholder="e.g. Adult" />
      </section>

      {formError && (
        <p className="cg-error" role="alert">
          {formError}
        </p>
      )}
    </Modal>
  );
}

export default CongregantModal;
