import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useAppState } from "../state/AppState";

type AccountSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    userEmail,
    emailVerified,
    sendVerificationEmail,
    refreshAuthStatus,
    updatePassword,
  } = useAppState();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setVerificationMessage("");
    setPasswordMessage("");
    setWorking(false);
  }, [isOpen]);

  const handleSendVerification = async () => {
    if (working) return;
    setWorking(true);
    setVerificationMessage("");
    const error = await sendVerificationEmail();
    setVerificationMessage(
      error || "Verification email sent. Check your inbox and spam folder."
    );
    setWorking(false);
  };

  const handleRefreshStatus = async () => {
    if (working) return;
    setWorking(true);
    setVerificationMessage("");
    await refreshAuthStatus();
    setVerificationMessage("Account status refreshed.");
    setWorking(false);
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (working) return;
    setPasswordMessage("");
    if (newPassword.length < 6) {
      setPasswordMessage("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }
    setWorking(true);
    const error = await updatePassword(currentPassword, newPassword);
    if (error) {
      setPasswordMessage(error);
      setWorking(false);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password updated.");
    setWorking(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Account settings"
      onClose={onClose}
    >
      <div className="form">
        <div>
          <p className="section-title">Email</p>
          <p className="helper-text">{userEmail || "Unknown email"}</p>
          {!emailVerified ? (
            <>
              <p className="helper-text error-text">Email not verified</p>
              <div className="inline-actions">
                <button
                  className="button ghost"
                  type="button"
                  onClick={handleSendVerification}
                  disabled={working}
                >
                  Send verification email
                </button>
                <button
                  className="button ghost"
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={working}
                >
                  I verified - refresh
                </button>
              </div>
            </>
          ) : null}
          {verificationMessage ? (
            <p className={`helper-text ${verificationMessage.includes("sent") || verificationMessage.includes("refreshed") ? "" : "error-text"}`}>
              {verificationMessage}
            </p>
          ) : null}
        </div>

        <form onSubmit={handleUpdatePassword} className="form">
          <p className="section-title">Change password</p>
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <div className="modal-actions">
            <button className="button" type="submit" disabled={working}>
              Update password
            </button>
          </div>
          {passwordMessage ? (
            <p className={`helper-text ${passwordMessage === "Password updated." ? "" : "error-text"}`}>
              {passwordMessage}
            </p>
          ) : null}
        </form>
      </div>
    </Modal>
  );
};
