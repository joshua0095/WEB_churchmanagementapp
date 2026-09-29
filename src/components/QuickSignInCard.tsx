import { useEffect, useState } from "react";
import { forgetQuickDevice, getQuickStatus, registerQuickDevice, removeQuickPin, setQuickPin } from "../api";
import { Modal, useConfirm } from "./dialogs";
import { Button, Card } from "./ui";
import PinSetupFlow from "./PinSetupFlow";
import { forgetAccount, getRememberedAccount, rememberAccount } from "../quickLogin";
import { errorToast, successToast } from "../swal";

interface Props {
  userId: number;
  name: string;
  photoDataUrl: string | null;
}

type Dialog = "setup" | "remember" | "change" | null;

/** Profile › Quick sign-in: set up, change or turn off the 4-digit code, and remember or
 * forget this device on the sign-in screen's account picker. */
function QuickSignInCard({ userId, name, photoDataUrl }: Props) {
  const confirm = useConfirm();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [remembered, setRemembered] = useState(() => !!getRememberedAccount(userId));
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    getQuickStatus()
      .then((s) => setHasPin(s.hasPin))
      .catch(() => setHasPin(null));
  }, []);

  // Keep this device's picker entry showing the current name/photo.
  useEffect(() => {
    const existing = getRememberedAccount(userId);
    if (existing) rememberAccount({ ...existing, name, photoDataUrl });
  }, [userId, name, photoDataUrl]);

  const rememberThisDevice = async (pin: string) => {
    const deviceToken = await registerQuickDevice(pin);
    rememberAccount({ userId, name, photoDataUrl, deviceToken });
    setHasPin(true);
    setRemembered(true);
    setDialog(null);
    successToast("Quick sign-in is on for this device");
  };

  const changeCode = async (pin: string) => {
    await setQuickPin(pin);
    setDialog(null);
    successToast("Code changed");
  };

  const forgetThisDevice = async () => {
    const existing = getRememberedAccount(userId);
    if (existing) void forgetQuickDevice(existing.deviceToken);
    forgetAccount(userId);
    setRemembered(false);
  };

  const turnOff = async () => {
    const ok = await confirm({
      title: "Turn off quick sign-in?",
      description: "Your code is deleted and every device forgets you. You'll sign in with email and password.",
      confirmLabel: "Turn off",
    });
    if (!ok) return;
    try {
      await removeQuickPin();
      forgetAccount(userId);
      setHasPin(false);
      setRemembered(false);
      successToast("Quick sign-in turned off");
    } catch (err) {
      errorToast(err instanceof Error ? err.message : "Couldn't turn off quick sign-in.");
    }
  };

  return (
    <Card className="!rounded-2xl flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-display text-lg font-semibold text-[var(--color-text-primary)]">Quick sign-in</h2>
        <p className="m-0 text-sm text-[var(--color-text-secondary)]">
          Tap your name on the sign-in screen and enter a 4-digit code instead of your password.
        </p>
      </div>

      {hasPin === null ? null : !hasPin ? (
        <Button type="button" onClick={() => setDialog("setup")} className="w-full">
          Set up quick sign-in
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--color-text-secondary)]">This device</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{remembered ? "Remembered" : "Not remembered"}</span>
          </div>
          {remembered ? (
            <Button type="button" variant="outline" onClick={forgetThisDevice} className="w-full">
              Forget this device
            </Button>
          ) : (
            <Button type="button" onClick={() => setDialog("remember")} className="w-full">
              Remember this device
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setDialog("change")} className="flex-1">
              Change code
            </Button>
            <Button type="button" variant="outline" onClick={turnOff} className="flex-1">
              Turn off
            </Button>
          </div>
        </>
      )}

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "change" ? "Change code" : dialog === "remember" ? "Remember this device" : "Set up quick sign-in"}
        size="sm"
      >
        {dialog === "setup" && <PinSetupFlow key="setup" mode="create" onSubmit={rememberThisDevice} />}
        {dialog === "remember" && <PinSetupFlow key="remember" mode="verify" onSubmit={rememberThisDevice} />}
        {dialog === "change" && (
          <PinSetupFlow key="change" mode="create" createTitle="Choose a new 4-digit code" onSubmit={changeCode} />
        )}
      </Modal>
    </Card>
  );
}

export default QuickSignInCard;
