import { useState } from "react";
import { QuickLoginError } from "../api";
import PinPad from "./PinPad";

interface PinSetupFlowProps {
  /**
   * "create": choose a new code, then enter it again to confirm.
   * "verify": enter the existing code (e.g. to remember another device).
   */
  mode: "create" | "verify";
  /** Does the API call. Throw to show the error and let them retry. */
  onSubmit: (pin: string) => Promise<void>;
  /** Optional heading overrides for the first step. */
  createTitle?: string;
}

/** 0000, 1111… and runs like 1234 / 9876 — the first codes anyone would try. */
function isTooEasy(pin: string): boolean {
  const d = [...pin].map(Number);
  const steps = d.slice(1).map((n, i) => n - d[i]);
  return steps.every((s) => s === 0) || steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/** The step-by-step code entry shared by the post-login offer and Profile. */
function PinSetupFlow({ mode, onSubmit, createTitle = "Create a 4-digit code" }: PinSetupFlowProps) {
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const confirming = mode === "create" && firstPin !== null;

  const fail = (message: string) => {
    setError(message);
    setResetKey((k) => k + 1);
  };

  const submit = async (pin: string) => {
    setBusy(true);
    try {
      await onSubmit(pin);
    } catch (err) {
      if (err instanceof QuickLoginError && err.status === 423) setLocked(true);
      if (mode === "create") setFirstPin(null);
      fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = (pin: string) => {
    setError(null);
    if (mode === "verify") return void submit(pin);
    if (firstPin === null) {
      if (isTooEasy(pin)) return fail("That code is too easy to guess. Pick another.");
      setFirstPin(pin);
      setResetKey((k) => k + 1);
      return;
    }
    if (pin !== firstPin) {
      setFirstPin(null);
      return fail("The codes didn't match. Start again.");
    }
    void submit(pin);
  };

  const title = mode === "verify" ? "Enter your 4-digit code" : confirming ? "Enter it again" : createTitle;
  const hint =
    mode === "verify"
      ? "The code you already use for quick sign-in."
      : confirming
        ? "Just to be sure."
        : "You'll use it to sign in on this device. Avoid easy ones like 1234.";

  return (
    <div className="pin-setup">
      <p className="pin-setup-title">{title}</p>
      <p className="pin-setup-hint">{hint}</p>
      <PinPad onComplete={handleComplete} resetKey={resetKey} error={error} disabled={busy || locked} />
      <p className="pin-setup-error" role="alert">
        {error}
      </p>
    </div>
  );
}

export default PinSetupFlow;
